import type { GeneralComment, Session, Thread } from "../../protocol.js";

export interface Manifest {
  schemaVersion: number;
  currentSessionId: string | null;
  sessions: Session[];
}

export interface SessionData {
  schemaVersion: number;
  threads: Thread[];
  generalComments: GeneralComment[];
}
