import { type SyncedProductionEntity } from "../../game-state";
import { resolveNuclearEntityInventory } from "../../helpers/nuclear-entity-sync/nuclear-entity-sync";
import { resolveDirectionalPlan } from "../../helpers/resolve-layered-value/resolve-directional-plan";
import {
  emptyPlanningBaselines,
  type PlanningBaselines,
} from "../planning-baselines";
import {
  type Module,
  type PlanMismatch,
  type Preset,
} from "./modules";
import { createAtLeastBuildingActions } from "./plan-mismatch";

export const NUCLEAR_MODULE_ID = "nuclear";
const BUILT_HYDROGEN_REFORMER_COUNT = 8;
const ACTIVE_HYDROGEN_REFORMER_COUNT = 8;
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

interface NuclearOperationTarget {
  name: string;
  pluralName?: string;
  recipeId: string;
  target: number;
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
  chlorineProcessingCount: 2,
  saltProcessingCount: 2,
  superDesalinatorCount: 9,
  seawaterPumpCount: 6,
};

export const createNuclearModule = (
  config: NuclearConfig,
  baselines: PlanningBaselines = emptyPlanningBaselines,
  plan?: NuclearOperationPlan,
  syncedEntities?: readonly SyncedProductionEntity[],
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
  const modeledGenerationCapacityMw = powerReactorSuperSteam
    * (15 + 10 + 5)
    / 48;
  const generationTargetMw = Math.max(
    0,
    plan?.generationTargetMw ?? baselines.averageGeneratorOutputMw,
  );
  const dispatchedGenerationMw = Math.min(
    modeledGenerationCapacityMw,
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

  const modeledBuiltBuildings: Record<string, number> = {
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
  };
  const modeledActiveBuildings: Record<string, number> = {
    "fbr-0x": nonBreederReactors,
    "fbr-3x": breederReactors,
    "seawater-pump": SEAWATER_PUMP_COUNT,
    "nuclear-reprocessing": reprocessingCount,
    "enrichment-plant": enrichmentCount,
    "chemical-plant-yellowcake": enrichmentCount,
    "turbine-super": activeTurbineCount,
    "turbine-high": activeTurbineCount,
    "turbine-low": activeTurbineCount,
    "power-generator-ii-nuclear": activeTurbineCount * 2,
    "hydrogen-reformer-super": ACTIVE_HYDROGEN_REFORMER_COUNT,
    "thermal-desalinator-depleted": DEPLETED_DESALINATOR_COUNT,
    "thermal-desalinator-super": SUPER_DESALINATOR_COUNT,
    "electrolyzer-ii-chlorine": ACTIVE_CHLORINE_PROCESSING_COUNT,
    "evaporation-pond-heated-salt-brine": ACTIVE_SALT_PROCESSING_COUNT,
    "cooling-tower-large-super": ACTIVE_COOLING_TOWER_COUNT,
    "cooling-tower-large-depleted": ACTIVE_COOLING_TOWER_COUNT,
    "nuclear-liquid-dump-water": 1,
    "nuclear-liquid-dump-brine": 1,
    "nuclear-smoke-stack-large-oxygen": 1,
    "radioactive-waste-storage": wasteStorageCount,
    "shredder-retired-waste": shredderCount,
  };
  const syncedInventory = syncedEntities
    ? resolveNuclearEntityInventory(syncedEntities)
    : null;
  const recipeIds = new Set([
    ...Object.keys(modeledBuiltBuildings),
    ...Object.keys(syncedInventory?.counts ?? {}),
  ]);
  const builtBuildings = syncedInventory
    ? Object.fromEntries([...recipeIds].map(recipeId => [
        recipeId,
        syncedInventory.counts[recipeId]?.built ?? 0,
      ]))
    : modeledBuiltBuildings;
  const currentActiveBuildings = syncedInventory
    ? Object.fromEntries([...recipeIds].map(recipeId => [
        recipeId,
        syncedInventory.counts[recipeId]?.running ?? 0,
      ]))
    : modeledActiveBuildings;
  const activeBuildings = { ...currentActiveBuildings };
  const speedLevels: Record<string, number> = syncedInventory
    ? {
        ...syncedInventory.speedLevels,
        "fbr-0x": syncedInventory.speedLevels["fbr-0x"] ?? nonBreederPowerLevel,
        "fbr-3x": syncedInventory.speedLevels["fbr-3x"] ?? breederPowerLevel,
      }
    : {
        "fbr-0x": nonBreederPowerLevel,
        "fbr-3x": breederPowerLevel,
      };
  const dataSources: NonNullable<Preset["dataSources"]> = syncedInventory
    ? Object.fromEntries([...recipeIds].map(recipeId => [recipeId, "synced" as const]))
    : {};
  const planMismatches: PlanMismatch[] = [];
  const operationTargets: NuclearOperationTarget[] = plan
    ? [
        {
          name: "Hydrogen Reformer",
          recipeId: "hydrogen-reformer-super",
          target: plan.hydrogenReformerCount,
        },
        {
          name: "Electrolyzer II",
          pluralName: "Electrolyzers II",
          recipeId: "electrolyzer-ii-chlorine",
          target: plan.chlorineProcessingCount,
        },
        {
          name: "Evaporation Pond (Heated)",
          pluralName: "Evaporation Ponds (Heated)",
          recipeId: "evaporation-pond-heated-salt-brine",
          target: plan.saltProcessingCount,
        },
        {
          name: "Thermal Desalinator",
          recipeId: "thermal-desalinator-super",
          target: plan.superDesalinatorCount,
        },
        {
          name: "Super-Pressure Turbine",
          recipeId: "turbine-super",
          target: activeTurbineCount,
        },
        {
          name: "High-Pressure Turbine II",
          pluralName: "High-Pressure Turbines II",
          recipeId: "turbine-high",
          target: activeTurbineCount,
        },
        {
          name: "Low-Pressure Turbine II",
          pluralName: "Low-Pressure Turbines II",
          recipeId: "turbine-low",
          target: activeTurbineCount,
        },
        {
          name: "Power Generator II",
          pluralName: "Power Generators II",
          recipeId: "power-generator-ii-nuclear",
          target: activeTurbineCount * 2,
        },
      ]
    : [];

  for (const target of operationTargets) {
    const current = currentActiveBuildings[target.recipeId] ?? 0;
    const resolved = resolveDirectionalPlan(
      syncedInventory ? { default: 0, synced: current } : { default: current },
      { direction: "at-least", target: target.target },
    );

    activeBuildings[target.recipeId] = resolved.value;
    if (resolved.satisfied) continue;

    dataSources[target.recipeId] = "planned";
    planMismatches.push({
      recipeId: target.recipeId,
      current: resolved.current.value,
      currentSource: resolved.current.source,
      target: resolved.target,
      direction: resolved.direction,
      format: "count",
      actions: createAtLeastBuildingActions({
        built: builtBuildings[target.recipeId] ?? 0,
        running: current,
        target: resolved.target,
        name: target.name,
        pluralName: target.pluralName,
      }),
    });
  }

  if (plan) {
    const standardRecipeId = "seawater-pump";
    const tallRecipeId = "seawater-pump-tall";
    const standardBuilt = builtBuildings[standardRecipeId] ?? 0;
    const tallBuilt = builtBuildings[tallRecipeId] ?? 0;
    const standardRunning = currentActiveBuildings[standardRecipeId] ?? 0;
    const tallRunning = currentActiveBuildings[tallRecipeId] ?? 0;
    const current = standardRunning + tallRunning;
    const resolved = resolveDirectionalPlan(
      syncedInventory ? { default: 0, synced: current } : { default: current },
      { direction: "at-least", target: plan.seawaterPumpCount },
    );

    if (!resolved.satisfied) {
      // The operation plan is an aggregate fast-pump capacity target. Preserve
      // each exact game prototype in the inventory and consume installed paused
      // capacity before planning ordinary T1 construction.
      const standardUnpause = Math.min(
        Math.max(0, standardBuilt - standardRunning),
        resolved.difference,
      );
      const afterStandard = resolved.difference - standardUnpause;
      const tallUnpause = Math.min(
        Math.max(0, tallBuilt - tallRunning),
        afterStandard,
      );
      const standardBuild = afterStandard - tallUnpause;
      const standardTarget = standardRunning + standardUnpause + standardBuild;
      const tallTarget = tallRunning + tallUnpause;

      activeBuildings[standardRecipeId] = standardTarget;
      if (tallRecipeId in builtBuildings || tallTarget > 0) {
        activeBuildings[tallRecipeId] = tallTarget;
      }
      if (standardTarget !== standardRunning) {
        dataSources[standardRecipeId] = "planned";
        planMismatches.push({
          recipeId: standardRecipeId,
          current: standardRunning,
          currentSource: resolved.current.source,
          target: standardTarget,
          direction: resolved.direction,
          format: "count",
          actions: createAtLeastBuildingActions({
            built: standardBuilt,
            running: standardRunning,
            target: standardTarget,
            name: "Seawater Pump",
          }),
        });
      }
      if (tallTarget !== tallRunning) {
        dataSources[tallRecipeId] = "planned";
        planMismatches.push({
          recipeId: tallRecipeId,
          current: tallRunning,
          currentSource: resolved.current.source,
          target: tallTarget,
          direction: resolved.direction,
          format: "count",
          actions: createAtLeastBuildingActions({
            built: tallBuilt,
            running: tallRunning,
            target: tallTarget,
            name: "Seawater Pump (Tall)",
            pluralName: "Seawater Pumps (Tall)",
          }),
        });
      }
    }
  }

  if (plan && !syncedInventory) {
    dataSources["turbine-super"] = "planned";
    dataSources["turbine-high"] = "planned";
    dataSources["turbine-low"] = "planned";
    dataSources["power-generator-ii-nuclear"] = "planned";
  }

  const syncedGenerationCapacityMw = (
    (builtBuildings["fbr-0x"] ?? 0) * (speedLevels["fbr-0x"] ?? 1) * 96
    + (builtBuildings.fbr ?? 0) * (speedLevels.fbr ?? 1) * 96
    + (builtBuildings["fbr-3x"] ?? 0) * (speedLevels["fbr-3x"] ?? 1) * 24
  ) * (15 + 10 + 5) / 48;
  const generationCapacityMw = syncedInventory
    ? syncedGenerationCapacityMw
    : modeledGenerationCapacityMw;
  const syncedReactorCount = (builtBuildings["fbr-0x"] ?? 0)
    + (builtBuildings.fbr ?? 0)
    + (builtBuildings["fbr-3x"] ?? 0);
  const description = syncedInventory
    ? `${syncedReactorCount} ${syncedReactorCount === 1 ? "FBR" : "FBRs"} synced from the Nuclear area; ${generationCapacityMw} MW configured capacity`
    : `${breederReactors + nonBreederReactors} FBR build: ${breederReactors} breeder at Power ${breederPowerLevel} / 3x + ${nonBreederReactors} power reactor at Power ${nonBreederPowerLevel} / 0x; ${generationCapacityMw} MW capacity`;

  return {
    id: NUCLEAR_MODULE_ID,
    name: "Nuclear",
    description,
    builtBuildings,
    presets: [
      {
        id: "configured-target",
        name: "Configured target",
        description: syncedInventory
          ? "Current Nuclear-area inventory with pending operation targets layered on top"
          : `${breederReactors} breeder at Power ${breederPowerLevel} / 3x and ${nonBreederReactors} power reactor at Power ${nonBreederPowerLevel} / 0x`,
        builtBuildings,
        activeBuildings,
        dataSources: Object.keys(dataSources).length > 0 ? dataSources : undefined,
        planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
        fixed: [
          "fbr-0x",
          "fbr",
          "fbr-3x",
        ],
        speedLevels,
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
