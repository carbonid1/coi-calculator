import { type Module } from "./modules";

export const MINES_MODULE_ID = "mines";

export const mines: Module = {
    id: MINES_MODULE_ID,
    name: "Mines",
    description: "World-mine supply and terrain disposal.",
    builtBuildings: {
      "sulfur-world-mine": 1,
      "slag-terrain-dump": 1,
      "waste-terrain-dump": 1,
      "dirt-terrain-dump": 1,
    },
    presets: [{
      id: "current-mines-plan",
      name: "Current Mines Plan",
      description: "Current world-mine sources and terrain disposal",
      activeBuildings: {},
      fixed: [],
    }],
    defaultPresetId: "current-mines-plan",
};
