import { type Module } from "./modules";

export const general: Module = {
  id: "general",
  name: "General",
  description: "Shared production capacity for yellowcake and supporting materials",
  buildingTotals: {
    "crusher-large": 3,
    "settling-tank": 2,
    "mixer-ii-acid": 1,
    "assembly-v-electronics-i": 1,
    "rubber-maker-ethanol": 1,
    "chemical-plant-ii-ethanol": 1,
    "chemical-plant-ii-graphite": 1,
    "copper-electrolysis-acid": 1,
  },
  presets: [
    {
      id: "yellowcake",
      name: "Yellowcake",
      description: "1 of 3 large crushers active + 2 settling tanks with demand-balanced acid",
      buildingTotals: {
        "crusher-large": 3,
        "settling-tank": 2,
        "mixer-ii-acid": 1,
        "assembly-v-electronics-i": 1,
        "rubber-maker-ethanol": 1,
        "chemical-plant-ii-ethanol": 1,
        "chemical-plant-ii-graphite": 1,
        "copper-electrolysis-acid": 1,
      },
      available: {
        "settling-tank": 2,
      },
      fixed: ["settling-tank"],
    },
  ],
  defaultPresetId: "yellowcake",
};
