import theme from "./theme.js";

const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const SET_BG = "\x1b]11;" + theme.appBg + "\x07";
const RESET_BG = "\x1b]111\x07";
const BEGIN_SYNC = "\x1b[?2026h";
const END_SYNC = "\x1b[?2026l";

type WriteArgs = [chunk: string | Uint8Array, ...rest: unknown[]];

export function enterFullscreen(): () => void {
  const stdout = process.stdout;
  const original = stdout.write.bind(stdout) as (...args: WriteArgs) => boolean;

  original(ALT_SCREEN_ON + HIDE_CURSOR + SET_BG);

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

    original(RESET_BG + SHOW_CURSOR + ALT_SCREEN_OFF);
  };

  const terminate = (): void => {
    restore();
    process.exit(143);
  };

  process.once("exit", restore);
  process.once("SIGTERM", terminate);

  return restore;
}
