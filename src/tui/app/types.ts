import type { ComposerTarget } from "../types.js";

export type ComposerIntent = { open: ComposerTarget } | { notice: string } | null;

export type StatusKey = "r" | "x" | "o";
