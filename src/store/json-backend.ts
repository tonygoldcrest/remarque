import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import lockfile from "proper-lockfile";

import { emptyStore, SCHEMA_VERSION, type ReviewStore } from "../protocol";
import type { StorageBackend } from "./backend";

const LOCK_OPTS = {
  realpath: false as const,
  stale: 10_000,
  retries: { retries: 15, factor: 1.4, minTimeout: 20, maxTimeout: 250 },
};

export class JsonBackend implements StorageBackend {
  constructor(private readonly file: string) {}

  location(): string {
    return this.file;
  }

  async read(): Promise<ReviewStore> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
      throw e;
    }
    return parseStore(raw, this.file);
  }

  async update(mutator: (store: ReviewStore) => ReviewStore | void): Promise<ReviewStore> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const release = await lockfile.lock(this.file, LOCK_OPTS);
    try {
      const current = await this.read();
      const next = mutator(current) ?? current;
      next.schemaVersion = SCHEMA_VERSION;
      await atomicWrite(this.file, JSON.stringify(next, null, 2) + "\n");
      return next;
    } finally {
      await release();
    }
  }
}

function parseStore(raw: string, file: string): ReviewStore {
  let parsed: ReviewStore;
  try {
    parsed = JSON.parse(raw) as ReviewStore;
  } catch (e) {
    throw new Error(`corrupt review store at ${file}: ${(e as Error).message}`, { cause: e });
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `review store at ${file} has schemaVersion ${parsed.schemaVersion}, ` +
        `but this CLI speaks ${SCHEMA_VERSION}. Upgrade the CLI or migrate the store.`,
    );
  }
  return parsed;
}

async function atomicWrite(file: string, data: string): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(tmp, { flags: "w", mode: 0o644 });
    stream.on("error", reject);
    stream.write(data, (err) => {
      if (err) return reject(err);
      stream.end();
    });
    stream.on("finish", resolve);
  });
  await fs.rename(tmp, file);
}
