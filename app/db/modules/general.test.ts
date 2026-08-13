import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { createFbrPowerPlantModule } from "./fbr-power-plant";
import { modules } from "./modules";
import { NUCLEAR_MODULE_ID } from "./nuclear";

it("demand-balances enough Yellowcake for the two-FBR target", () => {
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
  );
  const yellowcake = result.flows.find((flow) => flow.resourceId === "yellowcake");
  const settlingTank = result.calculation.regularResults.find((candidate) => (
    candidate.moduleId === "general" && candidate.recipe.id === "settling-tank"
  ));

  expect(yellowcake?.consumed).toBe(9);
  expect(yellowcake?.produced).toBe(9);
  expect(yellowcake?.net).toBe(0);
  expect(settlingTank).toMatchObject({
    activeBuildings: 2,
    operatingMode: "balanced",
    supplyRatio: 0.75,
    actualInputs: [
      { resourceId: "uraniumOrePowder", quantity: 54 },
      { resourceId: "acid", quantity: 18 },
    ],
    actualOutputs: [
      { resourceId: "yellowcake", quantity: 9 },
      { resourceId: "toxicSlurry", quantity: 54 },
    ],
  });
});

it("caps demand-balanced Groundwater Pumps and leaves Water at equilibrium", () => {
  const result = calculateFactoryTotal(
    modules
      .filter((module) => module.id !== NUCLEAR_MODULE_ID)
      .concat(createFbrPowerPlantModule({
        averageNuclearGenerationMw: 30.2,
        hydrogenFuelDemandPerCycle: 50,
      })),
    activeContracts,
  );
  const water = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "water",
  );
  const groundwater = result.calculation.sourceResults.find(
    (candidate) => candidate.recipe.id === "groundwater-pump",
  );
  const pumped = groundwater?.actualOutputs[0]?.quantity ?? 0;

  expect([
    groundwater?.activeBuildings,
    pumped > 0,
    pumped <= 4 * 48,
    Number((water?.net ?? NaN).toFixed(10)),
  ]).toEqual([4, true, true, 0]);
});
