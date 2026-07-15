import { useState } from "react";

import { chunkStarts, seekIndex } from "../model/index.js";
import type { DisplayRow } from "../model/index.js";

interface JumpArgs {
  rows: DisplayRow[];
  onJump: (target: number) => void;
  onThread: (dir: number) => void;
  onMiss: (notice: string) => void;
}

export function useJump({ rows, onJump, onThread, onMiss }: JumpArgs) {
  const [pending, setPending] = useState<"]" | "[" | null>(null);

  const handleKey = (ch: string, from: number): boolean => {
    if (pending) {
      const dir = pending === "]" ? 1 : -1;

      setPending(null);

      if (ch === "c") {
        const target = seekIndex(chunkStarts(rows), from, dir);

        if (target == null) {
          onMiss("no chunks in this file");
        } else {
          onJump(target);
        }

        return true;
      }

      if (ch === "t") {
        onThread(dir);

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
