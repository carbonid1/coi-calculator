import { describe, expect, it } from "vitest";

import { type SyncedMachineInventoryItem } from "../game-state";
import { allocateSharedMachines } from "../helpers/machine-allocation/machine-allocation";
import { createDefaultModule } from "./modules/default";
import { createGreenhousesModule } from "./modules/farms";
import {
  DEFAULT_GROUNDWATER_CLAIM_ID,
  GREENHOUSES_GROUNDWATER_CLAIM_ID,
  groundwaterPumpClaims,
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
  it("keeps only the Greenhouses claim planned until live zones resolve ownership", () => {
    const allocation = allocateSharedMachines(
      [1, 2, 3, 4, 5, 6].map(id => machine(id, true, [
        { id: id <= 5 ? 7 : 9, name: `Zone ${id <= 5 ? 7 : 9}` },
      ])),
      groundwaterPumpClaims,
    );
    const greenhouses = createGreenhousesModule(
      undefined,
      undefined,
      undefined,
      undefined,
      allocation.claims[GREENHOUSES_GROUNDWATER_CLAIM_ID],
    );
    const general = createDefaultModule(allocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID]);

    expect(greenhouses.presets[0].activeBuildings["groundwater-pump"]).toBe(5);
    expect(greenhouses.presets[0].dataSources?.["groundwater-pump"]).toBe("planned");
    expect(greenhouses.presets[0].planMismatches?.find(({ recipeId }) => (
      recipeId === "groundwater-pump"
    ))).toMatchObject({ actions: [{ type: "assign" }] });
    expect(general.presets[0]).toMatchObject({
      activeBuildings: { "groundwater-pump-factory-reserve": 0 },
      dataSources: { "groundwater-pump-factory-reserve": "synced" },
    });
    expect(general.presets[0].planMismatches).toBeUndefined();
  });

  it("switches both module cards to synced from exact zone names and Default", () => {
    const allocation = allocateSharedMachines([
      ...[1, 2, 3, 4, 5].map(id => machine(id, true, [
        { id: 10, name: "Greenhouses" },
      ])),
      machine(6, true, []),
      machine(7, false, []),
      machine(8, false, []),
    ], groundwaterPumpClaims);
    const greenhouses = createGreenhousesModule(
      undefined,
      undefined,
      undefined,
      undefined,
      allocation.claims[GREENHOUSES_GROUNDWATER_CLAIM_ID],
    );
    const general = createDefaultModule(allocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID]);

    expect(greenhouses.presets[0].activeBuildings["groundwater-pump"]).toBe(5);
    expect(greenhouses.presets[0].dataSources?.["groundwater-pump"]).toBe("synced");
    expect(greenhouses.presets[0].planMismatches?.map(({ recipeId }) => recipeId))
      .not.toContain("groundwater-pump");
    expect(general.presets[0]).toMatchObject({
      activeBuildings: { "groundwater-pump-factory-reserve": 1 },
      dataSources: { "groundwater-pump-factory-reserve": "synced" },
    });
    expect(general.presets[0].planMismatches).toBeUndefined();
    expect(general.builtBuildings["groundwater-pump-factory-reserve"]).toBe(3);
  });

  it("keeps the live Default reserve inventory synced without generating a plan", () => {
    const allocation = allocateSharedMachines([
      machine(1, true, []),
      machine(2, false, []),
      machine(3, false, []),
    ], groundwaterPumpClaims);
    const general = createDefaultModule(allocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID]);

    expect(general.presets[0]).toMatchObject({
      activeBuildings: { "groundwater-pump-factory-reserve": 1 },
      dataSources: { "groundwater-pump-factory-reserve": "synced" },
    });
    expect(general.presets[0].planMismatches).toBeUndefined();
    expect(general.builtBuildings["groundwater-pump-factory-reserve"]).toBe(3);
  });
});
