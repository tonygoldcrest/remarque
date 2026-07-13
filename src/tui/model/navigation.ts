import type { DisplayRow, Unit, Viewport } from "./types";

export function computeUnits(rows: DisplayRow[]): { units: Unit[]; unitOf: number[] } {
  const units: Unit[] = [];
  const unitOf = new Array<number>(rows.length).fill(-1);
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];

    if (row.kind === "line" || row.kind === "compose") {
      unitOf[i] = units.length;
      units.push({ first: i, last: i });
      i += 1;
    } else if (row.kind === "comment" && row.tone !== "rule") {
      const key = row.msgKey;
      const first = i;

      while (i < rows.length) {
        const next = rows[i];

        if (next.kind !== "comment" || next.tone === "rule" || next.msgKey !== key) {
          break;
        }

        unitOf[i] = units.length;
        i += 1;
      }

      units.push({ first, last: i - 1 });
    } else {
      i += 1;
    }
  }

  return { units, unitOf };
}

function clampTop(top: number, maxTop: number): number {
  return Math.max(0, Math.min(top, maxTop));
}

function fitsInView(unit: Unit, contentH: number): boolean {
  return unit.last - unit.first + 1 <= contentH;
}

function revealDown(top: number, unit: Unit, contentH: number, maxTop: number): number {
  let t = top;

  if (unit.first < t) {
    t = unit.first;
  } else if (unit.last > t + contentH - 1) {
    t = fitsInView(unit, contentH) ? unit.last - contentH + 1 : unit.first;
  }

  return clampTop(t, maxTop);
}

function revealUp(top: number, unit: Unit, contentH: number, maxTop: number): number {
  let t = top;

  if (unit.last > t + contentH - 1) {
    t = unit.last - contentH + 1;
  }

  if (unit.first < t && fitsInView(unit, contentH)) {
    t = unit.first;
  }

  return clampTop(t, maxTop);
}

function nearestUnit(units: Unit[], row: number): number {
  let best = 0;
  let bestDistance = Infinity;

  for (let k = 0; k < units.length; k++) {
    const distance = Math.abs(units[k].first - row);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = k;
    }
  }

  return best;
}

function scrollOverflowingDown(
  unit: Unit,
  cur: Viewport,
  contentH: number,
  maxTop: number,
): Viewport | null {
  if (unit.last <= cur.top + contentH - 1) {
    return null;
  }

  const target = fitsInView(unit, contentH)
    ? unit.last - contentH + 1
    : Math.min(unit.last - contentH + 1, cur.top + contentH);
  const capped = clampTop(target, maxTop);

  return capped > cur.top ? { row: unit.first, top: capped } : null;
}

function scrollOverflowingUp(
  unit: Unit,
  cur: Viewport,
  contentH: number,
  maxTop: number,
): Viewport | null {
  if (unit.first >= cur.top) {
    return null;
  }

  const target = fitsInView(unit, contentH) ? unit.first : Math.max(unit.first, cur.top - contentH);
  const capped = clampTop(target, maxTop);

  return capped < cur.top ? { row: unit.first, top: capped } : null;
}

export function navigate(
  rows: DisplayRow[],
  units: Unit[],
  unitOf: number[],
  cur: Viewport,
  dir: number,
  contentH: number,
): Viewport {
  if (units.length === 0) {
    return cur;
  }

  const maxTop = Math.max(0, rows.length - contentH);
  const unitIndex = cur.row >= 0 && cur.row < rows.length ? unitOf[cur.row] : -1;

  if (unitIndex < 0) {
    const unit = units[nearestUnit(units, cur.row)];

    return { row: unit.first, top: revealDown(cur.top, unit, contentH, maxTop) };
  }

  const unit = units[unitIndex];

  if (dir > 0) {
    const scrolled = scrollOverflowingDown(unit, cur, contentH, maxTop);

    if (scrolled) {
      return scrolled;
    }

    const next = units[(unitIndex + 1) % units.length];

    return { row: next.first, top: revealDown(cur.top, next, contentH, maxTop) };
  }

  const scrolled = scrollOverflowingUp(unit, cur, contentH, maxTop);

  if (scrolled) {
    return scrolled;
  }

  const prev = units[(unitIndex - 1 + units.length) % units.length];

  return { row: prev.first, top: revealUp(cur.top, prev, contentH, maxTop) };
}
