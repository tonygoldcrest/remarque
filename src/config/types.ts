export type StoreScope = "repo" | "global";

export type LocalConfig = {
  store: { scope: "repo"; dir: string } | { scope: "global" };
};

export interface GlobalConfig {
  store: { dir: string };
}

export interface ResolvedStore {
  scope: StoreScope;
  dir: string;
  source: "env" | "local" | "global";
}
