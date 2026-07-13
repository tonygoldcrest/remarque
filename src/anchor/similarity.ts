export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) {
    return n;
  }

  if (n === 0) {
    return m;
  }

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }

    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function sim(a: string, b: string): number {
  const x = a.trim();
  const y = b.trim();

  if (x === y) {
    return 1;
  }

  if (x.length === 0 || y.length === 0) {
    return 0;
  }

  const dist = levenshtein(x, y);

  return 1 - dist / Math.max(x.length, y.length);
}
