import { type Module } from "./modules";

export const PROCESS_STEAM_MODULE_ID = "process-steam";

/**
 * The island's compact process-steam cluster. Building counts were recorded
 * from the v0.8.6c production panels supplied with the planning baseline.
 */
export const processSteam: Module = {
  id: PROCESS_STEAM_MODULE_ID,
  name: "Process Steam",
  description: "Incinerator-backed steam for paper, titanium purification, and sour-water recovery",
  buildingTotals: {
    "shredder-woodchips": 1,
    "chemical-plant-ii-paper": 2,
    "distillation-stage-iii-titanium-purification": 1,
    "sour-water-stripper": 1,
    "incineration-plant-waste": 1,
  },
  presets: [],
  defaultPresetId: null,
};
