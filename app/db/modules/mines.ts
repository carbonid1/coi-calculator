import { type Module } from "./modules";

export const MINES_MODULE_ID = "mines";

export const mines: Module = {
  id: MINES_MODULE_ID,
  name: "Mines",
  description: "Demand-balanced extraction after factory production is counted",
  buildingTotals: {
    "copper-map-mine": 1,
    "gold-map-mine": 1,
    "sand-map-mine": 1,
    "rock-map-mine": 1,
    "sulfur-world-mine": 1,
  },
  presets: [],
  defaultPresetId: null,
};
