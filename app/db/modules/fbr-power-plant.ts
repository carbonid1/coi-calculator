import { type Module } from "./modules";

// Steam / water / hydrogen infrastructure for the YC-fed plant. Surplus is
// absorbed by cooling, desalination, and reforming in priority order.
const plantInfra = {
  "seawater-pump": 4,
  "turbine-super": 2,
  "turbine-high": 2,
  "turbine-low": 2,
  "thermal-desalinator-depleted": 2,
  "thermal-desalinator-super": 6,
  "hydrogen-reformer-super": 2,
  "cooling-tower-large-depleted": 1,
  "cooling-tower-large-super": 1,
};

const fuelPinnedYc = ["fbr"];

export const fbrPowerPlant: Module = {
  id: "fbr-power-plant",
  name: "FBR Power Plant",
  description: "YC-fed no-breed mode with shared plant infrastructure",
  buildingTotals: {}, // presets define their own
  presets: [
    {
      id: "1fbr-yc",
      name: "1 FBR — YC, no breed",
      description: "60 MW — 3 YC/60s (18 UO), power level I, no EU20",
      buildingTotals: {
        "fbr": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1,
        "chemical-plant-yellowcake": 1,
        "radioactive-waste-storage": 1,
        "shredder-retired-waste": 1,
        ...plantInfra,
      },
      active: {
        "fbr": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1,
        "chemical-plant-yellowcake": 1,
        "radioactive-waste-storage": 1,
        "shredder-retired-waste": 1,
      },
      pinned: fuelPinnedYc,
      incomingFromModules: ["yellowcake"],
    },
  ],
  defaultPresetId: "1fbr-yc",
};
