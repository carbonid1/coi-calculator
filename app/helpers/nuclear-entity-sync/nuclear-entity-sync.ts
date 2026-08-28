import { type SyncedProductionEntity } from "../../game-state";

export const NUCLEAR_ZONE_NAME = "Nuclear";

export interface SyncedRecipeBuildingCount {
  built: number;
  running: number;
}

export interface ResolvedNuclearEntityInventory {
  counts: Record<string, SyncedRecipeBuildingCount>;
  speedLevels: Record<string, number>;
  entities: SyncedProductionEntity[];
  unmappedEntities: SyncedProductionEntity[];
}

interface RecipeMatcher {
  gameRecipeId?: string;
  prototypeId?: string;
  recipeId: string;
}

/**
 * Game recipe IDs are verified against Captain of Industry 0.8.7's installed
 * Mafi.Base IDs. Prototype-only entries have no configurable production recipe.
 */
const matchers: readonly RecipeMatcher[] = [
  {
    prototypeId: "OceanWaterPumpT1",
    gameRecipeId: "OceanWaterPumping2x",
    recipeId: "seawater-pump",
  },
  {
    prototypeId: "OceanWaterPumpLarge",
    gameRecipeId: "OceanWaterPumping2xT2",
    recipeId: "seawater-pump-tall",
  },
  {
    prototypeId: "NuclearReprocessingPlant",
    gameRecipeId: "CoreFuelReprocessing",
    recipeId: "nuclear-reprocessing",
  },
  {
    prototypeId: "UraniumEnrichmentPlant",
    gameRecipeId: "BlanketFuelReprocessing",
    recipeId: "enrichment-plant",
  },
  {
    prototypeId: "ChemicalPlant2",
    gameRecipeId: "BlanketFuelFromYellowcake",
    recipeId: "chemical-plant-yellowcake",
  },
  { prototypeId: "TurbineSuperPress", recipeId: "turbine-super" },
  { prototypeId: "TurbineHighPressT2", recipeId: "turbine-high" },
  { prototypeId: "TurbineLowPressT2", recipeId: "turbine-low" },
  { prototypeId: "PowerGeneratorT2", recipeId: "power-generator-ii-nuclear" },
  {
    prototypeId: "HydrogenReformer",
    gameRecipeId: "HydrogenProductionFromSteamSp",
    recipeId: "hydrogen-reformer-super",
  },
  {
    prototypeId: "ThermalDesalinator",
    gameRecipeId: "DesalinationFromDepleted",
    recipeId: "thermal-desalinator-depleted",
  },
  {
    prototypeId: "ThermalDesalinator",
    gameRecipeId: "DesalinationFromSP",
    recipeId: "thermal-desalinator-super",
  },
  {
    prototypeId: "ElectrolyzerT2",
    gameRecipeId: "BrineElectrolysis",
    recipeId: "electrolyzer-ii-chlorine",
  },
  {
    prototypeId: "EvaporationPondHeated",
    gameRecipeId: "SaltMakingFromBrine",
    recipeId: "evaporation-pond-heated-salt-brine",
  },
  { prototypeId: "CoolingTowerT2", recipeId: "cooling-tower-large-super" },
  { prototypeId: "CoolingTowerT2", recipeId: "cooling-tower-large-depleted" },
  {
    prototypeId: "WasteDump",
    gameRecipeId: "OceanWaterDumping",
    recipeId: "nuclear-liquid-dump-water",
  },
  {
    prototypeId: "WasteDump",
    gameRecipeId: "BrineDumping",
    recipeId: "nuclear-liquid-dump-brine",
  },
  {
    prototypeId: "SmokeStackLarge",
    gameRecipeId: "SmokeStackOxygen",
    recipeId: "nuclear-smoke-stack-large-oxygen",
  },
  { prototypeId: "NuclearWasteStorage", recipeId: "radioactive-waste-storage" },
  {
    prototypeId: "Shredder",
    gameRecipeId: "ShreddingRetiredWaste",
    recipeId: "shredder-retired-waste",
  },
];

const matches = (entity: SyncedProductionEntity, matcher: RecipeMatcher) => (
  (matcher.prototypeId == null || entity.prototypeId === matcher.prototypeId) &&
  (matcher.gameRecipeId == null || entity.recipeIds.includes(matcher.gameRecipeId))
);

const addCount = (
  counts: ResolvedNuclearEntityInventory["counts"],
  recipeId: string,
  running: boolean,
) => {
  const count = counts[recipeId] ?? { built: 0, running: 0 };

  count.built++;
  count.running += Number(running);
  counts[recipeId] = count;
};

export const resolveNuclearEntityInventory = (
  productionEntities: readonly SyncedProductionEntity[],
): ResolvedNuclearEntityInventory => {
  const entities = productionEntities.filter(entity => (
    entity.zones.some(zone => zone.name === NUCLEAR_ZONE_NAME)
  ));
  const counts: ResolvedNuclearEntityInventory["counts"] = {};
  const speedLevels: ResolvedNuclearEntityInventory["speedLevels"] = {};
  const matchedEntityIds = new Set<number>();
  const reactorPower = new Map<string, { built: number; running: number }>();

  for (const entity of entities) {
    if (entity.prototypeId === "FastBreederReactor" && entity.nuclearReactor) {
      let recipeId: "fbr-0x" | "fbr" | "fbr-3x" | null = null;

      if (entity.nuclearReactor.enrichmentStep === 0) recipeId = "fbr-0x";
      if (entity.nuclearReactor.enrichmentStep === 1) recipeId = "fbr";
      if (entity.nuclearReactor.enrichmentStep === 2) recipeId = "fbr-3x";

      if (recipeId) {
        addCount(counts, recipeId, entity.running);
        matchedEntityIds.add(entity.entityId);
        const total = reactorPower.get(recipeId) ?? { built: 0, running: 0 };
        const powerLevel = entity.nuclearReactor.targetPowerPercent / 100;

        total.built += powerLevel;
        total.running += entity.running ? powerLevel : 0;
        reactorPower.set(recipeId, total);
      }

      continue;
    }

    for (const matcher of matchers) {
      if (!matches(entity, matcher)) continue;

      addCount(counts, matcher.recipeId, entity.running);
      matchedEntityIds.add(entity.entityId);
    }
  }

  for (const [recipeId, totalPower] of reactorPower) {
    const count = counts[recipeId];

    if (!count) continue;
    let speedLevel = 1;

    if (count.built > 0) speedLevel = totalPower.built / count.built;
    if (count.running > 0) speedLevel = totalPower.running / count.running;
    speedLevels[recipeId] = speedLevel;
  }

  return {
    counts,
    speedLevels,
    entities,
    unmappedEntities: entities.filter(entity => !matchedEntityIds.has(entity.entityId)),
  };
};
