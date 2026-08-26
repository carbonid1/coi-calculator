import { type Module } from "./modules";

export const PROCESS_STEAM_MODULE_ID = "process-steam";

export const plannedProcessSteamBuildings = {
  "distillation-stage-iii-titanium-purification": 1,
} as const;

export const plannedProcessSteamBuiltBuildings = Object.fromEntries(
  Object.keys(plannedProcessSteamBuildings).map((recipeId) => [recipeId, 0]),
);

/**
 * The island's compact process-steam cluster. Building counts were recorded
 * from the v0.8.6c production panels supplied with the planning baseline.
 */
export const processSteam: Module = {
  id: PROCESS_STEAM_MODULE_ID,
  name: "Process Steam",
  description: "Incinerator-backed steam for paper, sour-water recovery, and planned Titanium purification",
  builtBuildings: {
    "chemical-plant-ii-paper": 2,
    "sour-water-stripper": 1,
    "incineration-plant-waste": 1,
    ...plannedProcessSteamBuiltBuildings,
  },
  presets: [{
    id: "current-and-planned-process-steam",
    name: "Current and planned process steam",
    description: "Current steam cluster with planned Titanium purification",
    activeBuildings: plannedProcessSteamBuildings,
    dataSources: {
      "distillation-stage-iii-titanium-purification": "planned",
    },
    fixed: [],
  }],
  defaultPresetId: "current-and-planned-process-steam",
};
