import { getBuildingData } from "../../db/buildings";
import { type Module } from "../../db/modules/modules";
import { isUnboundedDemandSourceMode } from "../../db/recipes";
import { type ResourceId } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";
import { getKeepReadyPreferenceKey, type KeepReadyPreferences } from "../keep-ready-preferences/keep-ready-preferences";
import { getRecipeDisplayName } from "../recipe-display/recipe-display";

export type BuildingAttention =
  | "add-animals"
  | "build"
  | "can-pause"
  | "rebalance-farms"
  | "remove-animals"
  | "upgrade"
  | "unpause";

export interface BuildingLevelDiagnostic {
  current: number;
  target: number;
}

export interface AnimalPopulationDiagnostic {
  current: number;
  capacity: number;
  label: string;
  additionalBuildings: number;
}

export interface BuildingDiagnostic {
  key: string;
  /** Optional card target when the diagnostic itself represents virtual infrastructure. */
  navigationKey?: string;
  moduleId: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  plannedCapacity: boolean;
  /** Effective preference for this physical building group, including user overrides. */
  keepReady?: boolean;
  load: number;
  active: number;
  built: number;
  attention: BuildingAttention | null;
  attentionCount: number;
  level?: BuildingLevelDiagnostic;
  animalPopulation?: AnimalPopulationDiagnostic;
  affectedResources: string[];
}

type Result = RegularResult | PassiveResult;

const EPSILON = 0.001;

const getBuildingKey = (result: Result) => (
  "capacityPoolId" in result && result.capacityPoolId
    ? result.capacityPoolId
    : `${result.moduleId}:${result.recipe.id}`
);

const isRegularResult = (result: Result): result is RegularResult => (
  "operatingMode" in result
);

const getDiagnosticRecipeName = (results: Result[]) => {
  const first = results[0];

  if (!first) return "Recipe";

  const sharedLabel = first.recipe.sharedCapacity?.label;

  if (sharedLabel) {
    const buildingPrefix = `${first.recipe.building} — `;

    return sharedLabel.startsWith(buildingPrefix)
      ? sharedLabel.slice(buildingPrefix.length)
      : sharedLabel;
  }

  return [...new Set(results.map(({ recipe }) => getRecipeDisplayName(recipe)))].join(" / ");
};

const roundUpToStep = (value: number, step: number) => (
  Math.ceil(Math.max(0, value - EPSILON) / step) * step
);

const roundDownToStep = (value: number, step: number) => (
  Math.floor(Math.max(0, value + EPSILON) / step) * step
);

const getAnimalPopulationDiagnostic = (
  results: Result[],
  flowsById: Map<ResourceId, ResourceFlow>,
) => {
  if (results.length !== 1) return null;

  const result = results[0];

  if (!result || !isRegularResult(result)) return null;

  const populationCapacity = result.recipe.animalPopulationCapacity;

  if (!populationCapacity || populationCapacity <= 0) return null;

  const populationStep = result.recipe.animalPopulationStep ?? 1;
  const current = result.activeBuildings * populationCapacity * result.speedLevel;
  const capacity = result.builtBuildings * populationCapacity;
  const outputRates = result.recipe.outputs.flatMap((output) => {
    const ratePerAnimal = output.quantity / populationCapacity;
    const flow = flowsById.get(output.resourceId);

    return flow && ratePerAnimal > 0
      ? [{ output, flow, ratePerAnimal }]
      : [];
  });
  const shortages = outputRates.filter(({ flow }) => flow.net < -EPSILON);
  const label = result.recipe.animalPopulationLabel ?? "animals";

  if (shortages.length > 0) {
    const unroundedIncrease = Math.max(...shortages.map(
      ({ flow, ratePerAnimal }) => -flow.net / ratePerAnimal,
    ));
    const attentionCount = roundUpToStep(unroundedIncrease, populationStep);
    const requiredPopulation = current + attentionCount;
    const requiredBuildings = Math.ceil(
      Math.max(0, requiredPopulation - EPSILON) / populationCapacity,
    );

    return {
      attention: "add-animals" as const,
      attentionCount,
      animalPopulation: {
        current,
        capacity,
        label,
        additionalBuildings: Math.max(0, requiredBuildings - result.builtBuildings),
      },
      affectedResourceIds: shortages.map(({ output }) => output.resourceId),
    };
  }

  // This is deliberately conservative. A livestock output consumed by a fallback
  // recipe has zero net surplus, so it prevents a removal recommendation even if
  // another output is overproduced. Removing animals is only safe when every
  // direct output has enough visible surplus to absorb the same flock reduction.
  const removablePopulation = outputRates.length > 0
    ? Math.min(current, ...outputRates.map(({ flow, ratePerAnimal }) => (
        Math.max(0, flow.net) / ratePerAnimal
      )))
    : 0;
  const attentionCount = roundDownToStep(removablePopulation, populationStep);
  const affectedResourceIds: ResourceId[] = [];

  return {
    attention: attentionCount >= populationStep ? "remove-animals" as const : null,
    attentionCount,
    animalPopulation: {
      current,
      capacity,
      label,
      additionalBuildings: 0,
    },
    affectedResourceIds,
  };
};

