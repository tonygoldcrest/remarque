import { readFileSync } from "node:fs";
import path from "node:path";

import { Review } from "../review";

export function readVersion(): string {
  try {
    const pkg = readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8");

    return (JSON.parse(pkg) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function int(value: string): number {
  const n = Number.parseInt(value, 10);

  if (Number.isNaN(n)) {
    throw new Error(`expected an integer, got "${value}"`);
  }

  return n;
}

export function out(json: unknown, human: string, asJson: boolean): void {
  console.log(asJson ? JSON.stringify(json) : human);
}

export function short(id: string): string {
  return id.slice(0, 8);
}

export function fail(e: unknown): void {
  process.stderr.write(`remarque: ${(e as Error).message}\n`);
  process.exitCode = 1;
}

export function guarded<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      fail(e);
    }
  };
}

export function withReview(fn: (review: Review) => Promise<void>): Promise<void> {
  return guarded(async () => {
    const review = await Review.open();

    await fn(review);
  })();
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export async function readPayload(inputPath: string | undefined, example: string): Promise<string> {
  if (!inputPath && process.stdin.isTTY) {
    throw new Error(`no payload: pipe JSON on stdin (e.g. ${example}) or pass --input <path>`);
  }

  return inputPath ? readFileSync(inputPath, "utf8") : readStdin();
}
