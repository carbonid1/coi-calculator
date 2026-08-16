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
    id: "wood-shredder-active",
    name: "Wood shredder active",
    description: "The built wood Shredder is active",
    activeBuildings: {
      "forestry-trees-100-growth": 1,
      "shredder-woodchips": 1,
    },
    fixed: [],
  }],
  defaultPresetId: "wood-shredder-active",
};
