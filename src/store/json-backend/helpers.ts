import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";

import { SCHEMA_VERSION } from "../../protocol.js";

export async function readJsonFile<T extends { schemaVersion: number }>(
  file: string,
): Promise<T | null> {
  let raw: string;

  try {
    raw = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw e;
  }

  return parseVersioned<T>(raw, file);
}

function parseVersioned<T extends { schemaVersion: number }>(raw: string, file: string): T {
  let parsed: T;

  try {
    parsed = JSON.parse(raw) as T;
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

export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await atomicWrite(file, JSON.stringify(data, null, 2) + "\n");
}

async function atomicWrite(file: string, data: string): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(tmp, { flags: "w", mode: 0o644 });

    stream.on("error", reject);
    stream.write(data, (err) => {
      if (err) {
        return reject(err);
      }
      stream.end();
    });
    stream.on("finish", resolve);
  });

  await fs.rename(tmp, file);
}
