const ALT_SCREEN_ON = "[?1049h";
const ALT_SCREEN_OFF = "[?1049l";
const HIDE_CURSOR = "[?25l";
const SHOW_CURSOR = "[?25h";
const BEGIN_SYNC = "[?2026h";
const END_SYNC = "[?2026l";

type WriteArgs = [chunk: string | Uint8Array, ...rest: unknown[]];

export function enterFullscreen(): () => void {
  const stdout = process.stdout;
  const original = stdout.write.bind(stdout) as (...args: WriteArgs) => boolean;

  original(ALT_SCREEN_ON + HIDE_CURSOR);

  const wrapped = (...args: WriteArgs): boolean => {
    const [chunk, ...rest] = args;

    if (typeof chunk === "string") {
      return original(BEGIN_SYNC + chunk + END_SYNC, ...rest);
    }

    return original(chunk, ...rest);
  };

  stdout.write = wrapped as typeof stdout.write;

  let restored = false;

  const restore = (): void => {
    if (restored) {
      return;
    }

    restored = true;
    stdout.write = original as typeof stdout.write;

    original(SHOW_CURSOR + ALT_SCREEN_OFF);
  };

  process.once("exit", restore);

  return restore;
}
