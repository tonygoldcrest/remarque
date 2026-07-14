export { globalConfigPath, globalDataDefault, localConfigPath } from "./paths.js";
export { loadGlobalConfig, loadLocalConfig, saveLocalConfig } from "./storage.js";
export { resolveStore } from "./resolve.js";
export { addToGitignore, isInsideRepo } from "./gitignore.js";
export type { GlobalConfig, LocalConfig, ResolvedStore, StoreScope } from "./types.js";
