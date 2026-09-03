import {
  type SyncedLogisticsZoneRef,
  type SyncedProductionEntity,
} from "../../game-state";
import { recipes, type Recipe } from "../recipes";
import {
  emptyRocketInfrastructureConfig,
  normalizeRocketInfrastructureConfig,
  rocketInfrastructureItems,
  type RocketInfrastructureConfig,
} from "../rocket-infrastructure";
import {
  calculateSpaceStationLevel,
  getMinimumSpaceStationLevelForResearchPoints,
  type SpaceStationConfig,
} from "../space-station";
import { type Module, type PlanMismatch } from "./modules";

const SPACE_STATION_MODULE_ID = "space-station";
const SPACE_STATION_PARTS_RECIPE_ID = "assembly-v-station-parts";

export const SPACE_STATION_ZONE_NAME = "Space Station";

const handledAreaPrototypeIds = new Set([
  "RocketAssemblyDepot",
  "RocketLaunchPad",
]);

const isStationPartsAssembly = (entity: SyncedProductionEntity) => (
  entity.prototypeId === "AssemblyRoboticT2"
  && entity.recipeIds.includes("StationPartsAssembly")
);

const spaceStationZoneScore = (
  zone: SyncedLogisticsZoneRef,
  productionEntities: readonly SyncedProductionEntity[],
) => productionEntities.filter(entity => (
  entity.zones.some(entityZone => entityZone.id === zone.id)
  && (handledAreaPrototypeIds.has(entity.prototypeId) || isStationPartsAssembly(entity))
)).length;

export const selectSpaceStationZone = (
  zones: readonly SyncedLogisticsZoneRef[],
  productionEntities: readonly SyncedProductionEntity[],
): SyncedLogisticsZoneRef | undefined => (
  zones
    .filter(zone => spaceStationZoneScore(zone, productionEntities) > 0)
    .sort((left, right) => (
      spaceStationZoneScore(right, productionEntities)
      - spaceStationZoneScore(left, productionEntities)
      || left.id - right.id
    ))[0]
);

const handledAreaRecipeMarkers = [...handledAreaPrototypeIds].map(id => `:${id}:`);

const isHandledAreaRecipeId = (id: string) => (
  handledAreaRecipeMarkers.some(marker => id.includes(marker))
);

const withoutHandledAreaRecipeIds = <T>(values: Record<string, T> | undefined) => (
  values
    ? Object.fromEntries(
        Object.entries(values).filter(([id]) => !isHandledAreaRecipeId(id)),
      )
    : undefined
);

const withoutHandledAreaPrototypeIds = <T>(values: Record<string, T> | undefined) => (
  values
    ? Object.fromEntries(
        Object.entries(values).filter(([id]) => !handledAreaPrototypeIds.has(id)),
      )
    : undefined
);

interface SpaceStationAreaBuildingState {
  built: number;
  running: number;
}

export interface SpaceStationCurrentState {
  rocketRunningConfig?: RocketInfrastructureConfig;
  stationPartsAssembly?: SpaceStationAreaBuildingState;
}

export interface SpaceStationResearchPlan {
  requiredPoints: number;
}

const romanLevels: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

const getSpaceStationLabel = (level: number) => {
  const roman = romanLevels[level];

  return roman ? `Space Station ${roman}` : "Space Station";
};

const getRecipe = (id: string) => {
  const recipe = recipes.find(candidate => candidate.id === id);

  if (!recipe) throw new Error(`Missing Space Station recipe: ${id}`);

  return recipe;
};

const createSpaceStationRecipes = (config: SpaceStationConfig): Recipe[] => {
  const station = calculateSpaceStationLevel(
    config.currentLevel,
    config.highestLevelAchieved,
  );
  const label = getSpaceStationLabel(station.level);
  const operations = getRecipe("space-station-operations");
  const orbitalResearch = getRecipe("space-station-orbital-research");

  return [
    {
      ...operations,
      name: `${label} Operations`,
      building: label,
      displayGroup: { id: "space-station", label },
      inputs: [
        { resourceId: "stationParts", quantity: station.maintenancePartsPerCycle },
        { resourceId: "crewSupplies", quantity: station.crewSuppliesPerCycle },
      ],
    },
    {
      ...orbitalResearch,
      name: `${label} Orbital Research`,
      displayGroup: { id: "space-station", label },
      inputs: [{ resourceId: "electronicsIv", quantity: station.researchSuppliesPerCycle }],
      outputs: [{
        resourceId: "spaceResearchPoints",
        quantity: station.spaceResearchPointsPerCycle,
      }],
    },
  ];
};

