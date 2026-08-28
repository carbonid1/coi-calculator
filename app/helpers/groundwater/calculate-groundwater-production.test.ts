import { describe, expect, it } from "vitest";

import { type SyncedGroundwaterAquifer, type SyncedMachineInventoryItem } from "../../game-state";
import {
  calculateAquiferSustainableCeiling,
  calculateAquiferSustainableOutput,
  calculateGroundwaterClaimLimits,
} from "./calculate-groundwater-production";

const aquifer: SyncedGroundwaterAquifer = {
  id: "100:200",
  position: { x: 100, y: 200 },
  quantity: 0,
  capacity: 20_000,
  configuredCapacity: 20_000,
};

const normalGroundwater = {
  depletedPumpSpeedPercent: 40,
  replenishWhenLowPercent: 7,
};

const machine = (
  entityId: number,
  running: boolean,
  assignedAquifer: SyncedGroundwaterAquifer = aquifer,
): SyncedMachineInventoryItem => ({
  entityId,
  kind: "groundwater-pump",
  prototypeId: "LandWaterPump",
  running,
  customTitle: null,
  tile: { x: entityId, y: 0 },
  zones: [],
  aquifer: assignedAquifer,
});

describe("groundwater sustainable production", () => {
  it("keeps an empty aquifer productive but below installed pump throughput", () => {
    const output = calculateAquiferSustainableOutput(
      aquifer,
      5,
      normalGroundwater,
    );

    expect(output).toBeGreaterThan(0);
    expect(output).toBeLessThan(5 * 48);
  });

  it("reports the physical aquifer ceiling independently of pump count", () => {
    const ceiling = calculateAquiferSustainableCeiling(aquifer, normalGroundwater);
    const onePumpOutput = calculateAquiferSustainableOutput(
      aquifer,
      1,
      normalGroundwater,
    );

    expect(ceiling).toBeGreaterThan(onePumpOutput);
    expect(calculateGroundwaterClaimLimits([{
      claimId: "general",
      projectedPumpCount: 1,
      machines: [machine(1, true)],
    }], normalGroundwater).general?.aquiferSustainableCeilingPerCycle).toBe(ceiling);
  });

  it("does not charge the one-time depleted startup against the steady-state rate", () => {
    expect(calculateAquiferSustainableOutput(
      { ...aquifer, quantity: aquifer.capacity },
      1,
      normalGroundwater,
    )).toBeCloseTo(48, 10);
  });

  it("keeps reserve metadata when every assigned pump is paused", () => {
    const fullAquifer = { ...aquifer, quantity: aquifer.capacity };
    const constraint = calculateGroundwaterClaimLimits([{
      claimId: "general",
      projectedPumpCount: 0,
      machines: [machine(1, false, fullAquifer), machine(2, false, fullAquifer)],
    }], normalGroundwater).general;

    expect(constraint).toMatchObject({
      aquiferCount: 1,
      currentReserve: 20_000,
      reserveCapacity: 20_000,
      projectedPumpCount: 0,
      pumpCapacityPerCycle: 0,
      sustainableOutputPerCycle: 0,
    });
    expect(constraint?.aquiferSustainableCeilingPerCycle).toBeGreaterThan(48);
  });

  it("stops dry-weather emergency pumping when the difficulty setting disables it", () => {
    const normalOutput = calculateAquiferSustainableOutput(
      aquifer,
      5,
      normalGroundwater,
    );
    const hardOutput = calculateAquiferSustainableOutput(aquifer, 5, {
      depletedPumpSpeedPercent: 0,
      replenishWhenLowPercent: 0,
    });

    expect(hardOutput).toBeGreaterThan(0);
    expect(hardOutput).toBeLessThan(normalOutput);
  });

  it("does not count a shared aquifer recharge once per calculator claim", () => {
    const limits = calculateGroundwaterClaimLimits([
      {
        claimId: "greenhouses",
        projectedPumpCount: 4,
        machines: [1, 2, 3, 4].map(id => machine(id, true)),
      },
      {
        claimId: "general",
        projectedPumpCount: 1,
        machines: [machine(5, true)],
      },
    ], normalGroundwater);
    const sharedOutput = calculateAquiferSustainableOutput(
      aquifer,
      5,
      normalGroundwater,
    );
    const greenhouseOutput = limits.greenhouses?.sustainableOutputPerCycle ?? 0;
    const generalOutput = limits.general?.sustainableOutputPerCycle ?? 0;

    expect(greenhouseOutput).toBeCloseTo(sharedOutput * 0.8, 10);
    expect(generalOutput).toBeCloseTo(sharedOutput * 0.2, 10);
    expect(greenhouseOutput + generalOutput).toBeCloseTo(sharedOutput, 10);
    expect(limits.greenhouses).toMatchObject({
      aquiferCount: 1,
      currentReserve: 0,
      reserveCapacity: 20_000,
      projectedPumpCount: 4,
      aquiferSustainableCeilingPerCycle: calculateAquiferSustainableCeiling(
        aquifer,
        normalGroundwater,
      ),
      pumpCapacityPerCycle: 192,
    });
  });
});
