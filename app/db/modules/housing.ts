import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import {
  type ResolvedPopulationEntityInventory,
} from "../../helpers/population-entity-sync/population-entity-sync";
import { resolveDirectionalPlan } from "../../helpers/resolve-layered-value/resolve-directional-plan";
import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  activeHousingType,
  calculatePopulationCapacity,
  housingTypes,
  resolvedCurrentHousingCount,
  resolvedHousingCount,
} from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import {
  settlementRecipeIds,
  settlementServiceBuildings,
} from "../settlement";
import { type Module, type PlanMismatch, type PlanMismatchAction } from "./modules";
import { createAtLeastBuildingActions } from "./plan-mismatch";

export const HOUSING_MODULE_ID = "housing";

const plannedWasteProcessingBuildings = {
  [settlementRecipeIds.wastewaterTreatment]: 2,
  [settlementRecipeIds.anaerobicDigester]: 3,
} as const;

const populationBuildingNames: Record<string, { name: string; pluralName?: string }> = {
  [settlementRecipeIds.residents]: {
    name: `${activeHousingType.name} building`,
    pluralName: `${activeHousingType.name} buildings`,
  },
  [settlementRecipeIds.wastewaterTreatment]: { name: "Wastewater Treatment" },
  [settlementRecipeIds.anaerobicDigester]: { name: "Anaerobic Digester" },
};

const createHousingPlanActions = (
  built: number,
  running: number,
  target: number,
  housingIiCandidates: ResolvedPopulationEntityInventory["housingIiCandidates"],
): {
  actions: PlanMismatchAction[]
  upgradedRunningHousingIi: number
} => {
  const unpauseCount = Math.min(
    Math.max(0, built - running),
    Math.max(0, target - running),
  );
  const afterUnpause = Math.max(0, target - running - unpauseCount);
  const upgradeCount = Math.min(Math.max(0, housingIiCandidates.built), afterUnpause);
  const pausedHousingIi = Math.max(
    0,
    housingIiCandidates.built - housingIiCandidates.running,
  );
  const upgradedRunningHousingIi = Math.max(0, upgradeCount - pausedHousingIi);
  const buildCount = Math.max(0, afterUnpause - upgradeCount);

  return {
    actions: [
      ...(unpauseCount > 0
        ? [{
            type: "unpause" as const,
            label: `Unpause ${unpauseCount} Housing III ${unpauseCount === 1 ? "building" : "buildings"}`,
          }]
        : []),
      ...(upgradeCount > 0
        ? [{
            type: "upgrade" as const,
            label: `Upgrade ${upgradeCount} Housing II ${upgradeCount === 1 ? "building" : "buildings"} to Housing III`,
          }]
        : []),
      ...(buildCount > 0
        ? [{
            type: "build" as const,
            label: `Build ${buildCount} Housing III ${buildCount === 1 ? "building" : "buildings"}`,
          }]
        : []),
    ],
    upgradedRunningHousingIi,
  };
};

