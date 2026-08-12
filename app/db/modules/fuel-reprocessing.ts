import { type Module } from "./modules";

export const fuelReprocessing: Module = {
  id: "fuel-reprocessing",
  name: "Nuclear Fuel",
  description: "Nuclear fuel cycle — reprocess spent fuel into usable core fuel",
  builtBuildings: {
    "nuclear-reprocessing": 1,
    "enrichment-plant": 1,
    "nuclear-reprocessing-spent-fuel": 1,
    "nuclear-reprocessing-spent-mox": 1,
  },
  externalInputs: {
    coreFuelSpent: 4,
    blanketFuelEnriched: 4,
  },
  presets: [
    {
      id: "default",
      name: "Default",
      description: "Spent fuel reprocessing active, no MOX",
      activeBuildings: {
        "nuclear-reprocessing": 0.25,
        "enrichment-plant": 0.5,
        "nuclear-reprocessing-spent-fuel": 1,
        "nuclear-reprocessing-spent-mox": 0,
      },
      fixed: ["nuclear-reprocessing", "enrichment-plant", "nuclear-reprocessing-spent-fuel", "nuclear-reprocessing-spent-mox"],
    },
    {
      id: "with-mox",
      name: "With MOX",
      description: "Both spent fuel and spent MOX reprocessing active",
      activeBuildings: {
        "nuclear-reprocessing": 0.25,
        "enrichment-plant": 0.5,
        "nuclear-reprocessing-spent-fuel": 1,
        "nuclear-reprocessing-spent-mox": 1,
      },
      fixed: ["nuclear-reprocessing", "enrichment-plant", "nuclear-reprocessing-spent-fuel", "nuclear-reprocessing-spent-mox"],
    },
  ],
  defaultPresetId: "default",
};
