import { describe, expect, it } from "vitest";

import {
  calculateInfiniteResearchLevelCost,
  calculateInfiniteResearchRemainingCost,
  cropYieldResearch,
  defaultInfiniteResearchLevels,
  infiniteResearchCatalog,
  maintenanceOutputResearch,
  rocketsCapacityResearch,
  vehiclesPollutionResearch,
  worldMineOutputResearch,
} from "./research";

describe("infinite research database", () => {
  it("contains every active v0.8.7 repeatable research", () => {
    expect(infiniteResearchCatalog).toHaveLength(18);
    expect(infiniteResearchCatalog.map((research) => research.id)).toEqual([
      "vehiclesPollution",
      "shipsPollution",
      "trainsPollution",
      "cropYield",
      "treeGrowthSpeed",
      "rainwaterYield",
      "settlementWaterUse",
      "unityCapacity",
      "housingCapacity",
      "focusPoints",
      "vehicleLimit",
      "vehiclesFuelUse",
      "shipsFuelUse",
      "trainsFuelUse",
      "rocketsCapacity",
      "maintenanceOutput",
      "worldMineOutput",
      "solarPower",
    ]);
    expect(infiniteResearchCatalog.map((research) => [
      research.spaceResearchLevel,
      research.maxLevel,
    ])).toEqual([
      [15, 20],
      [15, 20],
      [15, 20],
      [20, 250],
      [5, 50],
      [10, 40],
      [10, 40],
      [5, 60],
      [4, 40],
      [5, 25],
      [20, 60],
      [5, 35],
      [5, 35],
      [5, 35],
      [1, 20],
      [4, 50],
      [5, 50],
      [10, 200],
    ]);
  });

  it("matches installed game cost curves", () => {
    expect(calculateInfiniteResearchLevelCost(rocketsCapacityResearch, 1)).toBe(27_840);
    expect(calculateInfiniteResearchLevelCost(maintenanceOutputResearch, 4)).toBe(45_867);
    expect(calculateInfiniteResearchLevelCost(worldMineOutputResearch, 5)).toBe(45_014);
    expect(calculateInfiniteResearchLevelCost(cropYieldResearch, 20)).toBe(62_914);
    expect(calculateInfiniteResearchLevelCost(vehiclesPollutionResearch, 15)).toBe(72_645);
  });

  it("adds only the unfinished levels when calculating a target cost", () => {
    expect(calculateInfiniteResearchRemainingCost(worldMineOutputResearch, 3, 5)).toBe(
      calculateInfiniteResearchLevelCost(worldMineOutputResearch, 4)
      + calculateInfiniteResearchLevelCost(worldMineOutputResearch, 5),
    );
    expect(calculateInfiniteResearchRemainingCost(worldMineOutputResearch, 5, 5)).toBe(0);
  });

  it("keeps configured levels inside their game caps", () => {
    for (const research of infiniteResearchCatalog) {
      expect(defaultInfiniteResearchLevels[research.id]).toBeGreaterThanOrEqual(0);
      expect(defaultInfiniteResearchLevels[research.id]).toBeLessThanOrEqual(
        research.maxLevel,
      );
    }
  });
});
