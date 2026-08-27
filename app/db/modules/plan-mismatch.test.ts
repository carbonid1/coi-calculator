import { expect, it } from "vitest";

import {
  createAtLeastBuildingActions,
  createAtMostBuildingActions,
} from "./plan-mismatch";

it("splits paused capacity from missing construction", () => {
  expect(createAtLeastBuildingActions({
    built: 5,
    running: 1,
    target: 6,
    name: "Water Pump",
  })).toEqual([
    { type: "unpause", label: "Unpause 4 Water Pumps" },
    { type: "build", label: "Build 1 Water Pump" },
  ]);
});

it("uses only enough paused capacity to reach the target", () => {
  expect(createAtLeastBuildingActions({
    built: 5,
    running: 1,
    target: 3,
    name: "Water Pump",
  })).toEqual([
    { type: "unpause", label: "Unpause 2 Water Pumps" },
  ]);
});

it("pauses only the capacity above an at-most target", () => {
  expect(createAtMostBuildingActions({
    running: 6,
    target: 5,
    name: "Water Pump",
  })).toEqual([{
    type: "pause",
    label: "Pause 1 Water Pump",
  }]);
});
