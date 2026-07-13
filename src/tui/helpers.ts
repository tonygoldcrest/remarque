export function paneWidths(width: number): { filesW: number; removedW: number; addedW: number } {
  const filesW = Math.max(16, Math.floor(width * 0.2));
  const rest = width - filesW;
  const removedW = Math.floor(rest / 2);
  const addedW = rest - removedW;

  return { filesW, removedW, addedW };
}

export function contentHeight(height: number): number {
  return Math.max(1, Math.max(1, height - 3) - 2);
}
