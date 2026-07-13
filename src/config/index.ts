export { globalConfigPath, globalDataDefault, localConfigPath } from "./paths";
export { loadGlobalConfig, loadLocalConfig, saveLocalConfig } from "./storage";
export { resolveStore } from "./resolve";
export { addToGitignore, isInsideRepo } from "./gitignore";
export type { GlobalConfig, LocalConfig, ResolvedStore, StoreScope } from "./types";
