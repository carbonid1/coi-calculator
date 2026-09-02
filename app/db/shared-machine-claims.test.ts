import { describe, expect, it } from "vitest";

import { type SyncedMachineInventoryItem } from "../game-state";
import { allocateSharedMachines } from "../helpers/machine-allocation/machine-allocation";
import {
  getCropFarmGroundwaterClaimId,
  getCropFarmGroundwaterRecipeId,
} from "./modules/crop-farm-areas";
import { createDefaultModule } from "./modules/default";
import {
  createGroundwaterPumpClaims,
  DEFAULT_GROUNDWATER_CLAIM_ID,
} from "./shared-machine-claims";

const machine = (
  entityId: number,
  running: boolean,
  zones: { id: number; name: string | null }[],
): SyncedMachineInventoryItem => ({
  entityId,
  kind: "groundwater-pump",
  prototypeId: "WaterWell",
  running,
  customTitle: null,
  tile: { x: entityId, y: 0 },
  zones,
  aquifer: null,
});

describe("Groundwater Pump module claims", () => {
  it("creates a current-only claim for any generated crop-farm area", () => {
    const claims = createGroundwaterPumpClaims([{ id: 17, name: "West agriculture" }]);

    expect(claims).toContainEqual({
      id: getCropFarmGroundwaterClaimId(17),
      zoneId: 17,
      moduleId: "live-area-17",
      moduleName: "West agriculture",
      recipeId: getCropFarmGroundwaterRecipeId(17),
      machineName: "Groundwater Pump",
      kind: "groundwater-pump",
      target: 0,
    });
  });

  it("assigns area pumps by stable area ID and keeps unzoned pumps in Default", () => {
    const claimId = getCropFarmGroundwaterClaimId(17);
    const allocation = allocateSharedMachines([
      ...[1, 2, 3].map(id => machine(id, true, [
        { id: 17, name: "Renamed agriculture" },
      ])),
      machine(4, true, []),
      machine(5, false, []),
    ], createGroundwaterPumpClaims([{ id: 17, name: "West agriculture" }]));

    expect(allocation.claims[claimId]).toMatchObject({
      built: 3,
      running: 3,
      suggestedBuilt: 0,
      suggestedRunning: 0,
    });
    expect(allocation.claims[claimId]?.actions).toEqual([]);
    expect(allocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID]).toMatchObject({
      built: 2,
      running: 1,
    });
  });

  it("keeps the live Default reserve inventory synced without generating a plan", () => {
    const allocation = allocateSharedMachines([
      machine(1, true, []),
      machine(2, false, []),
      machine(3, false, []),
    ], createGroundwaterPumpClaims([]));
    const general = createDefaultModule(
      allocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID],
      {
        aquiferCount: 1,
        currentReserve: 1_000,
        reserveCapacity: 1_000,
        projectedPumpCount: 3,
        aquiferSustainableCeilingPerCycle: 72,
        pumpCapacityPerCycle: 36,
        sustainableOutputPerCycle: 72,
      },
    );

    expect(general.presets[0]).toMatchObject({
      activeBuildings: { "groundwater-pump-factory-reserve": 1 },
      dataSources: { "groundwater-pump-factory-reserve": "synced" },
    });
    expect(general.presets[0].planMismatches).not.toContainEqual(
      expect.objectContaining({ recipeId: "groundwater-pump-factory-reserve" }),
    );
    expect(general.builtBuildings["groundwater-pump-factory-reserve"]).toBe(3);
  });
});
