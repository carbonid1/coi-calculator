import { type Module } from "./modules";

export const MINES_MODULE_ID = "mines";

export const mines: Module = {
  id: MINES_MODULE_ID,
  name: "Mines",
  description: "",
  builtBuildings: {
    "copper-map-mine": 1,
    "iron-map-mine": 1,
    "limestone-map-mine": 1,
    "gold-map-mine": 1,
    "bauxite-map-mine": 1,
    "titanium-map-mine": 1,
    "sand-map-mine": 1,
    "rock-map-mine": 1,
    "dirt-map-mine": 1,
    "groundwater-pump-factory-reserve": 1,
    "sulfur-world-mine": 1,
    "slag-terrain-dump": 1,
    "waste-terrain-dump": 1,
    "dirt-terrain-dump": 1,
  },
  presets: [],
  defaultPresetId: null,
};
