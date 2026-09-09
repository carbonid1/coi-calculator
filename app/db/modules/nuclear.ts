import { type SyncedProductionEntity } from "../../game-state";
import { nuclearOrdinaryRecipeIds, resolveNuclearAreaRecipes } from '../../helpers/nuclear-entity-sync/nuclear-area-recipes';
import {
  nuclearSpecialPrototypeIds,
  resolveNuclearEntityInventory,
} from "../../helpers/nuclear-entity-sync/nuclear-entity-sync";
import { applyNuclearOperationTargets, type NuclearOperationTarget } from '../../helpers/nuclear-entity-sync/nuclear-operation-targets';
import { type PlanningBaselines } from "../planning-baselines";
import {
  type Module,
  type Preset,
} from "./modules";

const NUCLEAR_MODULE_ID = "nuclear";

export interface NuclearOperationPlan {
  generationTargetMw: number;
  hydrogenReformerCount: number;
  chlorineProcessingCount: number;
  saltProcessingCount: number;
  superDesalinatorCount: number;
}

export const plannedNuclearOperation: NuclearOperationPlan = {
  // Use the installed turbine trains before adding another generator build.
  generationTargetMw: 159,
  hydrogenReformerCount: 8,
  chlorineProcessingCount: 2,
  saltProcessingCount: 2,
  superDesalinatorCount: 9,
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
  const liveRecipes = generatedArea?.recipes ? resolveNuclearAreaRecipes(generatedArea) : undefined;
  const recipeIds = Object.keys(syncedInventory.counts).filter(id => (
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
  const activeBuildings = { ...currentActiveBuildings, ...liveRecipes?.preset.activeBuildings };
  const speedLevels: Record<string, number> = { ...syncedInventory.speedLevels, ...liveRecipes?.preset.speedLevels };
  const dataSources: NonNullable<Preset["dataSources"]> = { ...Object.fromEntries(
    recipeIds.map(recipeId => [recipeId, "synced" as const]),
  ), ...liveRecipes?.preset.dataSources };
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
      applyNuclearOperationTargets({
        ...liveRecipes?.preset,
        id: "configured-target",
        name: "Configured target",
        description: "",
        builtBuildings,
        activeBuildings,
        currentActiveBuildings,
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
        electricityDispatchTargets: {
          "fbr-turbines": generationTargetMw,
        },
      }, liveRecipes?.recipes ?? [], operationTargets, liveRecipes?.recipeIdsByPolicyId, liveRecipes?.unavailableRecipeIds),
    ],
    defaultPresetId: "configured-target",
    liveArea,
  };
};
