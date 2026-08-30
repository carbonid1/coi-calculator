import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import {
  getComputingZones,
  resolveComputingEntityInventory,
} from "./computing-entity-sync";

const entity = (
  entityId: number,
  prototypeId: string,
  options: Partial<SyncedProductionEntity> = {},
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running: true,
  recipeIds: [],
  zones: [{ id: 15, name: "Computing" }],
  nuclearReactor: null,
  dataCenterRacks: null,
  ...options,
});

it("counts only Data Centers and Water Chillers in the exact Computing area", () => {
  const inventory = resolveComputingEntityInventory([
    entity(1, "DataCenter", { dataCenterRacks: 48 }),
    entity(2, "DataCenter", { dataCenterRacks: 32, running: false }),
    entity(3, "WaterChiller"),
    entity(4, "WaterChiller", { running: false }),
    entity(5, "DataCenter", {
      dataCenterRacks: 48,
      zones: [{ id: 16, name: "Computing Backup" }],
    }),
    entity(6, "HydrogenReformer"),
  ]);

  expect(inventory.built).toEqual({
    dataCenterCount: 2,
    rackCount: 80,
    waterChillers: 2,
  });
  expect(inventory.running).toEqual({
    dataCenterCount: 1,
    rackCount: 48,
    waterChillers: 1,
  });
  expect(inventory.entities.map(({ entityId }) => entityId)).toEqual([1, 2, 3, 4]);
});

it("scopes inventory to one exact Computing area ID", () => {
  const entities = [
    entity(1, "DataCenter", { dataCenterRacks: 48 }),
    entity(2, "WaterChiller"),
    entity(3, "DataCenter", {
      dataCenterRacks: 20,
      zones: [{ id: 17, name: "Computing" }],
    }),
  ];

  expect(getComputingZones(entities)).toEqual([
    { id: 15, name: "Computing" },
    { id: 17, name: "Computing" },
  ]);
  expect(resolveComputingEntityInventory(entities, 15)).toMatchObject({
    built: { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    running: { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
  });
  expect(resolveComputingEntityInventory(entities, 17)).toMatchObject({
    built: { dataCenterCount: 1, rackCount: 20, waterChillers: 0 },
    running: { dataCenterCount: 1, rackCount: 20, waterChillers: 0 },
  });
});
