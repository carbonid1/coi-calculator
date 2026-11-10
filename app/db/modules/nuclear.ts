import { type SyncedProductionEntity } from "../../game-state";
import { nuclearOrdinaryRecipeIds, resolveNuclearAreaRecipes } from '../../helpers/nuclear-entity-sync/nuclear-area-recipes';
import {
  nuclearSpecialPrototypeIds,
  nuclearSpecialRecipeBindings,
  resolveNuclearEntityInventory,
} from "../../helpers/nuclear-entity-sync/nuclear-entity-sync";
import { applyNuclearOperationTargets, applyNuclearTurbinePlan, applyTurbineAutoBalance, type NuclearOperationTarget, type NuclearTurbinePlan } from '../../helpers/nuclear-entity-sync/nuclear-operation-targets';
import { resolveDirectionalPlan } from '../../helpers/resolve-directional-plan';
import { type PlanningBaselines } from "../planning-baselines";
import {
  type Module,
  type Preset,
} from "./modules";

const NUCLEAR_MODULE_ID = "nuclear";

export interface NuclearOperationPlan {
  hydrogenReformerCount: number;
  chlorineProcessingCount: number;
  saltProcessingCount: number;
  superDesalinatorCount: number;
  powerReactorCount?: number;
  breederPowerLevel?: number;
  supportTargets?: readonly NuclearOperationTarget[];
  turbineRows?: NuclearTurbinePlan;
  turbineAutoBalanceOff?: Readonly<Record<string, number>>;
}

export const plannedNuclearOperation: NuclearOperationPlan = {
  hydrogenReformerCount: 8,
  chlorineProcessingCount: 2,
  saltProcessingCount: 2,
  superDesalinatorCount: 9,
};

