import {
  emptyPlanningBaselines,
  type PlanningBaselines,
} from "../planning-baselines";
import { type Module } from "./modules";

export const NUCLEAR_MODULE_ID = "nuclear";
const BUILT_HYDROGEN_REFORMER_COUNT = 6;
const ACTIVE_HYDROGEN_REFORMER_COUNT = 5;
const SEAWATER_PUMP_COUNT = 4;
const DEPLETED_DESALINATOR_COUNT = 4;
const SUPER_DESALINATOR_COUNT = 6;
const BUILT_BRINE_PROCESSING_COUNT = 2;
const ACTIVE_CHLORINE_PROCESSING_COUNT = 1;
const ACTIVE_SALT_PROCESSING_COUNT = 1;
const BUILT_COOLING_TOWER_COUNT = 4;
const ACTIVE_COOLING_TOWER_COUNT = 4;

export interface NuclearConfig {
  breederReactors: number;
  breederPowerLevel: 1 | 2 | 3 | 4;
  nonBreederReactors: number;
  nonBreederPowerLevel: 1 | 2 | 3 | 4;
}

export interface NuclearOperationPlan {
  generationTargetMw: number;
  hydrogenReformerCount: number;
  chlorineProcessingCount: number;
  saltProcessingCount: number;
  superDesalinatorCount: number;
  seawaterPumpCount: number;
}

export const defaultNuclearConfig: NuclearConfig = {
  breederReactors: 1,
  breederPowerLevel: 1,
  nonBreederReactors: 1,
  nonBreederPowerLevel: 4,
};

export const plannedNuclearOperation: NuclearOperationPlan = {
  // Use the installed turbine trains before adding another generator build.
  generationTargetMw: 159,
  hydrogenReformerCount: 8,
  chlorineProcessingCount: 3,
  saltProcessingCount: 3,
  superDesalinatorCount: 10,
  seawaterPumpCount: 6,
};

