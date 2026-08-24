import { expect, it } from "vitest";

import {
  computingRecipeIds,
  dataCenter,
  defaultComputingConfig,
  getRackAllocation,
} from "../computing";
import { createComputingModule } from "./computing";

it("models the current two full data centers", () => {
  const computing = createComputingModule(defaultComputingConfig);
  const preset = computing.presets.at(0);

  expect(getRackAllocation(defaultComputingConfig.rackCount)).toEqual([48, 48]);
  expect(defaultComputingConfig.waterChillers).toBe(2);
  expect(computing.builtBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 2,
    [computingRecipeIds.basicRack]: 96,
    [computingRecipeIds.waterChiller]: 2,
  });
  expect(preset?.activeBuildings).toEqual(computing.builtBuildings);
  expect(
    defaultComputingConfig.rackCount * dataCenter.computingTflopsPerRack,
  ).toBe(384);
});
