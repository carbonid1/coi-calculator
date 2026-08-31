import { describe, expect, it } from "vitest";

import { GREENHOUSES_MODULE_ID } from "../db/modules/farms";
import { FORESTRY_MODULE_ID } from "../db/modules/forestry";
import { MINES_MODULE_ID } from "../db/modules/mines";
import { modules, type Module } from "../db/modules/modules";
import { RESERVES_MODULE_ID } from "../db/modules/reserves";
import {
  getModuleIcon,
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
  const syncedDefault = createModule("general", "Default", {
    gameSynced: true,
  });
  const syncedChickenFarms = createModule("chicken-farms", "Chicken Farms", {
    gameSynced: true,
  });
  const focusView = createModule("focus", "Focus");
  const minesView = createModule("mines", "Mines");
  const reservesView = createModule("reserves", "Reserves");
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
      syncedDefault,
      alphaArea,
      focusView,
      minesView,
      reservesView,
      syncedChickenFarms,
    ], new Set(["focus", "mines", "reserves"]));

    expect(viewModules.map(({ name }) => name)).toEqual(["Focus", "Mines", "Reserves"]);
    expect(presetModules).toEqual([]);
    expect(syncedModules.map(({ name }) => name)).toEqual([
      "Zeta Mine",
      "Default",
      "Alpha Works",
      "Chicken Farms",
    ]);
  });

  it("places dashboards in Views and game areas in Synced", () => {
    const { presetModules, syncedModules, viewModules } = getModuleTabGroups(
      modules,
      new Set([MINES_MODULE_ID, RESERVES_MODULE_ID]),
    );

    expect(viewModules.map(({ id }) => id)).toEqual([
      MINES_MODULE_ID,
      RESERVES_MODULE_ID,
    ]);
    expect(presetModules).toEqual([]);
    expect(syncedModules.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "general",
      FORESTRY_MODULE_ID,
      GREENHOUSES_MODULE_ID,
      "chicken-farms",
    ]));
  });
});
