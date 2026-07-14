import { describe, it, expect } from "vitest";
import { captureAnchor, resolveAnchor, sim, levenshtein, splitLines } from "../src/anchor/index.js";

const content = "a\nb\nTARGET\nc\nd\n";
const anchor = captureAnchor({ content, blobSha: "sha1", line: 3, endLine: 3 });

describe("captureAnchor", () => {
  it("captures the line text and surrounding context", () => {
    expect(anchor.lineText).toBe("TARGET");
    expect(anchor.before).toEqual(["a", "b"]);
    expect(anchor.after).toEqual(["c", "d"]);
  });
});

describe("resolveAnchor", () => {
  it("returns the original line when the blob is unchanged", () => {
    expect(resolveAnchor(anchor, content, "sha1")).toEqual({ line: 3, endLine: 3 });
  });

  it("follows the line when content is inserted above (exact match)", () => {
    const shifted = "x\ny\na\nb\nTARGET\nc\nd\n";
    expect(resolveAnchor(anchor, shifted, "sha2")).toEqual({ line: 5, endLine: 5 });
  });

  it("relocates via fuzzy match when the anchored line changed slightly", () => {
    const edited = "a\nb\nTARGETX\nc\nd\n";
    expect(resolveAnchor(anchor, edited, "sha3")).toEqual({ line: 3, endLine: 3 });
  });

  it("marks outdated when the anchored content is gone", () => {
    const gone = "completely\ndifferent\nstuff\nhere\n";
    expect(resolveAnchor(anchor, gone, "sha4")).toBeNull();
  });

  it("returns null when the file is missing", () => {
    expect(resolveAnchor(anchor, null, null)).toBeNull();
  });

  it("preserves a multi-line span", () => {
    const multi = "a\nb\nT1\nT2\nc\n";
    const a = captureAnchor({ content: multi, blobSha: "m1", line: 3, endLine: 4 });
    const shifted = "z\na\nb\nT1\nT2\nc\n";
    expect(resolveAnchor(a, shifted, "m2")).toEqual({ line: 4, endLine: 5 });
  });
});

describe("similarity helpers", () => {
  it("computes levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("scores identical trimmed strings as 1", () => {
    expect(sim("  foo ", "foo")).toBe(1);
  });

  it("splits content ignoring a single trailing newline", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
  });
});
