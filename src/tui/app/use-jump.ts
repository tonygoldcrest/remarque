import { useState } from "react";

import { chunkStarts, seekIndex, threadStarts } from "../model";
import type { DisplayRow } from "../model";

interface JumpArgs {
  rows: DisplayRow[];
  onJump: (target: number) => void;
  onMiss: (notice: string) => void;
}

export function useJump({ rows, onJump, onMiss }: JumpArgs) {
  const [pending, setPending] = useState<"]" | "[" | null>(null);

  const handleKey = (ch: string, from: number): boolean => {
    if (pending) {
      const dir = pending === "]" ? 1 : -1;

      setPending(null);

      if (ch === "c" || ch === "t") {
        const indices = ch === "c" ? chunkStarts(rows) : threadStarts(rows);
        const target = seekIndex(indices, from, dir);

        if (target == null) {
          onMiss(ch === "c" ? "no chunks in this file" : "no threads in this file");
        } else {
          onJump(target);
        }

        return true;
      }
    }

    if (ch === "]" || ch === "[") {
      setPending(ch);

      return true;
    }

    return false;
  };

  return { handleKey };
}
