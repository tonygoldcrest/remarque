import { describe, it, expect } from "vitest";

import { langForFile, tokenize, tokenizeCode } from "../src/tui/highlight/index.js";
import { sideLines } from "../src/tui/model/index.js";
import type { DisplayRow } from "../src/tui/model/index.js";

describe("langForFile", () => {
  it("maps extensions to shiki language ids", () => {
    expect(langForFile("src/app.tsx")).toBe("tsx");
    expect(langForFile("run.sh")).toBe("shellscript");
    expect(langForFile("readme.txt")).toBeNull();
  });
});

describe("tokenizeCode", () => {
  it("carries multi-line state, coloring the middle of a template literal", async () => {
    const code = ["const s = `start", "middle", "end`;"].join("\n");
    const tokens = await tokenizeCode(code, "typescript");

    expect(tokens).not.toBeNull();
    expect(tokens!).toHaveLength(3);

    const middle = tokens![1];
    expect(middle.map((t) => t.text).join("")).toBe("middle");
    expect(middle[0].color).toBe("#A5D6FF");
  });

  it("returns null for unknown languages", async () => {
    expect(await tokenizeCode("hello", "not-a-language")).toBeNull();
  });
});

describe("tokenize fallback", () => {
  it("understands shiki ids that lowlight names differently", () => {
    const tokens = tokenize("const x = 1", "tsx");

    expect(tokens.some((t) => t.color)).toBe(true);
  });
});

describe("sideLines", () => {
  it("rebuilds both sides by line number, filling gaps", () => {
    const rows: DisplayRow[] = [
      { kind: "hunk", header: "@@" },
      {
        kind: "line",
        left: { num: 1, text: "same", type: "context" },
        right: { num: 1, text: "same", type: "context" },
      },
      {
        kind: "line",
        left: { num: 2, text: "gone", type: "del" },
        right: { num: 2, text: "added", type: "add" },
      },
      {
        kind: "line",
        left: { num: null, text: "", type: "empty" },
        right: { num: 4, text: "later", type: "add" },
      },
    ];

    expect(sideLines(rows)).toEqual({
      old: ["same", "gone"],
      new: ["same", "added", "", "later"],
    });
  });
});
