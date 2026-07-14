import { useEffect, useMemo, useState } from "react";

import { tokenizeCode } from "../highlight/index.js";
import type { SideTokens } from "../highlight/index.js";
import { sideLines } from "../model/index.js";
import type { DisplayRow } from "../model/index.js";

const NONE: SideTokens = { old: null, new: null };

export function useHighlights(rows: DisplayRow[], lang: string | null): SideTokens {
  const [tokens, setTokens] = useState<SideTokens>(NONE);
  const { old: oldLines, new: newLines } = useMemo(() => sideLines(rows), [rows]);
  const oldCode = oldLines.join("\n");
  const newCode = newLines.join("\n");

  useEffect(() => {
    setTokens(NONE);

    if (!lang || (oldCode === "" && newCode === "")) {
      return;
    }

    let alive = true;

    Promise.all([tokenizeCode(oldCode, lang), tokenizeCode(newCode, lang)])
      .then(([oldTokens, newTokens]) => {
        if (alive) {
          setTokens({ old: oldTokens, new: newTokens });
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [oldCode, newCode, lang]);

  return tokens;
}
