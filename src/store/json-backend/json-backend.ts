import path from "node:path";
import lockfile from "proper-lockfile";
import fs from "node:fs/promises";

import { emptyStore, SCHEMA_VERSION, type ReviewStore, type Session } from "../../protocol";
import type { StorageBackend } from "../backend";
import type { Manifest, SessionData } from "./types";
import { readJsonFile, writeJsonFile } from "./helpers";

const LOCK_OPTS = {
  realpath: false as const,
  stale: 10_000,
  retries: { retries: 15, factor: 1.4, minTimeout: 20, maxTimeout: 250 },
};

export class JsonBackend implements StorageBackend {
  constructor(private readonly dir: string) {}

  location(): string {
    return this.dir;
  }

  private manifestFile(): string {
    return path.join(this.dir, "sessions.json");
  }

  private sessionFile(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.json`);
  }

  async read(): Promise<ReviewStore> {
    const manifest = await readJsonFile<Manifest>(this.manifestFile());

    if (!manifest) {
      return emptyStore();
    }

    const store: ReviewStore = {
      schemaVersion: manifest.schemaVersion,
      sessions: manifest.sessions,
      currentSessionId: manifest.currentSessionId,
      threads: [],
      generalComments: [],
    };

    for (const session of manifest.sessions) {
      const data = await readJsonFile<SessionData>(this.sessionFile(session.id));

      if (!data) {
        continue;
      }

      store.threads.push(...data.threads);
      store.generalComments.push(...data.generalComments);
    }

    return store;
  }

  async update(mutator: (store: ReviewStore) => ReviewStore | void): Promise<ReviewStore> {
    await fs.mkdir(this.dir, { recursive: true });

    const release = await lockfile.lock(this.manifestFile(), LOCK_OPTS);

    try {
      const current = await this.read();
      const next = mutator(current) ?? current;

      next.schemaVersion = SCHEMA_VERSION;
      await this.write(next);

      return next;
    } finally {
      await release();
    }
  }

  private async write(store: ReviewStore): Promise<void> {
    const manifest: Manifest = {
      schemaVersion: store.schemaVersion,
      currentSessionId: store.currentSessionId,
      sessions: store.sessions,
    };

    await writeJsonFile(this.manifestFile(), manifest);

    for (const session of store.sessions) {
      await writeJsonFile(this.sessionFile(session.id), this.sessionData(store, session));
    }
  }

  private sessionData(store: ReviewStore, session: Session): SessionData {
    return {
      schemaVersion: store.schemaVersion,
      threads: store.threads.filter((t) => t.sessionId === session.id),
      generalComments: store.generalComments.filter((g) => g.sessionId === session.id),
    };
  }
}
