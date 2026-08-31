import {
  type SyncedLogisticsZoneRef,
  type SyncedProductionEntity,
} from "../../game-state";
import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import {
  ignoredPopulationPrototypeIds,
  populationEntityMatchers,
  type ResolvedPopulationEntityInventory,
} from "../../helpers/population-entity-sync/population-entity-sync";
import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  activeHousingType,
  calculatePopulationCapacity,
  housingTypes,
} from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import { settlementRecipeIds, settlementServiceBuildings } from "../settlement";
import { type Module, type PlanMismatchAction } from "./modules";

const MODELED_POPULATION_MODULE_ID = "modeled-population";

const modeledHousingCount = 15;

const plannedHousingCount = 18;
const plannedWastewaterTreatmentCount = 2;
const plannedAnaerobicDigesterCount = 3;

interface PopulationHousingPlanArea {
  generatedArea: Module;
  syncedInventory: ResolvedPopulationEntityInventory;
}

const getDefaultPreset = (module: Module) => module.defaultPresetId
  ? module.presets.find(preset => preset.id === module.defaultPresetId)
  : module.presets[0];

export const resolvePopulationHousingPlanTargets = (
  areas: readonly PopulationHousingPlanArea[],
  targetTotal: number = plannedHousingCount,
): ReadonlyMap<number, number> => {
  let projectedHousingTotal = 0;
  const candidates: {
    builtHousingIi: number;
    pausedHousingIi: number;
    projectedHousing: number;
    zoneId: number;
  }[] = [];

  for (const { generatedArea, syncedInventory } of areas) {
    const zoneId = generatedArea.liveArea?.zoneId;

    if (zoneId == null) continue;
    const currentHousing = syncedInventory.counts[settlementRecipeIds.residents]?.running ?? 0;
    const constructionGhosts = getDefaultPreset(generatedArea)
      ?.capacityPools?.HousingT3?.constructionGhosts ?? 0;
    const projectedHousing = currentHousing + constructionGhosts;
    const builtHousingIi = syncedInventory.housingIiCandidates.built;
    const pausedHousingIi = Math.max(
      0,
      builtHousingIi - syncedInventory.housingIiCandidates.running,
    );

    projectedHousingTotal += projectedHousing;
    if (builtHousingIi > 0) {
      candidates.push({ builtHousingIi, pausedHousingIi, projectedHousing, zoneId });
    }
  }

  const pendingHousing = Math.max(0, targetTotal - projectedHousingTotal);
  const candidate = candidates.toSorted((left, right) => (
    right.pausedHousingIi - left.pausedHousingIi
    || right.builtHousingIi - left.builtHousingIi
    || left.zoneId - right.zoneId
  ))[0];

  return pendingHousing > 0 && candidate
    ? new Map([[candidate.zoneId, candidate.projectedHousing + pendingHousing]])
    : new Map();
};

/**
 * Non-UI fallback used by calculations that do not have a game snapshot.
 * Synced calculator tabs replace this with one generated module per Population area.
 */
