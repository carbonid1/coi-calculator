import { expect, it } from "vitest";

import { getEdict, plannedEdictLevels, resolveEdictLevel } from "./edicts";

it("plans Recycling Increase at its highest catalog level", () => {
  const recycling = getEdict("recyclingIncrease");

  expect(plannedEdictLevels.recyclingIncrease).toBe(5);
  expect(plannedEdictLevels.recyclingIncrease).toBe(recycling.levels.at(-1)?.level);
});

it("keeps Recycling Increase planned only until synced state reaches the target", () => {
  expect(resolveEdictLevel("recyclingIncrease", 4)).toEqual({
    source: "planned",
    value: 5,
  });
  expect(resolveEdictLevel("recyclingIncrease", 5)).toEqual({
    source: "synced",
    value: 5,
  });
});

it("keeps unplanned edicts synced", () => {
  expect(resolveEdictLevel("farmingBoost", 2)).toEqual({
    source: "synced",
    value: 2,
  });
});
