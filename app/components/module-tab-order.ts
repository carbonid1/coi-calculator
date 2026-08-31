import { type Module } from "../db/modules/modules";

export const getModuleTabGroups = (
  modules: readonly Module[],
  viewModuleIds: ReadonlySet<string> = new Set(),
) => ({
  viewModules: modules.filter(module => viewModuleIds.has(module.id)),
  presetModules: modules.filter(module => (
    !viewModuleIds.has(module.id) && !module.gameSynced
  )),
  syncedModules: modules.filter(module => (
    !viewModuleIds.has(module.id) && module.gameSynced
  )),
});