export const modeledPopulation: Module = (() => {
  const capacityMultiplier = calculateHousingCapacity(
    defaultInfiniteResearchLevels.housingCapacity,
  ).multiplier;
  const builtBuildings = {
    [settlementRecipeIds.residents]: modeledHousingCount,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility,
    [settlementRecipeIds.householdGoodsModule]: settlementServiceBuildings.householdGoodsModule,
    [settlementRecipeIds.wasteCollection]: settlementServiceBuildings.wasteCollection,
    [settlementRecipeIds.recyclablesCollection]: settlementServiceBuildings.recyclablesCollection,
    [settlementRecipeIds.biomassCollection]: settlementServiceBuildings.biomassCollection,
    [settlementRecipeIds.clinic]: settlementServiceBuildings.clinic,
    [settlementRecipeIds.internetModule]: settlementServiceBuildings.internetModule,
    [settlementRecipeIds.wastewaterTreatment]: settlementServiceBuildings.wastewaterTreatment,
    [settlementRecipeIds.anaerobicDigester]: settlementServiceBuildings.anaerobicDigester,
    [settlementRecipeIds.biomassCompostMixer]: settlementServiceBuildings.biomassCompostMixer,
  };
  const activeBuildings = {
    ...builtBuildings,
    [settlementRecipeIds.residents]: plannedHousingCount,
    [settlementRecipeIds.wastewaterTreatment]: plannedWastewaterTreatmentCount,
    [settlementRecipeIds.anaerobicDigester]: plannedAnaerobicDigesterCount,
  };
  const populationCapacity = calculatePopulationCapacity(
    activeHousingType,
    plannedHousingCount,
    capacityMultiplier,
  );

  return {
    id: MODELED_POPULATION_MODULE_ID,
    name: "Population",
    description: "",
    builtBuildings,
    presets: [{
      id: "modeled-population",
      name: "Population",
      description: "",
      activeBuildings,
      dataSources: {
        [settlementRecipeIds.residents]: "planned",
        [settlementRecipeIds.wastewaterTreatment]: "planned",
        [settlementRecipeIds.anaerobicDigester]: "planned",
      },
      fixed: Object.keys(builtBuildings).filter(recipeId => (
        recipeId !== settlementRecipeIds.wastewaterTreatment
        && recipeId !== settlementRecipeIds.anaerobicDigester
        && recipeId !== settlementRecipeIds.biomassCompostMixer
      )),
      speedLevels: {
        [settlementRecipeIds.residents]: capacityMultiplier,
        [settlementRecipeIds.internetModule]: populationCapacity / 100,
      },
    }],
    defaultPresetId: "modeled-population",
  };
})();