const getAttention = ({
  tracksPhysicalCapacity,
  plannedCapacity,
  hasShortage,
  active,
  built,
  paused,
  atCapacity,
  canPause,
  requiresRunningCapacity,
  currentActive,
  keepReady,
}: {
  tracksPhysicalCapacity: boolean;
  plannedCapacity: boolean;
  hasShortage: boolean;
  active: number;
  built: number;
  paused: number;
  atCapacity: boolean;
  canPause: number;
  requiresRunningCapacity: boolean;
  currentActive: number;
  keepReady: boolean;
}): BuildingAttention | null => {
  if (!tracksPhysicalCapacity) return null;
  if (plannedCapacity) return null;
  if (keepReady && currentActive <= EPSILON) return built > 0 ? "unpause" : "build";
  if (requiresRunningCapacity && currentActive + EPSILON < active) {
    return built > currentActive + EPSILON ? "unpause" : "build";
  }
  if (active > built + EPSILON) return "build";
  if (hasShortage && active === 0 && paused >= 1) return "unpause";
  if (hasShortage && active === 0 && built === 0) return "build";

  if (hasShortage && atCapacity) {
    return paused >= 1 ? "unpause" : "build";
  }

  return canPause >= 1 ? "can-pause" : null;
};

const getAttentionCount = (
  attention: BuildingAttention | null,
  canPause: number,
  paused: number,
  active: number,
  built: number,
  currentActive: number,
) => {
  if (attention === "can-pause") return canPause;
  if (attention === "unpause") {
    return Math.min(paused, Math.max(1, Math.ceil(active - currentActive - EPSILON)));
  }
  if (attention === "build") {
    return Math.max(1, Math.ceil(active - built - EPSILON));
  }

  return 0;
};

