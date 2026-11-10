import { type SyncedProductionEntity } from "../../game-state";

interface SyncedRecipeBuildingCount {
  built: number;
  running: number;
}

export interface ResolvedNuclearEntityInventory {
  counts: Record<string, SyncedRecipeBuildingCount>;
  speedLevels: Record<string, number>;
  autoBalanceOffBuildings: Record<string, number>;
  pausedAutoBalanceOffBuildings: Record<string, number>;
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

/** Ordinary recipe bindings retain calculator policy while the game supplies their flows. */
export const nuclearRecipeBindings = [
  ...matchers.filter((matcher): matcher is RecipeMatcher & { prototypeId: string; gameRecipeId: string } => (
    matcher.prototypeId != null && matcher.gameRecipeId != null
  )),
  { prototypeId: 'ThermalDesalinator', gameRecipeId: 'DesalinationFromLP', recipeId: 'thermal-desalinator-low' },
  { prototypeId: 'CoolingTowerT2', gameRecipeId: 'SteamDepletedCondensationT2', recipeId: 'cooling-tower-large-depleted' },
  { prototypeId: 'CoolingTowerT2', gameRecipeId: 'SteamLpCondensationT2', recipeId: 'cooling-tower-large-low' },
  { prototypeId: 'CoolingTowerT2', gameRecipeId: 'SteamSpCondensationT2', recipeId: 'cooling-tower-large-super' },
];

/** These machines do not export ordinary recipes; their physical models remain local. */
export const nuclearSpecialPrototypeIds = new Set([
  'FastBreederReactor', 'TurbineSuperPress', 'TurbineHighPressT2',
  'TurbineLowPressT2', 'PowerGeneratorT2', 'NuclearWasteStorage',
]);

/** Fixed configurations can reuse the area's prototype-level construction inventory. */
export const nuclearSpecialRecipeBindings = matchers.flatMap(binding => (
  binding.prototypeId && binding.gameRecipeId == null && nuclearSpecialPrototypeIds.has(binding.prototypeId)
    ? [{ prototypeId: binding.prototypeId, recipeId: binding.recipeId }]
    : []
));

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
  zoneId?: number,
): ResolvedNuclearEntityInventory => {
  const entities = zoneId == null
    ? [...productionEntities]
    : productionEntities.filter(entity => (
        entity.zones.some(zone => zone.id === zoneId)
      ));
  const counts: ResolvedNuclearEntityInventory["counts"] = {};
  const speedLevels: ResolvedNuclearEntityInventory["speedLevels"] = {};
  const autoBalanceOffBuildings: Record<string, number> = {};
  const pausedAutoBalanceOffBuildings: Record<string, number> = {};
  const matchedEntityIds = new Set<number>();
  const reactorPower = new Map<string, { built: number; running: number }>();

  for (const entity of entities) {
    if (entity.prototypeId === "FastBreederReactor" && entity.nuclearReactor) {
      const recipeId = (() => {
        if (entity.nuclearReactor.enrichmentStep === 0) return "fbr-0x";
        if (entity.nuclearReactor.enrichmentStep === 1) return "fbr";
        if (entity.nuclearReactor.enrichmentStep === 2) return "fbr-3x";
        return null;
      })();

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
      if (entity.prototypeId.startsWith('Turbine') && entity.turbineAutoBalance === false) {
        const modeCounts = entity.running ? autoBalanceOffBuildings : pausedAutoBalanceOffBuildings;

        modeCounts[matcher.recipeId] = (modeCounts[matcher.recipeId] ?? 0) + 1;
      }
      matchedEntityIds.add(entity.entityId);
    }
  }

  for (const [recipeId, totalPower] of reactorPower) {
    const count = counts[recipeId];

    if (!count) continue;
    const activeCount = count.running > 0 ? count.running : count.built;
    const total = count.running > 0 ? totalPower.running : totalPower.built;

    speedLevels[recipeId] = activeCount > 0 ? total / activeCount : 1;
  }

  return {
    counts,
    speedLevels,
    autoBalanceOffBuildings,
    pausedAutoBalanceOffBuildings,
    entities,
    unmappedEntities: entities.filter(entity => !matchedEntityIds.has(entity.entityId)),
  };
};
