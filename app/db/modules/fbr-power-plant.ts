import { type Module } from "./modules";

// Steam / water / hydrogen infrastructure for the YC-fed plant. Electricity
// demand gets turbine priority; surplus steam then goes to reforming,
// desalination, and finally cooling.
const plantInfra = {
  "seawater-pump": 4,
  "turbine-super": 2,
  "turbine-high": 2,
  "turbine-low": 2,
  "thermal-desalinator-depleted": 2,
  "thermal-desalinator-super": 6,
  "hydrogen-reformer-super": 4,
  "cooling-tower-large-depleted": 1,
  "cooling-tower-large-super": 1,
};

const fuelFixedYc = ["fbr"];

export const fbrPowerPlant: Module = {
  id: "fbr-power-plant",
  name: "FBR Power Plant",
  description: "YC-fed no-breed mode; turbines follow factory demand after solar",
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
      available: {
        "fbr": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1,
        "chemical-plant-yellowcake": 1,
        "radioactive-waste-storage": 1,
        "shredder-retired-waste": 1,
      },
      fixed: fuelFixedYc,
    },
  ],
  defaultPresetId: "1fbr-yc",
};