export const thirdFbrNuclearOperation: NuclearOperationPlan = {
  ...plannedNuclearOperation,
  powerReactorCount: 2,
  breederPowerLevel: 2,
  superDesalinatorCount: 13,
  // FBR1 and FBR2 each run two rows; no spare construction is planned.
  turbineRows: { working: 4, standby: 0 },
  // Every working row keeps auto-balance off for fixed steam throughput.
  turbineAutoBalanceOff: { 'turbine-super': 8, 'turbine-high': 8, 'turbine-low': 8 },
  supportTargets: [
    { recipeId: 'nuclear-reprocessing', name: 'Nuclear reprocessing plant', target: 2 },
    { recipeId: 'enrichment-plant', name: 'Enrichment plant', target: 3 },
    { recipeId: 'radioactive-waste-storage', name: 'Nuclear waste storage', target: 2 },
    { recipeId: 'cooling-tower-large-depleted', name: 'Cooling tower (large)', target: 7 },
    { recipeId: 'seawater-pump', name: 'Seawater pump', target: 7 },
  ],
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
  const nonBreederPowerLevel = syncedInventory.speedLevels["fbr-0x"] ?? 0;
  const hydrogenDemandPerCycle = Math.max(0, baselines.hydrogenFuelDemandPerCycle);
  const liveRecipes = generatedArea?.recipes ? resolveNuclearAreaRecipes(generatedArea) : undefined;
  const areaPreset = generatedArea?.presets.find(preset => preset.id === generatedArea.defaultPresetId)
    ?? generatedArea?.presets[0];
  const specialConstructionGhosts = Object.fromEntries(nuclearSpecialRecipeBindings.flatMap(binding => {
    const count = areaPreset?.capacityPools?.[binding.prototypeId]?.constructionGhosts ?? 0;

    return count > 0 ? [[binding.recipeId, count]] : [];
  }));
  const constructionGhosts = { ...specialConstructionGhosts, ...liveRecipes?.preset.constructionGhosts };
  const recipeIds = [...new Set([...Object.keys(syncedInventory.counts), ...Object.keys(specialConstructionGhosts)])].filter(id => (
    !liveRecipes || !nuclearOrdinaryRecipeIds.has(id)
  ));
  const builtBuildings = { ...Object.fromEntries(recipeIds.map(recipeId => [
    recipeId,
    syncedInventory.counts[recipeId]?.built ?? 0,
  ])), ...liveRecipes?.builtBuildings };
  const currentActiveBuildings = { ...Object.fromEntries(recipeIds.map(recipeId => [
    recipeId,
    syncedInventory.counts[recipeId]?.running ?? 0,
  ])), ...liveRecipes?.preset.currentActiveBuildings };
  const activeBuildings = { ...Object.fromEntries(recipeIds.map(id => [
    id, (currentActiveBuildings[id] ?? 0) + (specialConstructionGhosts[id] ?? 0),
  ])), ...liveRecipes?.preset.activeBuildings };
  const speedLevels: Record<string, number> = { ...syncedInventory.speedLevels, ...liveRecipes?.preset.speedLevels };
  const dataSources: NonNullable<Preset["dataSources"]> = { ...Object.fromEntries(
    recipeIds.map(recipeId => [recipeId, "synced" as const]),
  ), ...liveRecipes?.preset.dataSources };
  const planMismatches = [...(liveRecipes?.preset.planMismatches ?? [])];

  if (plan?.breederPowerLevel != null && (syncedInventory.counts['fbr-3x']?.built ?? 0) > 0) {
    const current = syncedInventory.speedLevels['fbr-3x'] ?? 1;
    const power = resolveDirectionalPlan(current, { direction: 'at-least', target: plan.breederPowerLevel });

    speedLevels['fbr-3x'] = power.value;
    dataSources['fbr-3x'] = power.source;
    if (!power.satisfied) planMismatches.push({
      recipeId: 'fbr-3x', current, target: power.target,
      direction: power.direction, format: 'configuration',
      currentLabel: `${current * 100}% power`, targetLabel: `${power.target * 100}% power`,
      actions: [{ type: 'configure', label: `Set 3× enrichment FBR power to ${power.target * 100}%` }],
    });
  }
  const operationTargets: NuclearOperationTarget[] = plan
    ? [
        ...(plan.powerReactorCount == null ? [] : [{
          recipeId: 'fbr-0x',
          name: `Fast breeder reactor (0× enrichment, ${nonBreederPowerLevel * 100}% power)`,
          target: plan.powerReactorCount,
        }]),
        ...(plan.supportTargets ?? []),
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
      ]
    : [];

  const liveArea = generatedArea?.liveArea
    ? {
        ...generatedArea.liveArea,
        issues: generatedArea.liveArea.issues.filter(issue => (
          ![...nuclearSpecialPrototypeIds].some(prototypeId => (
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
    recipes: liveRecipes?.recipes,
    presets: [
      applyTurbineAutoBalance(applyNuclearTurbinePlan(applyNuclearOperationTargets({
        ...liveRecipes?.preset,
        id: "configured-target",
        name: "Configured target",
        description: "",
        builtBuildings,
        activeBuildings,
        currentActiveBuildings,
        constructionGhosts,
        autoBalanceOffBuildings: syncedInventory.autoBalanceOffBuildings,
        pausedAutoBalanceOffBuildings: syncedInventory.pausedAutoBalanceOffBuildings,
        planMismatches,
        dataSources: Object.keys(dataSources).length > 0 ? dataSources : undefined,
        fixed: [
          ...(liveRecipes?.preset.fixed ?? []),
          "fbr-0x",
          "fbr",
          "fbr-3x",
        ],
        speedLevels,
        fixedDemands: {
          hydrogen: hydrogenDemandPerCycle,
        },
        // Vehicles refuel from what production leaves; a shortfall shows on fuel.
        deferredDemandIds: ["hydrogen"],
      }, liveRecipes?.recipes ?? [], operationTargets, liveRecipes?.recipeIdsByPolicyId, liveRecipes?.unavailableRecipeIds), plan?.turbineRows), plan?.turbineAutoBalanceOff),
    ],
    defaultPresetId: "configured-target",
    liveArea,
  };
};