export const createLegacyPopulationArea = (
  zone: SyncedLogisticsZoneRef,
  productionEntities: readonly SyncedProductionEntity[],
): Module => {
  const zoneEntities = productionEntities.filter(entity => (
    entity.zones.some(entityZone => entityZone.id === zone.id)
  ));

  return {
    id: `live-area-${zone.id}`,
    name: zone.name ?? "Population",
    description: "",
    includedInFactoryTotals: false,
    builtBuildings: {},
    presets: [{
      id: "live",
      name: "Live area",
      description: "",
      activeBuildings: {},
      currentActiveBuildings: {},
      builtBuildings: {},
      constructionGhosts: {},
      capacityPools: {},
      dataSources: {},
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId: zone.id,
      trackedBuildings: zoneEntities.length,
      constructedBuildings: zoneEntities.length,
      activeBuildings: zoneEntities.filter(entity => entity.running).length,
      pausedBuildings: zoneEntities.filter(entity => !entity.running).length,
      constructionGhosts: 0,
      issues: [],
    },
  };
};

export const createPopulationModule = (
  syncedInventory: ResolvedPopulationEntityInventory,
  generatedArea: Module,
  housingCapacityLevel: number = defaultInfiniteResearchLevels.housingCapacity,
  plannedHousingTarget: number | null = plannedHousingCount,
): Module => {
  const rawGeneratedPreset = getDefaultPreset(generatedArea);

  if (!rawGeneratedPreset) return generatedArea;

  const specialItems = populationEntityMatchers.flatMap(matcher => {
    const marker = `:${matcher.prototypeId}:`;
    const hasGeneratedRecipe = generatedArea.recipes?.some(recipe => (
      recipe.id.includes(marker)
      && (
        matcher.gameRecipeIds == null
        || matcher.gameRecipeIds.some(gameRecipeId => recipe.id.endsWith(`:${gameRecipeId}`))
      )
    )) ?? false;
    const usesSyntheticRecipe = matcher.gameRecipeIds == null || !hasGeneratedRecipe;

    if (!usesSyntheticRecipe) return [];

    const count = syncedInventory.counts[matcher.recipeId] ?? { built: 0, running: 0 };
    const constructionGhosts =
      rawGeneratedPreset.capacityPools?.[matcher.prototypeId]?.constructionGhosts ?? 0;

    if (matcher.gameRecipeIds != null && count.built === 0) return [];

    if (count.built === 0 && count.running === 0 && constructionGhosts === 0) return [];

    return [{
      ...matcher,
      built: count.built,
      currentActive: count.running,
      constructionGhosts,
      fixed: matcher.gameRecipeIds == null,
    }];
  });
  const replacedPrototypeIds = new Set(specialItems.map(item => item.prototypeId));
  const handledPrototypeIds = new Set([
    ...replacedPrototypeIds,
    ...ignoredPopulationPrototypeIds,
  ]);
  const replacedRecipeMarkers = [...replacedPrototypeIds].map(id => `:${id}:`);
  const isReplacedGeneratedRecipeId = (id: string) => (
    replacedRecipeMarkers.some(marker => id.includes(marker))
  );
  const withoutReplacedRecipeIds = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => !isReplacedGeneratedRecipeId(id)),
        )
      : undefined
  );
  const withoutReplacedPrototypeIds = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => !handledPrototypeIds.has(id)),
        )
      : undefined
  );
  const specialBuiltBuildings = Object.fromEntries(specialItems.map(item => [
    item.recipeId,
    item.built,
  ]));
  const specialCurrentActiveBuildings = Object.fromEntries(specialItems.map(item => [
    item.recipeId,
    item.currentActive,
  ]));
  const specialConstructionGhosts = Object.fromEntries(specialItems.map(item => [
    item.recipeId,
    item.constructionGhosts,
  ]));
  const specialActiveBuildings = Object.fromEntries(specialItems.map(item => [
    item.recipeId,
    item.currentActive + item.constructionGhosts,
  ]));
  const specialDataSources: Record<string, ValueSource> = Object.fromEntries(specialItems.map(item => [
    item.recipeId,
    "synced" as const,
  ]));
  const currentHousingCount = specialCurrentActiveBuildings[settlementRecipeIds.residents] ?? 0;
  const projectedHousingCount = specialActiveBuildings[settlementRecipeIds.residents] ?? 0;
  const builtHousingCount = specialBuiltBuildings[settlementRecipeIds.residents] ?? 0;
  const builtHousingIiCount = specialBuiltBuildings[settlementRecipeIds.residentsII] ?? 0;
  const runningHousingIiCount = specialCurrentActiveBuildings[settlementRecipeIds.residentsII] ?? 0;
  const pendingHousingCount = plannedHousingTarget == null
    ? 0
    : Math.max(0, plannedHousingTarget - projectedHousingCount);
  const promotionCount = Math.min(builtHousingIiCount, pendingHousingCount);
  const unpausePromotionCount = Math.max(0, promotionCount - runningHousingIiCount);
  const buildHousingCount = Math.max(0, pendingHousingCount - promotionCount);
  const hasHousingPlan = plannedHousingTarget != null
    && pendingHousingCount > 0
    && builtHousingIiCount > 0;

  if (hasHousingPlan) {
    specialActiveBuildings[settlementRecipeIds.residents] = plannedHousingTarget;
    specialActiveBuildings[settlementRecipeIds.residentsII] = Math.max(
      0,
      (specialActiveBuildings[settlementRecipeIds.residentsII] ?? 0) - promotionCount,
    );
    specialBuiltBuildings[settlementRecipeIds.residents] = builtHousingCount + promotionCount;
    specialBuiltBuildings[settlementRecipeIds.residentsII] = builtHousingIiCount - promotionCount;
    specialDataSources[settlementRecipeIds.residents] = "planned";
    specialDataSources[settlementRecipeIds.residentsII] = "planned";
  }

  const housingPlanActions: PlanMismatchAction[] = hasHousingPlan
    ? [
        ...(unpausePromotionCount > 0
          ? [{
              type: "unpause" as const,
              label: `Unpause ${unpausePromotionCount} ${housingTypes.housingII.name}`,
            }]
          : []),
        ...(promotionCount > 0
          ? [{
              type: "upgrade" as const,
              label:
                `Upgrade ${promotionCount} ${housingTypes.housingII.name} to ${activeHousingType.name}`,
            }]
          : []),
        ...(buildHousingCount > 0
          ? [{
              type: "build" as const,
              label: `Build ${buildHousingCount} ${activeHousingType.name}`,
            }]
          : []),
      ]
    : [];
  const projectedCurrentActiveBuildings = hasHousingPlan
    ? Object.fromEntries(Object.entries(specialCurrentActiveBuildings).filter(([recipeId]) => (
        recipeId !== settlementRecipeIds.residents
        && recipeId !== settlementRecipeIds.residentsII
      )))
    : specialCurrentActiveBuildings;
  const capacityMultiplier = calculateHousingCapacity(housingCapacityLevel).multiplier;
  const activeHousingCount = specialActiveBuildings[settlementRecipeIds.residents] ?? 0;
  const activeHousingIiCount = specialActiveBuildings[settlementRecipeIds.residentsII] ?? 0;
  const populationCapacity = calculatePopulationCapacity(
    activeHousingType,
    activeHousingCount,
    capacityMultiplier,
  ) + calculatePopulationCapacity(
    housingTypes.housingII,
    activeHousingIiCount,
    capacityMultiplier,
  );
  const generatedPreset = {
    ...rawGeneratedPreset,
    description: "",
    activeBuildings: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.activeBuildings),
      ...specialActiveBuildings,
    },
    currentActiveBuildings: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.currentActiveBuildings),
      ...projectedCurrentActiveBuildings,
    },
    builtBuildings: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.builtBuildings),
      ...specialBuiltBuildings,
    },
    constructionGhosts: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.constructionGhosts),
      ...specialConstructionGhosts,
    },
    unplacedPlannedBuildings: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.unplacedPlannedBuildings),
      ...(hasHousingPlan && buildHousingCount > 0
        ? { [settlementRecipeIds.residents]: buildHousingCount }
        : {}),
    },
    capacityPools: withoutReplacedPrototypeIds(rawGeneratedPreset.capacityPools),
    dataSources: {
      ...withoutReplacedRecipeIds(rawGeneratedPreset.dataSources),
      ...specialDataSources,
    },
    fixed: [
      ...new Set([
        ...rawGeneratedPreset.fixed.filter(id => !isReplacedGeneratedRecipeId(id)),
        ...specialItems.filter(item => item.fixed).map(item => item.recipeId),
      ]),
    ],
    speedLevels: {
      ...rawGeneratedPreset.speedLevels,
      [settlementRecipeIds.residents]: capacityMultiplier,
      [settlementRecipeIds.residentsII]: capacityMultiplier,
      [settlementRecipeIds.internetModule]: populationCapacity / 100,
    },
    planMismatches: hasHousingPlan
      ? [
          ...(rawGeneratedPreset.planMismatches ?? []).filter(mismatch => (
            mismatch.recipeId !== settlementRecipeIds.residents
          )),
          {
            recipeId: settlementRecipeIds.residents,
            current: currentHousingCount,
            currentSource: "synced" as const,
            target: plannedHousingTarget,
            direction: "at-least" as const,
            format: "configuration" as const,
            actions: housingPlanActions,
          },
        ]
      : rawGeneratedPreset.planMismatches,
  };

  return {
    ...generatedArea,
    description: "",
    includedInFactoryTotals: true,
    builtBuildings: {
      ...withoutReplacedRecipeIds(generatedArea.builtBuildings),
      ...specialBuiltBuildings,
    },
    recipes: generatedArea.recipes?.filter(recipe => (
      !isReplacedGeneratedRecipeId(recipe.id)
    )),
    presets: [generatedPreset],
    defaultPresetId: generatedPreset.id,
    liveArea: generatedArea.liveArea
      ? {
          ...generatedArea.liveArea,
          issues: generatedArea.liveArea.issues.filter(issue => {
            const prototypeId = issue.id.split(":", 1)[0];

            return !prototypeId || !handledPrototypeIds.has(prototypeId);
          }),
        }
      : undefined,
  };
};
