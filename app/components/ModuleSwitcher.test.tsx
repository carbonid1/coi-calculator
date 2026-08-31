import { describe, expect, it } from "vitest";

import { type Module } from "../db/modules/modules";
import {
  getModuleIcon,
  moduleIcons,
  syncedModuleIcon,
} from "./module-icons";
import { getModuleTabGroups } from "./module-tab-order";

const createModule = (
  id: string,
  name: string,
  options: Pick<Module, "gameSynced" | "liveArea"> = {},
): Module => ({
  id,
  name,
  description: "",
  builtBuildings: {},
  presets: [],
  defaultPresetId: null,
  ...options,
});

describe("moduleIcons", () => {
  it("uses the shared icon for every synced module", () => {
    const chickenFarms = createModule("chicken-farms", "Chicken Farms", {
      gameSynced: true,
    });

    expect(chickenFarms.gameSynced).toBe(true);
    expect(getModuleIcon(chickenFarms)).toBe(syncedModuleIcon);
  });

  it("does not let a preset icon override the synced icon", () => {
    expect(moduleIcons.forestry).toBeDefined();

    expect(getModuleIcon({ id: "forestry", gameSynced: true })).toBe(syncedModuleIcon);
    expect(getModuleIcon({ id: "another-area", gameSynced: true })).toBe(syncedModuleIcon);
  });
});

describe("ModuleSwitcher", () => {
  const liveArea = {
    zoneId: 42,
    trackedBuildings: 0,
    constructedBuildings: 0,
    activeBuildings: 0,
    pausedBuildings: 0,
    constructionGhosts: 0,
    issues: [],
  };
  const pinnedDefault = createModule("general", "Default");
  const pinnedChickenFarms = createModule("chicken-farms", "Chicken Farms", {
    gameSynced: true,
  });
  const focusView = createModule("focus", "Focus");
  const zetaArea = createModule("live-area-42", "Zeta Mine", {
    gameSynced: true,
    liveArea,
  });
  const alphaArea = createModule("live-area-43", "Alpha Works", {
    gameSynced: true,
    liveArea: { ...liveArea, zoneId: 43 },
  });

  it("groups views and presets before synced tabs without reordering a group", () => {
    const { presetModules, syncedModules, viewModules } = getModuleTabGroups([
      zetaArea,
      pinnedDefault,
      alphaArea,
      focusView,
      pinnedChickenFarms,
    ], new Set(["focus"]));

    expect(viewModules.map(({ name }) => name)).toEqual(["Focus"]);
    expect(presetModules.map(({ name }) => name)).toEqual(["Default"]);
    expect(syncedModules.map(({ name }) => name)).toEqual([
      "Zeta Mine",
      "Alpha Works",
      "Chicken Farms",
    ]);
  });
});
