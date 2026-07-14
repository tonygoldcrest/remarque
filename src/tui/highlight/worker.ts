import { parentPort } from "node:worker_threads";

import { tokenizeCode } from "./shiki.js";

interface Request {
  id: number;
  code: string;
  lang: string;
}

parentPort?.on("message", ({ id, code, lang }: Request) => {
  tokenizeCode(code, lang)
    .then((tokens) => parentPort?.postMessage({ id, tokens }))
    .catch(() => parentPort?.postMessage({ id, tokens: null }));
});
