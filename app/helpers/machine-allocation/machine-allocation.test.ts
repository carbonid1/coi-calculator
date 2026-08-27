import { describe, expect, it } from "vitest";

import { type SyncedMachineInventoryItem } from "../../game-state";
import {
  allocateSharedMachines,
  type SharedMachineClaim,
} from "./machine-allocation";

const claims: SharedMachineClaim[] = [
  {
    id: "greenhouses-groundwater",
    moduleId: "greenhouses",
    moduleName: "Greenhouses",
    recipeId: "groundwater-pump",
    machineName: "Groundwater Pump",
    kind: "groundwater-pump",
    target: 5,
  },
  {
    id: "general-groundwater",
    moduleId: "general",
    moduleName: "General",
    recipeId: "groundwater-pump-factory-reserve",
    machineName: "Groundwater Pump",
    kind: "groundwater-pump",
    target: 1,
  },
];

const machine = (
  entityId: number,
  running: boolean,
  zones: { id: number; name: string | null }[] = [],
): SyncedMachineInventoryItem => ({
  entityId,
  kind: "groundwater-pump",
  prototypeId: "WaterWell",
  running,
  customTitle: null,
  tile: { x: entityId, y: 0 },
  zones,
});

describe("shared machine allocation", () => {
  it("auto-assigns the live Greenhouses zone and Default to General", () => {
    const result = allocateSharedMachines([
      ...[1, 2, 3, 4, 5].map(id => machine(id, true, [
        { id: 10, name: "Greenhouses" },
      ])),
      machine(6, true),
      machine(7, false),
      machine(8, false),
    ], claims);

    expect(result.claims["greenhouses-groundwater"]).toMatchObject({
      built: 5,
      running: 5,
      suggestedBuilt: 0,
      actions: [],
    });
    expect(result.claims["general-groundwater"]).toMatchObject({
      built: 3,
      running: 1,
      suggestedBuilt: 0,
      actions: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.inventory).toEqual([{
      kind: "groundwater-pump",
      machineName: "Groundwater Pump",
      built: 8,
      running: 6,
      paused: 2,
      assigned: 8,
      unresolved: 0,
    }]);
    expect(result.zones).toEqual([
      expect.objectContaining({
        id: -1,
        name: "Default",
        built: 3,
        running: 1,
        paused: 2,
        assignedClaimId: "general-groundwater",
      }),
      expect.objectContaining({
        id: 10,
        name: "Greenhouses",
        built: 5,
        running: 5,
        paused: 0,
        assignedClaimId: "greenhouses-groundwater",
      }),
    ]);
  });

  it("uses one-time zone mappings as synced module ownership", () => {
    const result = allocateSharedMachines([
      ...[1, 2, 3, 4, 5].map(id => machine(id, true, [{ id: 7, name: "Farms" }])),
      machine(6, true, [{ id: 9, name: "Factory" }]),
    ], claims, {
      7: "greenhouses-groundwater",
      9: "general-groundwater",
    });

    expect(result.claims["greenhouses-groundwater"]).toMatchObject({
      built: 5,
      running: 5,
      suggestedBuilt: 0,
      actions: [],
    });
    expect(result.claims["general-groundwater"]).toMatchObject({
      built: 1,
      running: 1,
      suggestedBuilt: 0,
      actions: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.inventory).toEqual([expect.objectContaining({
      built: 6,
      running: 6,
      paused: 0,
      assigned: 6,
      unresolved: 0,
    })]);
    expect(result.zones).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 7, manuallyAssigned: true }),
      expect.objectContaining({ id: 9, manuallyAssigned: true }),
    ]));
  });

  it("never splits one unresolved vehicle zone across module suggestions", () => {
    const result = allocateSharedMachines(
      [1, 2, 3, 4, 5, 6].map(id => machine(id, true, [
        { id: 7, name: "Shared pumps" },
      ])),
      claims,
    );

    expect(result.claims["greenhouses-groundwater"]).toMatchObject({
      suggestedBuilt: 6,
      suggestedRunning: 6,
      actions: [{
        type: "assign",
        label: "Map 6 existing Groundwater Pumps to Greenhouses by vehicle zone",
      }],
    });
    expect(result.claims["general-groundwater"]).toMatchObject({
      suggestedBuilt: 0,
      suggestedRunning: 0,
    });
  });

  it("does not assign a machine covered by zones mapped to different modules", () => {
    const result = allocateSharedMachines([
      machine(1, true, [{ id: 7, name: "Farms" }, { id: 9, name: "Factory" }]),
    ], claims, {
      7: "greenhouses-groundwater",
      9: "general-groundwater",
    });

    expect(result.claims["greenhouses-groundwater"]?.built).toBe(0);
    expect(result.claims["general-groundwater"]?.built).toBe(0);
    expect(result.issues).toEqual([expect.objectContaining({
      id: "conflicting-groundwater-pump-zones",
      count: 1,
    })]);
  });

  it("allows overlapping zones when they map to the same module", () => {
    const result = allocateSharedMachines([
      machine(1, true, [{ id: 7, name: "Farms" }, { id: 8, name: "Farms 2" }]),
    ], claims, {
      7: "greenhouses-groundwater",
      8: "greenhouses-groundwater",
    });

    expect(result.claims["greenhouses-groundwater"]?.built).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it("keeps legacy inventory unresolved until zone data is available", () => {
    const result = allocateSharedMachines(
      [machine(1, true)],
      claims,
      {},
      false,
    );

    expect(result.inventory[0]).toMatchObject({ assigned: 0, unresolved: 1 });
    expect(result.issues[0]?.message).toContain("pending exporter update");
    expect(result.zones).toEqual([]);
  });
});