export const createHousingModule = (
  housingCount: number,
  housingCapacityLevel: number = defaultInfiniteResearchLevels.housingCapacity,
  builtHousingCount: number = housingCount,
  dataSource: ValueSource = "modeled",
  syncedInventory?: ResolvedPopulationEntityInventory,
): Module => {
  const residents = Math.max(0, Math.trunc(housingCount));
  const builtResidents = Math.max(0, Math.trunc(builtHousingCount));
  const capacityMultiplier = calculateHousingCapacity(housingCapacityLevel).multiplier;
  const serviceFactor = residents > 0 ? 1 : 0;
  const builtServiceFactor = builtResidents > 0 ? 1 : 0;
  const builtBuildings: Record<string, number> = {
    [settlementRecipeIds.residents]: builtResidents,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket * builtServiceFactor,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII * builtServiceFactor,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer * builtServiceFactor,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility * builtServiceFactor,
    [settlementRecipeIds.householdGoodsModule]: settlementServiceBuildings.householdGoodsModule * builtServiceFactor,
    [settlementRecipeIds.wasteCollection]: settlementServiceBuildings.wasteCollection * builtServiceFactor,
    [settlementRecipeIds.recyclablesCollection]: settlementServiceBuildings.recyclablesCollection * builtServiceFactor,
    [settlementRecipeIds.biomassCollection]: settlementServiceBuildings.biomassCollection * builtServiceFactor,
    [settlementRecipeIds.clinic]: settlementServiceBuildings.clinic * builtServiceFactor,
    [settlementRecipeIds.internetModule]: settlementServiceBuildings.internetModule * builtServiceFactor,
    [settlementRecipeIds.wastewaterTreatment]: settlementServiceBuildings.wastewaterTreatment * builtServiceFactor,
    [settlementRecipeIds.anaerobicDigester]: settlementServiceBuildings.anaerobicDigester * builtServiceFactor,
    [settlementRecipeIds.biomassCompostMixer]: settlementServiceBuildings.biomassCompostMixer * builtServiceFactor,
  };
  const activeBuildings: Record<string, number> = {
    [settlementRecipeIds.residents]: residents,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket * serviceFactor,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII * serviceFactor,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer * serviceFactor,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility * serviceFactor,
    [settlementRecipeIds.householdGoodsModule]: settlementServiceBuildings.householdGoodsModule * serviceFactor,
    [settlementRecipeIds.wasteCollection]: settlementServiceBuildings.wasteCollection * serviceFactor,
    [settlementRecipeIds.recyclablesCollection]: settlementServiceBuildings.recyclablesCollection * serviceFactor,
    [settlementRecipeIds.biomassCollection]: settlementServiceBuildings.biomassCollection * serviceFactor,
    [settlementRecipeIds.clinic]: settlementServiceBuildings.clinic * serviceFactor,
    [settlementRecipeIds.internetModule]: settlementServiceBuildings.internetModule * serviceFactor,
    [settlementRecipeIds.wastewaterTreatment]: plannedWasteProcessingBuildings[settlementRecipeIds.wastewaterTreatment] * serviceFactor,
    [settlementRecipeIds.anaerobicDigester]: plannedWasteProcessingBuildings[settlementRecipeIds.anaerobicDigester] * serviceFactor,
    [settlementRecipeIds.biomassCompostMixer]: settlementServiceBuildings.biomassCompostMixer * serviceFactor,
  };

  if (syncedInventory && syncedInventory.housingIiCandidates.built > 0) {
    builtBuildings[settlementRecipeIds.residentsII] = syncedInventory.housingIiCandidates.built;
    activeBuildings[settlementRecipeIds.residentsII] = syncedInventory.housingIiCandidates.running;
  }

  const dataSources: Record<string, ValueSource> = Object.fromEntries(
    Object.keys(activeBuildings)
      .filter((recipeId) => (
        recipeId === settlementRecipeIds.residents
        || activeBuildings[recipeId] !== builtBuildings[recipeId]
      ))
      .map((recipeId) => [
        recipeId,
        recipeId in plannedWasteProcessingBuildings ? "planned" : dataSource,
      ]),
  );
  const planMismatches: PlanMismatch[] = [];

  if (syncedInventory) {
    for (const recipeId of Object.keys(activeBuildings)) {
      const count = recipeId === settlementRecipeIds.residentsII
        ? syncedInventory.housingIiCandidates
        : syncedInventory.counts[recipeId] ?? { built: 0, running: 0 };

      builtBuildings[recipeId] = count.built;
      activeBuildings[recipeId] = count.running;
      dataSources[recipeId] = "synced";
    }

    const plannedTargets: { recipeId: string; target: number }[] = [
      ...(dataSource === "planned"
        ? [{ recipeId: settlementRecipeIds.residents, target: residents }]
        : []),
      {
        recipeId: settlementRecipeIds.wastewaterTreatment,
        target: plannedWasteProcessingBuildings[settlementRecipeIds.wastewaterTreatment]
          * serviceFactor,
      },
      {
        recipeId: settlementRecipeIds.anaerobicDigester,
        target: plannedWasteProcessingBuildings[settlementRecipeIds.anaerobicDigester]
          * serviceFactor,
      },
    ];

    for (const target of plannedTargets) {
      const current = activeBuildings[target.recipeId] ?? 0;
      const resolved = resolveDirectionalPlan(
        { default: 0, synced: current },
        { direction: "at-least", target: target.target },
      );

      activeBuildings[target.recipeId] = resolved.value;
      if (resolved.satisfied) continue;
      dataSources[target.recipeId] = "planned";
      const names = populationBuildingNames[target.recipeId] ?? { name: "building" };
      const housingPlan = target.recipeId === settlementRecipeIds.residents
        ? createHousingPlanActions(
            builtBuildings[target.recipeId] ?? 0,
            current,
            target.target,
            syncedInventory.housingIiCandidates,
          )
        : null;
      const actions = housingPlan?.actions ?? createAtLeastBuildingActions({
        built: builtBuildings[target.recipeId] ?? 0,
        running: current,
        target: target.target,
        ...names,
      });

      if (housingPlan && housingPlan.upgradedRunningHousingIi > 0) {
        activeBuildings[settlementRecipeIds.residentsII] = Math.max(
          0,
          (activeBuildings[settlementRecipeIds.residentsII] ?? 0)
            - housingPlan.upgradedRunningHousingIi,
        );
        dataSources[settlementRecipeIds.residentsII] = "planned";
      }

      planMismatches.push({
        recipeId: target.recipeId,
        current,
        currentSource: "synced" as const,
        target: target.target,
        direction: "at-least" as const,
        format: "count" as const,
        actions,
      });
    }
  }

  const effectiveResidents = activeBuildings[settlementRecipeIds.residents] ?? residents;
  const activeHousingIi = activeBuildings[settlementRecipeIds.residentsII] ?? 0;
  const effectivePopulation = calculatePopulationCapacity(
    activeHousingType,
    effectiveResidents,
    capacityMultiplier,
  ) + calculatePopulationCapacity(
    housingTypes.housingII,
    activeHousingIi,
    capacityMultiplier,
  );

  return {
    id: HOUSING_MODULE_ID,
    name: "Population",
    description: syncedInventory
      ? `${builtBuildings[settlementRecipeIds.residents]} ${activeHousingType.name} and ${syncedInventory.housingIiCandidates.built} Housing II buildings synced from the Population area`
      : `Full-capacity ${activeHousingType.name} demand with settlement services and waste processing`,
    builtBuildings,
    presets: [
      {
        id: "housing-full-capacity",
        name: `${activeHousingType.name} — Full Capacity`,
        description: `${effectiveResidents} ${activeHousingType.name} buildings at full population capacity`,
        activeBuildings,
        dataSources,
        planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
        fixed: Object.keys(builtBuildings).filter((recipeId) => (
          recipeId !== settlementRecipeIds.wastewaterTreatment
          && recipeId !== settlementRecipeIds.anaerobicDigester
          && recipeId !== settlementRecipeIds.biomassCompostMixer
        )),
        speedLevels: {
          [settlementRecipeIds.residents]: capacityMultiplier,
          [settlementRecipeIds.residentsII]: capacityMultiplier,
          [settlementRecipeIds.internetModule]: effectivePopulation / 100,
        },
      },
    ],
    defaultPresetId: "housing-full-capacity",
  };
};

export const housing = createHousingModule(
  resolvedHousingCount.value,
  defaultInfiniteResearchLevels.housingCapacity,
  resolvedCurrentHousingCount.value,
  resolvedHousingCount.source,
);
