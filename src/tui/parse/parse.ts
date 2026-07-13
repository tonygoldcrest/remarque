import type { Cell, Row } from "./types";

const EMPTY: Cell = { num: null, text: "", type: "empty" };
const HUNK_HEADER = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): Row[] {
  const rows: Row[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  let dels: Cell[] = [];
  let adds: Cell[] = [];

  const flush = () => {
    const n = Math.max(dels.length, adds.length);

    for (let i = 0; i < n; i++) {
      rows.push({ kind: "line", left: dels[i] ?? EMPTY, right: adds[i] ?? EMPTY });
    }

    dels = [];
    adds = [];
  };

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      flush();

      const header = HUNK_HEADER.exec(line);

      if (header) {
        oldLine = Number(header[1]);
        newLine = Number(header[2]);
        inHunk = true;

        rows.push({ kind: "hunk", header: line });
      }

      continue;
    }

    if (!inHunk) {
      continue;
    }

    const marker = line[0];
    const text = line.slice(1);

    if (marker === " ") {
      flush();

      rows.push({
        kind: "line",
        left: { num: oldLine++, text, type: "context" },
        right: { num: newLine++, text, type: "context" },
      });
    } else if (marker === "-") {
      dels.push({ num: oldLine++, text, type: "del" });
    } else if (marker === "+") {
      adds.push({ num: newLine++, text, type: "add" });
    } else if (marker !== "\\") {
      flush();

      inHunk = false;
    }
  }

  flush();

  return rows;
}
