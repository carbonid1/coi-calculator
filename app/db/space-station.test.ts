import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { activeContracts } from "./contracts";
import { modules } from "./modules/modules";
import {
  calculateSpaceStationConstruction,
  calculateSpaceStationLevel,
  defaultSpaceStationConfig,
  getStationPartsKind,
} from "./space-station";

describe("Space Station", () => {
  it("retains standard Station Parts after this save reached orbital research", () => {
    expect(getStationPartsKind(1, 2)).toBe("basic");
    expect(getStationPartsKind(1, 4)).toBe("standard");
    expect(calculateSpaceStationConstruction(defaultSpaceStationConfig)).toEqual({
      byKind: { basic: 0, standard: 440 },
      currentLevel: 0,
      targetLevel: 4,
      totalParts: 440,
    });
  });

  it("calculates the level-four operating point from the v0.8.7 formulas", () => {
    expect(calculateSpaceStationLevel(4, 4)).toEqual({
      constructionParts: 120,
      crew: 6,
      crewSuppliesPerCycle: 1.2,
      level: 4,
      maintenancePartsPerCycle: 1,
      researchEfficiencyBonusPercent: 25,
      researchSuppliesPerCycle: 4,
      spaceResearchPointsPerCycle: 96,
      stationPartsKind: "standard",
      unityPerCycle: 0.3,
    });
  });

  it("balances level four against two full-speed space-research labs", () => {
    const result = calculateFactoryTotal(modules, activeContracts);
    const orbitalResearch = result.calculation.regularResults.find(
      (line) => line.recipe.id === "space-station-orbital-research",
    );
    const flow = (resourceId: string) => result.flows.find(
      (candidate) => candidate.resourceId === resourceId,
    );

    expect(orbitalResearch).toMatchObject({ supplyRatio: 1 });
    expect(flow("spaceResearchPoints")).toMatchObject({
      consumed: 96,
      produced: 96,
      net: 0,
    });
    expect(flow("electronicsIv")).toMatchObject({ consumed: 4, produced: 4, net: 0 });
    expect(flow("crewSupplies")).toMatchObject({ consumed: 1.2, net: -1.2 });
    expect(flow("stationParts")).toMatchObject({ consumed: 1, net: -1 });
  });
});
