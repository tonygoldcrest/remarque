export type CellType = "context" | "add" | "del" | "empty";

export interface Cell {
  num: number | null;
  text: string;
  type: CellType;
}

export type Row = { kind: "hunk"; header: string } | { kind: "line"; left: Cell; right: Cell };

const EMPTY: Cell = { num: null, text: "", type: "empty" };

export function parsePatch(patch: string): Row[] {
  const lines = patch.split("\n");
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

  for (const line of lines) {
    if (line.startsWith("@@")) {
      flush();
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (m) {
        oldLine = Number(m[1]);
        newLine = Number(m[2]);
        inHunk = true;
        rows.push({ kind: "hunk", header: line });
      }
      continue;
    }
    if (!inHunk) continue;

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
    } else if (marker === "\\") {
      continue;
    } else {
      flush();
      inHunk = false;
    }
  }
  flush();
  return rows;
}
