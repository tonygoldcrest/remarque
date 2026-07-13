import type { GeneralComment, Session, Thread } from "../../protocol";

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
