import { type Module } from "./modules";

export const FORESTRY_MODULE_ID = "forestry";

export const forestry: Module = {
  id: FORESTRY_MODULE_ID,
  name: "Forestry",
  description: "Wood processing for downstream production chains",
  builtBuildings: {
    "forestry-trees-100-growth": 1,
    "shredder-woodchips": 1,
  },
  presets: [{
    id: "wood-shredder-paused",
    name: "Wood shredder paused",
    description: "The built wood Shredder is currently paused",
    activeBuildings: {
      "forestry-trees-100-growth": 1,
      "shredder-woodchips": 0,
    },
    fixed: [],
  }],
  defaultPresetId: "wood-shredder-paused",
};
