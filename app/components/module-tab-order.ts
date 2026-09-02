import { DEFAULT_MODULE_ID } from "../db/modules/default";
import { type Module } from "../db/modules/modules";

const defaultFirst = (modules: readonly Module[]) => modules.toSorted((left, right) => (
  Number(right.id === DEFAULT_MODULE_ID) - Number(left.id === DEFAULT_MODULE_ID)
));

export const getModuleTabGroups = (
  modules: readonly Module[],
  viewModuleIds: ReadonlySet<string> = new Set(),
) => ({
  viewModules: modules.filter(module => viewModuleIds.has(module.id)),
  presetModules: modules.filter(module => (
    !viewModuleIds.has(module.id) && !module.gameSynced
  )),
  syncedModules: defaultFirst(modules.filter(module => (
    !viewModuleIds.has(module.id) && module.gameSynced
  ))),
});
