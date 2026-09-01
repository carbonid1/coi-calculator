import { createNuclearModule } from "../db/modules/nuclear";
import { type SyncedProductionEntity } from "../game-state";

let entityId = 1;
const entity = (
  prototypeId: string,
  recipeIds: string[] = [],
  running = true,
): SyncedProductionEntity => ({
  entityId: entityId++,
  prototypeId,
  running,
  recipeIds,
  zones: [{ id: 14, name: "Nuclear" }],
  nuclearReactor: null,
});
const many = (
  built: number,
  running: number,
  prototypeId: string,
  recipeIds: string[] = [],
) => Array.from(
  { length: built },
  (_, index) => entity(prototypeId, recipeIds, index < running),
);

const syncedNuclearEntities: SyncedProductionEntity[] = [
  {
    ...entity("FastBreederReactor"),
    nuclearReactor: { enrichmentStep: 0, targetPowerPercent: 400 },
  },
  {
    ...entity("FastBreederReactor"),
    nuclearReactor: { enrichmentStep: 2, targetPowerPercent: 100 },
  },
  ...many(4, 4, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
  ...many(1, 1, "NuclearReprocessingPlant", ["CoreFuelReprocessing"]),
  ...many(2, 2, "UraniumEnrichmentPlant", ["BlanketFuelReprocessing"]),
  ...many(2, 2, "ChemicalPlant2", ["BlanketFuelFromYellowcake"]),
  ...many(8, 3, "TurbineSuperPress"),
  ...many(8, 3, "TurbineHighPressT2"),
  ...many(8, 3, "TurbineLowPressT2"),
  ...many(16, 6, "PowerGeneratorT2"),
  ...many(8, 8, "HydrogenReformer", ["HydrogenProductionFromSteamSp"]),
  ...many(4, 4, "ThermalDesalinator", ["DesalinationFromDepleted"]),
  ...many(6, 6, "ThermalDesalinator", ["DesalinationFromSP"]),
  ...many(2, 1, "ElectrolyzerT2", ["BrineElectrolysis"]),
  ...many(2, 1, "EvaporationPondHeated", ["SaltMakingFromBrine"]),
  ...many(4, 4, "CoolingTowerT2", [
    "SteamDepletedCondensationT2",
    "SteamHpCondensationT2",
    "SteamLpCondensationT2",
    "SteamSpCondensationT2",
  ]),
  ...many(1, 1, "WasteDump", ["OceanWaterDumping"]),
  ...many(1, 1, "WasteDump", ["BrineDumping"]),
  ...many(1, 1, "SmokeStackLarge", ["SmokeStackOxygen"]),
  ...many(1, 1, "NuclearWasteStorage"),
  ...many(1, 1, "Shredder", ["ShreddingRetiredWaste"]),
];

export const syncedNuclearTestModule = createNuclearModule(
  {
    averageGeneratorOutputMw: 77,
    hydrogenFuelDemandPerCycle: 46.5,
  },
  undefined,
  syncedNuclearEntities,
);