export const calculateBuildingDiagnostics = (
  modules: Module[],
  flows: ResourceFlow[],
  regularResults: RegularResult[],
  sourceResults: PassiveResult[] = [],
  sinkResults: PassiveResult[] = [],
  keepReadyPreferences: KeepReadyPreferences = {},
): BuildingDiagnostic[] => {
  const moduleNames = new Map(modules.map((module) => [module.id, module.name]));
  const flowsById = new Map(flows.map((flow) => [flow.resourceId, flow]));
  const groups = new Map<string, Result[]>();

  for (const result of [...regularResults, ...sourceResults, ...sinkResults]) {
    const key = getBuildingKey(result);
    const group = groups.get(key) ?? [];

    group.push(result);
    groups.set(key, group);
  }

  const cropKeysByModule = new Map<string, Set<string>>();

  for (const [key, results] of groups) {
    const firstCropResult = results.find((result) => result.recipe.farmFertilizer != null);

    if (!firstCropResult) continue;

    const keys = cropKeysByModule.get(firstCropResult.moduleId) ?? new Set<string>();

    keys.add(key);
    cropKeysByModule.set(firstCropResult.moduleId, keys);
  }

  const diagnostics: BuildingDiagnostic[] = [...groups.entries()].map(([key, results]) => {
    const first = results[0];

    if (!first) throw new Error(`Building group ${key} has no results`);

    const physicalCapacityResults = results.filter((result) => (
      result.recipe.tracksPhysicalCapacity !== false
      && result.recipe.sinkMode !== "unbounded"
      && !(isUnboundedDemandSourceMode(result.recipe.sourceMode)
        && result.recipe.sourceKind != null)
    ));
    const tracksPhysicalCapacity = physicalCapacityResults.length > 0;
    // A shared physical-capacity pool can contain both current recipes and a
    // planned expansion. The planned member acknowledges the pool-level build,
    // so do not restate that same work as an attention warning.
    const plannedCapacity = physicalCapacityResults.some((result) => (
      result.dataSource === "planned"
      || (result.constructionGhosts ?? 0) > 0
      || (result.unplacedPlannedBuildings ?? 0) > 0
    ));
    const animalDiagnostic = plannedCapacity
      ? null
      : getAnimalPopulationDiagnostic(results, flowsById);

    if (animalDiagnostic) {
      return {
        key,
        moduleId: first.moduleId,
        moduleName: moduleNames.get(first.moduleId) ?? first.moduleId,
        buildingName: isRegularResult(first)
          ? first.recipe.sharedCapacity?.label ?? first.recipe.building
          : first.recipe.building,
        recipeName: getDiagnosticRecipeName(results),
        plannedCapacity,
        load: animalDiagnostic.animalPopulation.current
          / (first.recipe.animalPopulationCapacity ?? 1),
        active: first.activeBuildings,
        built: first.builtBuildings,
        attention: animalDiagnostic.attention,
        attentionCount: animalDiagnostic.attentionCount,
        animalPopulation: animalDiagnostic.animalPopulation,
        affectedResources: animalDiagnostic.affectedResourceIds.map(
          (resourceId) => flowsById.get(resourceId)?.name ?? resourceId,
        ),
      };
    }

    const active = Math.max(...results.map(
      (result) => result.capacityPoolActiveBuildings ?? result.activeBuildings,
    ));
    const built = Math.max(...results.map(
      (result) => result.capacityPoolBuiltBuildings ?? result.builtBuildings,
    ));
    const currentActive = Math.max(...results.map(
      (result) => result.capacityPoolCurrentActiveBuildings
        ?? result.currentActiveBuildings
        ?? result.capacityPoolActiveBuildings
        ?? result.activeBuildings,
    ));
    const load = results.reduce(
      (total, result) => total + result.activeBuildings * result.supplyRatio,
      0,
    );
    const affectedResourceIds = new Set<ResourceId>();

    for (const result of results) {
      const diagnosticOutputIds = isRegularResult(result)
        && result.recipe.balanceOutputIds
        ? new Set(result.recipe.balanceOutputIds)
        : null;

      for (const output of result.recipe.outputs) {
        const outputDrivesCapacity = result.recipe.group !== "sink"
          && (!diagnosticOutputIds || diagnosticOutputIds.has(output.resourceId));

        if (
          outputDrivesCapacity
          && (flowsById.get(output.resourceId)?.net ?? 0) < -EPSILON
        ) {
          affectedResourceIds.add(output.resourceId);
        }
      }

      const consumesSurplus = result.recipe.group === "sink"
        || result.recipe.allocation === "fallback"
        || result.recipe.allocation === "surplus";

      if (!consumesSurplus) continue;

      for (const input of result.recipe.inputs) {
        if ((flowsById.get(input.resourceId)?.net ?? 0) > EPSILON) {
          affectedResourceIds.add(input.resourceId);
        }
      }
    }

    const atCapacity = active > 0 && load >= active - EPSILON;
    const requiresRunningCapacity = physicalCapacityResults.some(
      result => result.recipe.requiresRunningCapacity === true,
    );
    const keepReady = tracksPhysicalCapacity && (keepReadyPreferences[getKeepReadyPreferenceKey(key)]
      ?? physicalCapacityResults.some(result => result.recipe.keepReady === true));
    const paused = Math.max(0, built - (requiresRunningCapacity || keepReady ? currentActive : active));
    const suppressPauseAttention = keepReady || results.every((result) => (
      getBuildingData(result.recipe.building)?.suppressPauseAttention === true
    ));
    const canPause = suppressPauseAttention
      ? 0
      : Math.max(0, active - Math.ceil(Math.max(0, load - EPSILON)));
    const hasShortage = affectedResourceIds.size > 0;
    const attention = getAttention({
      tracksPhysicalCapacity,
      plannedCapacity,
      hasShortage,
      active,
      built,
      paused,
      atCapacity,
      canPause,
      requiresRunningCapacity,
      currentActive,
      keepReady,
    });
    const attentionCount = getAttentionCount(
      attention,
      canPause,
      paused,
      active,
      built,
      currentActive,
    );

    return {
      key,
      moduleId: first.moduleId,
      moduleName: moduleNames.get(first.moduleId) ?? first.moduleId,
      buildingName: isRegularResult(first)
        ? first.recipe.sharedCapacity?.label ?? first.recipe.building
        : first.recipe.building,
      recipeName: getDiagnosticRecipeName(results),
      plannedCapacity,
      keepReady,
      load,
      active,
      built,
      attention,
      attentionCount,
      affectedResources: [...affectedResourceIds].map(
        (resourceId) => flowsById.get(resourceId)?.name ?? resourceId,
      ),
    };
  });

  for (const [moduleId, cropKeys] of cropKeysByModule) {
    const cropDiagnostics = diagnostics.filter((diagnostic) => cropKeys.has(diagnostic.key));
    const affectedResources = [...new Set(cropDiagnostics.flatMap(
      (diagnostic) => diagnostic.affectedResources,
    ))];
    const plannedCapacity = cropDiagnostics.every(
      (diagnostic) => diagnostic.plannedCapacity,
    );

    for (const diagnostic of cropDiagnostics) {
      diagnostic.attention = null;
      diagnostic.attentionCount = 0;
    }

    if (affectedResources.length === 0 || plannedCapacity) continue;

    diagnostics.push({
      key: `${moduleId}:crop-rebalance`,
      moduleId,
      moduleName: moduleNames.get(moduleId) ?? moduleId,
      buildingName: "Crop farms",
      recipeName: "Crop rotations",
      plannedCapacity: false,
      load: cropDiagnostics.reduce((total, diagnostic) => total + diagnostic.load, 0),
      active: cropDiagnostics.reduce((total, diagnostic) => total + diagnostic.active, 0),
      built: cropDiagnostics.reduce((total, diagnostic) => total + diagnostic.built, 0),
      attention: "rebalance-farms",
      attentionCount: 0,
      affectedResources,
    });
  }

  return diagnostics;
};
