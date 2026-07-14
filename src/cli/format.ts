import type { GeneralComment, ResolvedThread, Session, Thread } from "../protocol.js";
import { short } from "./helpers.js";

function firstLine(s: string): string {
  const nl = s.indexOf("\n");

  return nl === -1 ? s : s.slice(0, nl) + "…";
}

export function fmtThread(t: Thread | ResolvedThread): string {
  const at =
    "currentLine" in t && t.currentLine != null ? `:${t.currentLine}` : `:${t.anchor.line}?`;
  const last = t.messages[t.messages.length - 1];

  return `#${short(t.id)} [${t.status}] ${t.file}${at} (${t.side}) — ${last.author}: ${firstLine(last.body)}`;
}

export function fmtGeneral(g: GeneralComment): string {
  const last = g.messages[g.messages.length - 1];

  return `#${short(g.id)} [${g.status}] (general) — ${last.author}: ${firstLine(last.body)}`;
}

export function fmtSession(s: Session): string {
  return `session ${short(s.id)} on ${s.branch}: ${s.base}..${s.compare}`;
}
