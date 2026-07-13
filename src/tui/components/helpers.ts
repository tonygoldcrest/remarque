export function clip(s: string, w: number): string {
  return s.length > w ? s.slice(0, Math.max(0, w)) : s;
}

export function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

export function fit(s: string, w: number): string {
  return pad(clip(s, w), w);
}
