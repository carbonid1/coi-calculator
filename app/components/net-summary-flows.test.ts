import { expect, it } from "vitest";

import { type RegularResult, type ResourceFlow } from "../helpers/calculate/calculate";
import { isReadyStandbyAllowance } from "./net-summary-flows";

const producer: RegularResult = {
  recipe: { id: "rail", name: "Rail Parts", building: "Assembly V", group: "production",
    inputs: [], outputs: [{ resourceId: "railParts", quantity: 64 }],
    standbyPlan: { resourceId: "railParts", quantity: 0.62 } },
  moduleId: "general", activeBuildings: 1, currentActiveBuildings: 1, builtBuildings: 1,
  operatingMode: "balanced", supplyRatio: 0, speedLevel: 1,
  actualInputs: [], actualOutputs: [], recyclableSourceValueProduced: 0,
};
const flow: ResourceFlow = { resourceId: "railParts", name: "Rail Parts", consumed: 0.62, produced: 0, net: -0.62 };

it("keeps the ready construction allowance quiet without concealing larger or upstream deficits", () => {
  expect(isReadyStandbyAllowance(flow, [producer])).toBe(true);
  expect(isReadyStandbyAllowance({ ...flow, net: -5 }, [producer])).toBe(false);
  expect(isReadyStandbyAllowance({ ...flow, resourceId: "steel" }, [producer])).toBe(false);
  expect(isReadyStandbyAllowance(flow, [{ ...producer, currentActiveBuildings: 0 }])).toBe(false);
});
