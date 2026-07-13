import { watch as fsWatch, mkdirSync, type FSWatcher } from "node:fs";

export function watchStore(storeDir: string, delayMs: number, onChange: () => void): FSWatcher {
  mkdirSync(storeDir, { recursive: true });

  let timer: NodeJS.Timeout | null = null;

  return fsWatch(storeDir, () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(onChange, delayMs);
  });
}
