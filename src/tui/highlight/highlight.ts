import lowlight from "lowlight";

import type { HastNode, Token } from "./types.js";
import { HLJS_BY_SHIKI, LANG_BY_EXT, SCOPE_COLORS, TOKEN_CACHE_LIMIT } from "./constants.js";

export function langForFile(file: string): string | null {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";

  return LANG_BY_EXT[ext] ?? null;
}

function walk(nodes: HastNode[], inherited: string | undefined, out: Token[]): void {
  for (const node of nodes) {
    if (node.type === "text") {
      out.push({ text: node.value, color: inherited });
    } else {
      const cls = node.properties?.className?.[0];
      const color = (cls && SCOPE_COLORS[cls]) || inherited;

      walk(node.children ?? [], color, out);
    }
  }
}

function highlightTokens(code: string, lang: string): Token[] {
  try {
    const result = lowlight.highlight(HLJS_BY_SHIKI[lang] ?? lang, code);
    const out: Token[] = [];

    walk(result.value as unknown as HastNode[], undefined, out);

    return out.length ? out : [{ text: code }];
  } catch {
    return [{ text: code }];
  }
}

const cache = new Map<string, Token[]>();

export function tokenize(code: string, lang: string | null): Token[] {
  if (!lang || code.length === 0) {
    return [{ text: code }];
  }

  const key = `${lang} ${code}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const out = highlightTokens(code, lang);

  if (cache.size > TOKEN_CACHE_LIMIT) {
    cache.clear();
  }

  cache.set(key, out);

  return out;
}

export function clipTokens(tokens: Token[], width: number): Token[] {
  const out: Token[] = [];
  let used = 0;

  for (const token of tokens) {
    if (used >= width) {
      break;
    }

    const room = width - used;
    const text = token.text.length > room ? token.text.slice(0, room) : token.text;

    out.push({ text, color: token.color });
    used += text.length;
  }

  if (used < width) {
    out.push({ text: " ".repeat(width - used) });
  }

  return out;
}
