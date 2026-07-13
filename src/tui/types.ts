import type { Side } from "../protocol";

export type Focus = "removed" | "added";

export interface Composer {
  mode: "new" | "reply" | "general";
  file?: string;
  side?: Side;
  line?: number;
  threadId?: string;
  value: string;
}

export type ComposerTarget = Omit<Composer, "value">;

export interface DeleteRequest {
  threadId: string;
  label: string;
}
