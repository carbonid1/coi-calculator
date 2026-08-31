import { expect, it } from "vitest";

import { recipes } from "../../db/recipes";
import { type SyncedProductionEntity } from "../../game-state";
import { resolveNuclearEntityInventory } from "./nuclear-entity-sync";

const entity = (
  entityId: number,
  prototypeId: string,
  recipeIds: string[] = [],
  options: Partial<SyncedProductionEntity> = {},
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running: true,
  recipeIds,
  zones: [{ id: 14, name: "Nuclear" }],
  nuclearReactor: null,
  ...options,
});

it("maps only exact Nuclear-area entities and preserves paused counts", () => {
  const inventory = resolveNuclearEntityInventory([
    entity(1, "HydrogenReformer", ["HydrogenProductionFromSteamSp"]),
    entity(2, "HydrogenReformer", ["HydrogenProductionFromSteamSp"], {
      running: false,
    }),
    entity(3, "HydrogenReformer", ["HydrogenProductionFromSteamSp"], {
      zones: [{ id: 15, name: "Nuclear Backup" }],
    }),
    entity(4, "CoolingTowerT2"),
  ], 14);

  expect(inventory.counts).toMatchObject({
    "hydrogen-reformer-super": { built: 2, running: 1 },
    "cooling-tower-large-super": { built: 1, running: 1 },
    "cooling-tower-large-depleted": { built: 1, running: 1 },
  });
  expect(inventory.entities.map(({ entityId }) => entityId)).toEqual([1, 2, 4]);
});

it("uses assigned recipes to bind only configurations owned by Nuclear", () => {
  const inventory = resolveNuclearEntityInventory([
    entity(1, "NuclearReprocessingPlant", ["CoreFuelReprocessing"]),
    entity(2, "UraniumEnrichmentPlant", ["BlanketFuelReprocessing"]),
    entity(3, "ThermalDesalinator", ["DesalinationFromDepleted"]),
    entity(4, "WasteDump", ["BrineDumping"]),
    entity(5, "ThermalDesalinator", ["DesalinationFromLP"]),
  ], 14);

  expect(inventory.counts).toEqual({
    "nuclear-reprocessing": { built: 1, running: 1 },
    "enrichment-plant": { built: 1, running: 1 },
    "thermal-desalinator-depleted": { built: 1, running: 1 },
    "nuclear-liquid-dump-brine": { built: 1, running: 1 },
  });
  expect(inventory.unmappedEntities.map(({ entityId }) => entityId)).toEqual([5]);
});

it("recognizes both fast seawater pump tiers by their exact game recipes", () => {
  const inventory = resolveNuclearEntityInventory([
    entity(1, "OceanWaterPumpLarge", ["OceanWaterPumping2xT2"]),
    entity(2, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    entity(3, "OceanWaterPumpT1", ["OceanWaterPumping"]),
  ], 14);

  expect(inventory.counts).toMatchObject({
    "seawater-pump": { built: 1, running: 1 },
    "seawater-pump-tall": { built: 1, running: 1 },
  });
  expect(recipes.find(({ id }) => id === "seawater-pump")?.building)
    .toBe("Seawater Pump");
  expect(recipes.find(({ id }) => id === "seawater-pump-tall")?.building)
    .toBe("Seawater Pump (Tall)");
  expect(inventory.unmappedEntities.map(({ entityId }) => entityId)).toEqual([3]);
});

it("groups reactor enrichment modes and averages their configured power", () => {
  const inventory = resolveNuclearEntityInventory([
    entity(1, "FastBreederReactor", [], {
      nuclearReactor: { enrichmentStep: 0, targetPowerPercent: 400 },
    }),
    entity(2, "FastBreederReactor", [], {
      nuclearReactor: { enrichmentStep: 2, targetPowerPercent: 100 },
    }),
    entity(3, "FastBreederReactor", [], {
      nuclearReactor: { enrichmentStep: 2, targetPowerPercent: 300 },
    }),
    entity(4, "FastBreederReactor", [], {
      nuclearReactor: { enrichmentStep: 1, targetPowerPercent: 200 },
    }),
  ], 14);

  expect(inventory.counts).toMatchObject({
    "fbr-0x": { built: 1, running: 1 },
    fbr: { built: 1, running: 1 },
    "fbr-3x": { built: 2, running: 2 },
  });
  expect(inventory.speedLevels).toEqual({
    "fbr-0x": 4,
    fbr: 2,
    "fbr-3x": 2,
  });
  expect(inventory.unmappedEntities).toEqual([]);
});