export const createSpaceStationModule = (
  config: SpaceStationConfig,
  rocketBuiltConfig: RocketInfrastructureConfig = emptyRocketInfrastructureConfig,
  currentState: SpaceStationCurrentState = {},
  generatedArea?: Module,
  researchPlan?: SpaceStationResearchPlan,
): Module => {
  const currentStation = calculateSpaceStationLevel(
    config.currentLevel,
    config.highestLevelAchieved,
  );
  const targetLevel = researchPlan?.requiredPoints
    ? Math.max(
        currentStation.level,
        getMinimumSpaceStationLevelForResearchPoints(researchPlan.requiredPoints),
      )
    : currentStation.level;
  const station = calculateSpaceStationLevel(
    targetLevel,
    Math.max(config.highestLevelAchieved, targetLevel),
  );
  const stationPlanPending = targetLevel > currentStation.level;
  const hasStation = station.level > 0;
  const hasOrbitalResearch = station.spaceResearchPointsPerCycle > 0;
  const currentlyHasStation = currentStation.level > 0;
  const currentlyHasOrbitalResearch = currentStation.spaceResearchPointsPerCycle > 0;
  const rocketBuilt = normalizeRocketInfrastructureConfig(rocketBuiltConfig);
  const rocketRunning = normalizeRocketInfrastructureConfig(
    currentState.rocketRunningConfig ?? rocketBuilt,
  );
  const stationPartsAssembly = currentState.stationPartsAssembly ?? {
    built: 0,
    running: 0,
  };
  const stationActive = hasStation ? 1 : 0;
  const currentStationActive = currentlyHasStation ? 1 : 0;
  const rocketBuiltBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [item.recipeId, rocketBuilt[item.id]]),
  );
  const rocketActiveBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [
      item.recipeId,
      Math.max(hasStation ? 1 : 0, rocketRunning[item.id]),
    ]),
  );
  const rocketCurrentActiveBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [item.recipeId, rocketRunning[item.id]]),
  );
  const builtBuildings = {
    "space-station-operations": currentStationActive,
    "space-station-orbital-research": currentlyHasOrbitalResearch ? currentStationActive : 0,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.built,
    ...rocketBuiltBuildings,
  };
  const activeBuildings = {
    "space-station-operations": stationActive,
    "space-station-orbital-research": hasOrbitalResearch ? stationActive : 0,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.running,
    ...rocketActiveBuildings,
  };
  const currentActiveBuildings = {
    "space-station-operations": currentStationActive,
    "space-station-orbital-research": currentlyHasOrbitalResearch ? currentStationActive : 0,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.running,
    ...rocketCurrentActiveBuildings,
  };
  const dataSources = {
    "space-station-operations": stationPlanPending ? "planned" as const : "synced" as const,
    "space-station-orbital-research": stationPlanPending ? "planned" as const : "synced" as const,
    [SPACE_STATION_PARTS_RECIPE_ID]: "synced" as const,
    ...Object.fromEntries(
      rocketInfrastructureItems.map((item) => [
        item.recipeId,
        "synced" as const,
      ]),
    ),
  };
  const stationPlanMismatches: PlanMismatch[] = stationPlanPending
    ? [{
        recipeId: "space-station-operations",
        current: currentStation.level,
        target: targetLevel,
        direction: "at-least",
        format: "level",
        actions: [{
          type: currentlyHasStation ? "upgrade" : "build",
          label: currentlyHasStation
            ? `Upgrade Space Station to level ${targetLevel}`
            : `Build Space Station level ${targetLevel}`,
        }],
      }]
    : [];

  const stationModule: Module = {
    id: SPACE_STATION_MODULE_ID,
    name: "Space Station",
    description: "",
    capabilities: ["space-station"],
    includedInFactoryTotals: true,
    builtBuildings,
    recipes: createSpaceStationRecipes({
      currentLevel: targetLevel,
      highestLevelAchieved: Math.max(config.highestLevelAchieved, targetLevel),
    }),
    presets: [
      {
        id: "current",
        name: "Current",
        description: "",
        activeBuildings,
        currentActiveBuildings,
        dataSources,
        unplacedPlannedBuildings: stationPlanPending && !currentlyHasStation
          ? { "space-station-operations": 1 }
          : undefined,
        fixed: [
          ...(hasStation ? ["space-station-operations"] : []),
          ...(hasOrbitalResearch ? ["space-station-orbital-research"] : []),
          ...(hasStation ? ["rocket-ii-launch-amortized"] : []),
        ],
        planMismatches: stationPlanMismatches.length > 0
          ? stationPlanMismatches
          : undefined,
      },
    ],
    defaultPresetId: "current",
  };

  if (!generatedArea) return stationModule;

  const generatedPreset = generatedArea.defaultPresetId
    ? generatedArea.presets.find(preset => preset.id === generatedArea.defaultPresetId)
    : generatedArea.presets[0];
  const stationPreset = stationModule.presets[0];

  if (!generatedPreset || !stationPreset) return generatedArea;

  const generatedStationPartsRecipeId = generatedArea.recipes?.find(recipe => (
    recipe.id.includes(":AssemblyRoboticT2:")
    && recipe.id.endsWith(":StationPartsAssembly")
  ))?.id;
  const stationRecipeIds = new Set([
    "space-station-operations",
    "space-station-orbital-research",
    "rocket-ii-assembly",
    "rocket-ii-launch-amortized",
    ...(!generatedStationPartsRecipeId ? [SPACE_STATION_PARTS_RECIPE_ID] : []),
  ]);
  const stationValues = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => stationRecipeIds.has(id)),
        )
      : undefined
  );
  const rocketConstructionGhosts = {
    "rocket-ii-assembly":
      generatedPreset.capacityPools?.RocketAssemblyDepot?.constructionGhosts ?? 0,
    "rocket-ii-launch-amortized":
      generatedPreset.capacityPools?.RocketLaunchPad?.constructionGhosts ?? 0,
  };
  const mergedPlanMismatches = [
    ...(generatedPreset.planMismatches ?? []).filter(mismatch => (
      !isHandledAreaRecipeId(mismatch.recipeId)
      && !stationRecipeIds.has(mismatch.recipeId)
    )),
    ...(stationPreset.planMismatches ?? []).filter(mismatch => (
      stationRecipeIds.has(mismatch.recipeId)
    )),
  ];
  const mergedPreset = {
    ...generatedPreset,
    description: "",
    activeBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.activeBuildings),
      ...stationValues(stationPreset.activeBuildings),
    },
    currentActiveBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.currentActiveBuildings),
      ...stationValues(stationPreset.currentActiveBuildings),
    },
    builtBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.builtBuildings),
      ...stationValues(stationModule.builtBuildings),
    },
    constructionGhosts: {
      ...withoutHandledAreaRecipeIds(generatedPreset.constructionGhosts),
      ...rocketConstructionGhosts,
    },
    capacityPools: withoutHandledAreaPrototypeIds(generatedPreset.capacityPools),
    dataSources: {
      ...withoutHandledAreaRecipeIds(generatedPreset.dataSources),
      ...stationValues(stationPreset.dataSources),
    },
    unplacedPlannedBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.unplacedPlannedBuildings),
      ...stationValues(stationPreset.unplacedPlannedBuildings),
    },
    fixed: [
      ...new Set([
        ...generatedPreset.fixed.filter(id => !isHandledAreaRecipeId(id)),
        ...stationPreset.fixed.filter(id => stationRecipeIds.has(id)),
      ]),
    ],
    planMismatches: mergedPlanMismatches.length > 0 ? mergedPlanMismatches : undefined,
  };

  return {
    ...generatedArea,
    description: "",
    includedInFactoryTotals: true,
    builtBuildings: {
      ...withoutHandledAreaRecipeIds(generatedArea.builtBuildings),
      ...stationValues(stationModule.builtBuildings),
    },
    recipes: [
      ...(generatedArea.recipes ?? []).filter(recipe => (
        !isHandledAreaRecipeId(recipe.id)
        && !stationRecipeIds.has(recipe.id)
      )),
      ...(stationModule.recipes ?? []),
    ],
    presets: [mergedPreset],
    defaultPresetId: mergedPreset.id,
    liveArea: generatedArea.liveArea
      ? {
          ...generatedArea.liveArea,
          issues: generatedArea.liveArea.issues.filter(issue => {
            const prototypeId = issue.id.split(":", 1)[0];

            return !prototypeId || !handledAreaPrototypeIds.has(prototypeId);
          }),
        }
      : undefined,
  };
};
