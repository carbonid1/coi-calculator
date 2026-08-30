import { settlementRecipeIds } from "../../db/settlement";
import {
  type SyncedLogisticsZoneRef,
  type SyncedProductionEntity,
} from "../../game-state";

export const POPULATION_ZONE_NAME = "Population";

export interface SyncedPopulationBuildingCount {
  built: number;
  running: number;
}

export interface ResolvedPopulationEntityInventory {
  counts: Partial<Record<string, SyncedPopulationBuildingCount>>;
  entities: SyncedProductionEntity[];
  housingIiCandidates: SyncedPopulationBuildingCount;
  unmappedEntities: SyncedProductionEntity[];
}

export interface PopulationEntityMatcher {
  prototypeId: string;
  gameRecipeIds?: readonly string[];
  recipeId: string;
}

/**
 * Prototype IDs are verified against Captain of Industry 0.8.7's installed
 * Mafi.Base IDs. Configurable machines also require the relevant live recipe,
 * so another process placed inside Population cannot satisfy its plan.
 */
export const populationEntityMatchers: readonly PopulationEntityMatcher[] = [
  { prototypeId: "HousingT2", recipeId: settlementRecipeIds.residentsII },
  { prototypeId: "HousingT3", recipeId: settlementRecipeIds.residents },
  { prototypeId: "SettlementFoodModule", recipeId: settlementRecipeIds.foodMarket },
  { prototypeId: "SettlementFoodModuleT2", recipeId: settlementRecipeIds.foodMarketII },
  { prototypeId: "SettlementPowerModule", recipeId: settlementRecipeIds.transformer },
  { prototypeId: "SettlementWaterModule", recipeId: settlementRecipeIds.waterFacility },
  {
    prototypeId: "SettlementHouseholdGoodsModule",
    recipeId: settlementRecipeIds.householdGoodsModule,
  },
  { prototypeId: "SettlementLandfillModule", recipeId: settlementRecipeIds.wasteCollection },
  {
    prototypeId: "SettlementRecyclablesModule",
    recipeId: settlementRecipeIds.recyclablesCollection,
  },
  {
    prototypeId: "SettlementBiomassModule",
    recipeId: settlementRecipeIds.biomassCollection,
  },
  { prototypeId: "Hospital", recipeId: settlementRecipeIds.clinic },
  {
    prototypeId: "SettlementComputingModule",
    recipeId: settlementRecipeIds.internetModule,
  },
  {
    prototypeId: "WaterTreatmentPlant",
    gameRecipeIds: ["WaterTreatment", "WaterTreatmentT2"],
    recipeId: settlementRecipeIds.wastewaterTreatment,
  },
  {
    prototypeId: "AnaerobicDigester",
    gameRecipeIds: ["SludgeDigestion"],
    recipeId: settlementRecipeIds.anaerobicDigester,
  },
  {
    prototypeId: "IndustrialMixerT2",
    gameRecipeIds: ["BiomassCompost"],
    recipeId: settlementRecipeIds.biomassCompostMixer,
  },
];

export const ignoredPopulationPrototypeIds = new Set([
  "SettlementFountain",
  "SettlementPillar",
  "SettlementSquare1",
  "SettlementSquare2",
]);

const matches = (
  entity: SyncedProductionEntity,
  matcher: PopulationEntityMatcher,
) => entity.prototypeId === matcher.prototypeId
  && (
    matcher.gameRecipeIds == null
    || matcher.gameRecipeIds.some(recipeId => entity.recipeIds.includes(recipeId))
  );

export const resolvePopulationEntityInventory = (
  productionEntities: readonly SyncedProductionEntity[],
  zoneId?: number,
): ResolvedPopulationEntityInventory => {
  const entities = productionEntities.filter(entity => (
    entity.zones.some(zone => (
      zone.name === POPULATION_ZONE_NAME && (zoneId === undefined || zone.id === zoneId)
    ))
  ));
  const counts: ResolvedPopulationEntityInventory["counts"] = {};
  const housingIiCandidates = { built: 0, running: 0 };
  const matchedEntityIds = new Set<number>();

  for (const entity of entities) {
    const matcher = populationEntityMatchers.find(candidate => matches(entity, candidate));

    if (!matcher) continue;
    const count = counts[matcher.recipeId] ?? { built: 0, running: 0 };

    count.built++;
    count.running += Number(entity.running);
    counts[matcher.recipeId] = count;
    if (matcher.recipeId === settlementRecipeIds.residentsII) {
      housingIiCandidates.built = count.built;
      housingIiCandidates.running = count.running;
    }
    matchedEntityIds.add(entity.entityId);
  }

  return {
    counts,
    entities,
    housingIiCandidates,
    unmappedEntities: entities.filter(entity => !matchedEntityIds.has(entity.entityId)),
  };
};

export const getPopulationZones = (
  productionEntities: readonly SyncedProductionEntity[],
): SyncedLogisticsZoneRef[] => {
  const zones = new Map<number, SyncedLogisticsZoneRef>();

  for (const entity of productionEntities) {
    for (const zone of entity.zones) {
      if (zone.name === POPULATION_ZONE_NAME) zones.set(zone.id, zone);
    }
  }

  return [...zones.values()];
};