export const createNuclearModule = (
  config: NuclearConfig,
  baselines: PlanningBaselines = emptyPlanningBaselines,
  plan?: NuclearOperationPlan,
): Module => {
  const breederReactors = Math.max(0, Math.trunc(config.breederReactors));
  const nonBreederReactors = Math.max(0, Math.trunc(config.nonBreederReactors));
  const breederPowerLevel = config.breederPowerLevel;
  const nonBreederPowerLevel = config.nonBreederPowerLevel;
  const spentCoreFuel = breederReactors * 4 * breederPowerLevel
    + nonBreederReactors * 2 * nonBreederPowerLevel;
  const enrichedBlanketFuel = breederReactors * 12 * breederPowerLevel;
  const powerReactorSuperSteam = nonBreederReactors * 96 * nonBreederPowerLevel;
  const fissionProducts = spentCoreFuel / 8;
  const generationCapacityMw = powerReactorSuperSteam
    * (15 + 10 + 5)
    / 48;
  const generationTargetMw = Math.max(
    0,
    plan?.generationTargetMw ?? baselines.averageGeneratorOutputMw,
  );
  const dispatchedGenerationMw = Math.min(
    generationCapacityMw,
    generationTargetMw,
  );
  const turbineSteamPerCycle = dispatchedGenerationMw * 48 / (15 + 10 + 5);
  const hydrogenDemandPerCycle = Math.max(0, baselines.hydrogenFuelDemandPerCycle);
  const activeTurbineCount = Math.ceil(turbineSteamPerCycle / 48);
  const builtTurbineCount = Math.ceil(powerReactorSuperSteam / 48);
  const reprocessingCount = Math.ceil(spentCoreFuel / 16);
  const enrichmentCount = Math.ceil(enrichedBlanketFuel / 8);
  const wasteStorageCount = Math.ceil(fissionProducts / 2);
  const shredderCount = Math.ceil(fissionProducts / 6);

  return {
    id: NUCLEAR_MODULE_ID,
    name: "Nuclear",
    description: `${breederReactors + nonBreederReactors} FBR build: ${breederReactors} breeder at Power ${breederPowerLevel} / 3x + ${nonBreederReactors} power reactor at Power ${nonBreederPowerLevel} / 0x; ${generationCapacityMw} MW capacity`,
    builtBuildings: {},
    presets: [
      {
        id: "configured-target",
        name: "Configured target",
        description: `${breederReactors} breeder at Power ${breederPowerLevel} / 3x and ${nonBreederReactors} power reactor at Power ${nonBreederPowerLevel} / 0x`,
        builtBuildings: {
          "fbr-0x": nonBreederReactors,
          "fbr-3x": breederReactors,
          "seawater-pump": SEAWATER_PUMP_COUNT,
          "nuclear-reprocessing": reprocessingCount,
          "enrichment-plant": enrichmentCount,
          "chemical-plant-yellowcake": enrichmentCount,
          "turbine-super": builtTurbineCount,
          "turbine-high": builtTurbineCount,
          "turbine-low": builtTurbineCount,
          "power-generator-ii-nuclear": builtTurbineCount * 2,
          "hydrogen-reformer-super": BUILT_HYDROGEN_REFORMER_COUNT,
          "thermal-desalinator-depleted": DEPLETED_DESALINATOR_COUNT,
          "thermal-desalinator-super": SUPER_DESALINATOR_COUNT,
          "electrolyzer-ii-chlorine": BUILT_BRINE_PROCESSING_COUNT,
          "evaporation-pond-heated-salt-brine": BUILT_BRINE_PROCESSING_COUNT,
          "cooling-tower-large-super": BUILT_COOLING_TOWER_COUNT,
          "cooling-tower-large-depleted": BUILT_COOLING_TOWER_COUNT,
          "nuclear-liquid-dump-water": 1,
          "nuclear-liquid-dump-brine": 1,
          "nuclear-smoke-stack-large-oxygen": 1,
          "radioactive-waste-storage": wasteStorageCount,
          "shredder-retired-waste": shredderCount,
        },
        activeBuildings: {
          "fbr-0x": nonBreederReactors,
          "fbr-3x": breederReactors,
          "seawater-pump": plan?.seawaterPumpCount ?? SEAWATER_PUMP_COUNT,
          "nuclear-reprocessing": reprocessingCount,
          "enrichment-plant": enrichmentCount,
          "chemical-plant-yellowcake": enrichmentCount,
          "turbine-super": activeTurbineCount,
          "turbine-high": activeTurbineCount,
          "turbine-low": activeTurbineCount,
          "power-generator-ii-nuclear": activeTurbineCount * 2,
          "hydrogen-reformer-super": plan?.hydrogenReformerCount
            ?? ACTIVE_HYDROGEN_REFORMER_COUNT,
          "thermal-desalinator-depleted": DEPLETED_DESALINATOR_COUNT,
          "thermal-desalinator-super": plan?.superDesalinatorCount
            ?? SUPER_DESALINATOR_COUNT,
          "electrolyzer-ii-chlorine": plan?.chlorineProcessingCount
            ?? ACTIVE_CHLORINE_PROCESSING_COUNT,
          "evaporation-pond-heated-salt-brine": plan?.saltProcessingCount
            ?? ACTIVE_SALT_PROCESSING_COUNT,
          "cooling-tower-large-super": ACTIVE_COOLING_TOWER_COUNT,
          "cooling-tower-large-depleted": ACTIVE_COOLING_TOWER_COUNT,
          "nuclear-liquid-dump-water": 1,
          "nuclear-liquid-dump-brine": 1,
          "nuclear-smoke-stack-large-oxygen": 1,
          "radioactive-waste-storage": wasteStorageCount,
          "shredder-retired-waste": shredderCount,
        },
        dataSources: plan
          ? {
              "turbine-super": "planned",
              "turbine-high": "planned",
              "turbine-low": "planned",
              "power-generator-ii-nuclear": "planned",
              "hydrogen-reformer-super": "planned",
              "electrolyzer-ii-chlorine": "planned",
              "evaporation-pond-heated-salt-brine": "planned",
              "thermal-desalinator-super": "planned",
              "seawater-pump": "planned",
            }
          : undefined,
        fixed: [
          "fbr-0x",
          "fbr-3x",
        ],
        speedLevels: {
          "fbr-0x": nonBreederPowerLevel,
          "fbr-3x": breederPowerLevel,
        },
        fixedDemands: {
          hydrogen: hydrogenDemandPerCycle,
        },
        electricityDispatchTargets: {
          "fbr-turbines": generationTargetMw,
        },
      },
    ],
    defaultPresetId: "configured-target",
  };
};

export const nuclear = createNuclearModule(
  defaultNuclearConfig,
  emptyPlanningBaselines,
);
