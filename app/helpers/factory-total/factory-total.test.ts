import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import { maintenanceDemandPerMonth } from "../../db/modules/maintenance";
import { modules } from "../../db/modules/modules";
import { defaultInfiniteResearchLevels } from "../../db/research";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
import { calculateFactoryTotal } from "./factory-total";

describe("Factory Total contracts", () => {
  it("uses the fixed active Uranium import plan", () => {
    const result = calculateFactoryTotal(modules, activeContracts);
    const contractResult = result.contractResults.at(0);

    expect(contractResult).toMatchObject({
      exported: 36,
      imported: 54,
      requiredImported: 54,
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
      fuelPerProductionCycle: 9.75375,
    });

  });

  it("keeps uncovered Uranium demand visible instead of resizing the contract", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();

    const result = calculateFactoryTotal(
      modules,
      contract
        ? [{
            ...contract,
            plan: {
              ...contract.plan,
              importedPerProductionCycle: 36,
            },
          }]
        : [],
    );
    const uranium = result.flows.find((flow) => flow.resourceId === "uraniumOre");

    expect(result.contractResults.at(0)).toMatchObject({
      imported: 36,
      requiredImported: 54,
      uncoveredImported: 18,
    });
    expect(uranium).toMatchObject({ consumed: 54, produced: 36, net: -18 });
  });

  it("adds 140 Maintenance III without pinning the two depots", () => {
    const maintenanceOutput = calculateMaintenanceOutput(
      defaultInfiniteResearchLevels.maintenanceOutput,
    );
    const result = calculateFactoryTotal(
      modules,
      activeContracts,
      undefined,
      { maintenanceOutput: maintenanceOutput.multiplier },
    );
    const maintenanceIII = result.calculation.regularResults.find(
      (line) => line.recipe.id === "maintenance-iii-recycling",
    );
    const produced = maintenanceIII?.actualOutputs.find(
      (output) => output.resourceId === "maintenanceIII",
    )?.quantity;

    expect(maintenanceDemandPerMonth.maintenanceIII).toBe(263);
    expect(maintenanceIII).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 2,
    });
    expect(maintenanceIII?.supplyRatio ?? 1).toBeLessThan(1);
    expect(produced).toBeCloseTo(263);
  });
});
