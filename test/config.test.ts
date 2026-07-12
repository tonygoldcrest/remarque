import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  resolveStore,
  saveLocalConfig,
  loadLocalConfig,
  isInsideRepo,
  addToGitignore,
} from "../src/config";

function tmp() {
  return mkdtempSync(path.join(tmpdir(), "review-config-"));
}

afterEach(() => {
  delete process.env.REMARQUE_STORE_DIR;
});

describe("resolveStore", () => {
  it("uses a repo-scoped local config with no repo key in the path", () => {
    const root = tmp();
    saveLocalConfig(root, { store: { scope: "repo", dir: ".review" } });
    const r = resolveStore(root, "main");
    expect(r.scope).toBe("repo");
    expect(r.source).toBe("local");
    expect(r.file).toBe(path.join(root, ".review", "main.json"));
  });

  it("honors REMARQUE_STORE_DIR as a global override keyed per repo", () => {
    const root = tmp();
    const store = tmp();
    process.env.REMARQUE_STORE_DIR = store;
    const r = resolveStore(root, "feat/x");
    expect(r.source).toBe("env");
    expect(r.file.startsWith(store)).toBe(true);
    expect(r.file.endsWith(path.join("feat-x.json"))).toBe(true);
  });
});

describe("local config io", () => {
  it("round-trips and returns null when absent", () => {
    const root = tmp();
    expect(loadLocalConfig(root)).toBeNull();
    saveLocalConfig(root, { store: { scope: "global" } });
    expect(loadLocalConfig(root)).toEqual({ store: { scope: "global" } });
  });
});

describe("isInsideRepo", () => {
  it("distinguishes in-repo dirs from escapes", () => {
    const root = "/repo";
    expect(isInsideRepo(root, ".review")).toBe(true);
    expect(isInsideRepo(root, "nested/reviews")).toBe(true);
    expect(isInsideRepo(root, "../shared")).toBe(false);
    expect(isInsideRepo(root, "/tmp/elsewhere")).toBe(false);
  });
});

describe("addToGitignore", () => {
  it("adds the entry once and is idempotent", () => {
    const root = tmp();
    expect(addToGitignore(root, ".review")).toBe(true);
    expect(addToGitignore(root, ".review")).toBe(false);
    const gi = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gi.match(/\.review\//g)).toHaveLength(1);
  });

  it("preserves existing content", () => {
    const root = tmp();
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    addToGitignore(root, ".review");
    const gi = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gi).toContain("node_modules/");
    expect(gi).toContain(".review/");
  });
});
