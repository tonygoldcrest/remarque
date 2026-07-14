import { Worker } from "node:worker_threads";

import type { Token } from "./types.js";

interface Reply {
  id: number;
  tokens: Token[][] | null;
}

interface Waiter {
  resolve: (tokens: Token[][] | null) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let broken = false;
let seq = 0;
const pending = new Map<number, Waiter>();

function failAll(): void {
  broken = true;
  worker = null;

  for (const { reject } of pending.values()) {
    reject(new Error("highlight worker failed"));
  }

  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url));
    worker.on("message", (reply: Reply) => {
      const waiter = pending.get(reply.id);

      pending.delete(reply.id);
      waiter?.resolve(reply.tokens);
    });
    worker.on("error", failAll);
    worker.on("exit", () => {
      if (pending.size > 0) {
        failAll();
      }

      worker = null;
    });
    worker.unref();
  }

  return worker;
}

async function tokenizeInProcess(code: string, lang: string): Promise<Token[][] | null> {
  const { tokenizeCode } = await import("./shiki.js");

  return tokenizeCode(code, lang);
}

export async function tokenizeCode(code: string, lang: string): Promise<Token[][] | null> {
  if (broken) {
    return tokenizeInProcess(code, lang);
  }

  try {
    return await new Promise<Token[][] | null>((resolve, reject) => {
      const id = ++seq;

      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, code, lang });
    });
  } catch {
    return tokenizeInProcess(code, lang);
  }
}
