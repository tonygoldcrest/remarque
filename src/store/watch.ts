import { watch as fsWatch, mkdirSync } from "node:fs";

export interface StoreWatcher {
  close: () => void;
}

export function watchStore(storeDir: string, delayMs: number, onChange: () => void): StoreWatcher {
  mkdirSync(storeDir, { recursive: true });

  let timer: NodeJS.Timeout | null = null;

  const watcher = fsWatch(storeDir, () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(onChange, delayMs);
  });

  return {
    close: () => {
      if (timer) {
        clearTimeout(timer);
      }

      watcher.close();
    },
  };
}
