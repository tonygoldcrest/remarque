import { Option } from "commander";

import type { Author } from "../protocol.js";

export function authorOption(defaultAuthor: Author): Option {
  return new Option("--author <who>", "who is speaking")
    .choices(["human", "agent"])
    .default(defaultAuthor);
}

export function sideOption(): Option {
  return new Option("--side <side>", "diff side").choices(["new", "old"]).default("new");
}

export function statusFilterOption(): Option {
  return new Option("--status <status>", "filter by status").choices([
    "open",
    "resolved",
    "dismissed",
    "outdated",
  ]);
}

export function authorFilterOption(): Option {
  return new Option("--author <who>", "filter by who opened the thread").choices([
    "human",
    "agent",
  ]);
}
