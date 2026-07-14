import type { HighlighterGeneric } from "shiki";

import type { Token } from "./types.js";
import { THEME } from "./constants.js";

type Highlighter = HighlighterGeneric<never, never>;

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();
const failedLangs = new Set<string>();

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= (async () => {
    const shiki = await import("shiki");
    const engine = await import("shiki/engine/javascript");

    return (await shiki.createHighlighter({
      themes: [THEME],
      langs: [],
      engine: engine.createJavaScriptRegexEngine({ forgiving: true }),
    })) as Highlighter;
  })();

  return highlighterPromise;
}

async function highlighterFor(lang: string): Promise<Highlighter | null> {
  if (failedLangs.has(lang)) {
    return null;
  }

  const highlighter = await getHighlighter();

  if (!loadedLangs.has(lang)) {
    try {
      await highlighter.loadLanguage(lang as never);
      loadedLangs.add(lang);
    } catch {
      failedLangs.add(lang);

      return null;
    }
  }

  return highlighter;
}

export async function tokenizeCode(code: string, lang: string): Promise<Token[][] | null> {
  const highlighter = await highlighterFor(lang);

  if (!highlighter) {
    return null;
  }

  const themed = highlighter.codeToTokensBase(code, {
    lang: lang as never,
    theme: THEME,
  });

  return themed.map((line) => line.map((t) => ({ text: t.content, color: t.color })));
}
