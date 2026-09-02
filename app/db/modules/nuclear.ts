import { type SyncedProductionEntity } from "../../game-state";
import {
  nuclearHandledPrototypeIds,
  resolveNuclearEntityInventory,
} from "../../helpers/nuclear-entity-sync/nuclear-entity-sync";
import { resolveDirectionalPlan } from "../../helpers/resolve-layered-value/resolve-directional-plan";
import { type PlanningBaselines } from "../planning-baselines";
import {
  type Module,
  type PlanMismatch,
  type Preset,
} from "./modules";
import { createAtLeastBuildingActions } from "./plan-mismatch";

export const NUCLEAR_MODULE_ID = "nuclear";

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
  baselines: PlanningBaselines,
  plan: NuclearOperationPlan | undefined,
  syncedEntities: readonly SyncedProductionEntity[],
  generatedArea?: Module,
): Module => {
  const syncedInventory = resolveNuclearEntityInventory(
    syncedEntities,
    generatedArea?.liveArea?.zoneId,
  );
  const nonBreederReactors = syncedInventory.counts["fbr-0x"]?.running ?? 0;
  const nonBreederPowerLevel = syncedInventory.speedLevels["fbr-0x"] ?? 0;
  const powerReactorSuperSteam = nonBreederReactors * 96 * nonBreederPowerLevel;
  const syncedGenerationCapacityMw = powerReactorSuperSteam
    * (15 + 10 + 5)
    / 48;
  const generationTargetMw = Math.max(
    0,
    plan?.generationTargetMw ?? baselines.averageGeneratorOutputMw,
  );
  const dispatchedGenerationMw = Math.min(
    syncedGenerationCapacityMw,
    generationTargetMw,
  );
  const turbineSteamPerCycle = dispatchedGenerationMw * 48 / (15 + 10 + 5);
  const hydrogenDemandPerCycle = Math.max(0, baselines.hydrogenFuelDemandPerCycle);
  const activeTurbineCount = Math.ceil(turbineSteamPerCycle / 48);
  const recipeIds = Object.keys(syncedInventory.counts);
  const builtBuildings = Object.fromEntries(recipeIds.map(recipeId => [
    recipeId,
    syncedInventory.counts[recipeId]?.built ?? 0,
  ]));
  const currentActiveBuildings = Object.fromEntries(recipeIds.map(recipeId => [
    recipeId,
    syncedInventory.counts[recipeId]?.running ?? 0,
  ]));
  const activeBuildings = { ...currentActiveBuildings };
  const speedLevels: Record<string, number> = { ...syncedInventory.speedLevels };
  const dataSources: NonNullable<Preset["dataSources"]> = Object.fromEntries(
    recipeIds.map(recipeId => [recipeId, "synced" as const]),
  );
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
      { default: 0, synced: current },
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
      { default: 0, synced: current },
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

  const liveArea = generatedArea?.liveArea
    ? {
        ...generatedArea.liveArea,
        issues: generatedArea.liveArea.issues.filter(issue => (
          ![...nuclearHandledPrototypeIds].some(prototypeId => (
            issue.id.startsWith(`${prototypeId}:`)
          ))
        )),
      }
    : undefined;

  return {
    id: generatedArea?.id ?? NUCLEAR_MODULE_ID,
    name: generatedArea?.name ?? "Nuclear",
    description: "",
    gameSynced: true,
    capabilities: generatedArea?.capabilities ?? ["nuclear"],
    includedInFactoryTotals: generatedArea ? true : undefined,
    builtBuildings,
    presets: [
      {
        id: "configured-target",
        name: "Configured target",
        description: "",
        builtBuildings,
        activeBuildings,
        currentActiveBuildings,
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
    liveArea,
  };
};
