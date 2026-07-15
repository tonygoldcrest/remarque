import { useEffect, useState } from "react";

import { navigate, selectableRow } from "../model/index.js";
import type { DisplayRow, Unit, Viewport } from "../model/index.js";

interface ViewportArgs {
  rows: DisplayRow[];
  units: Unit[];
  unitOf: number[];
  contentH: number;
}

export function useViewport({ rows, units, unitOf, contentH }: ViewportArgs) {
  const [pos, setPos] = useState<Viewport>({ row: 0, top: 0 });
  const clamped = Math.min(pos.row, Math.max(0, rows.length - 1));
  const boundedRow = selectableRow(units, unitOf, clamped);
  const maxTop = Math.max(0, rows.length - contentH);

  useEffect(() => {
    setPos((p) => {
      const row = Math.min(p.row, Math.max(0, rows.length - 1));
      const top = Math.max(0, Math.min(p.top, Math.max(0, rows.length - contentH)));

      return row === p.row && top === p.top ? p : { row, top };
    });
  }, [rows.length, contentH]);

  const reset = () => setPos({ row: 0, top: 0 });

  const move = (dir: number) =>
    setPos((p) => {
      const from = selectableRow(units, unitOf, Math.min(p.row, Math.max(0, rows.length - 1)));

      return navigate(rows, units, unitOf, { row: from, top: p.top }, dir, contentH);
    });

  const jumpTo = (target: number) => {
    const top = Math.max(0, Math.min(target - Math.floor(contentH / 2), maxTop));

    setPos({ row: target, top });
  };

  return { pos, boundedRow, reset, move, jumpTo };
}
