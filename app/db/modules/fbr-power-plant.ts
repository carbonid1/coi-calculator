import {
  defaultPlanningBaselines,
  type PlanningBaselines,
} from "../planning-baselines";
import { type Module } from "./modules";

export const FBR_POWER_PLANT_MODULE_ID = "fbr-power-plant";
export const FBR_ELECTRICITY_DISPATCH_GROUP_ID = "fbr-turbines";

// Steam / water / hydrogen infrastructure for the YC-fed plant. Electricity
// demand gets turbine priority; surplus steam then goes to reforming,
// desalination, and finally cooling.
const plantInfra = {
  "seawater-pump": 2,
  "turbine-super": 2,
  "turbine-high": 2,
  "turbine-low": 2,
  "thermal-desalinator-depleted": 2,
  "thermal-desalinator-low": 1,
  "thermal-desalinator-super": 2,
  "hydrogen-reformer-super": 3,
  "cooling-tower-large-depleted": 1,
  "cooling-tower-large-super": 1,
};

const fuelFixedYc = ["fbr"];

export const createFbrPowerPlantModule = (baselines: PlanningBaselines): Module => ({
  id: FBR_POWER_PLANT_MODULE_ID,
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
      fixedDemands: {
        hydrogen: Math.max(0, baselines.hydrogenFuelDemandPerCycle),
      },
      electricityDispatchTargets: {
        [FBR_ELECTRICITY_DISPATCH_GROUP_ID]: Math.max(0, baselines.fbrAverageGenerationMw),
      },
    },
  ],
  defaultPresetId: "1fbr-yc",
});

export const fbrPowerPlant = createFbrPowerPlantModule(defaultPlanningBaselines);
