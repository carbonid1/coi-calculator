import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { createResearchModule } from "./modules/research";
import { spacePointsExpansion } from "./modules/space-points-expansion";
import { spaceStation } from "./modules/space-station";
import { recipes } from "./recipes";
import {
  calculateSpaceStationConstruction,
  calculateSpaceStationLevel,
  defaultRocketIiRecurringLogistics,
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

  it("amortizes Rocket II supply and crew launches at capacity research level one", () => {
    expect(defaultRocketIiRecurringLogistics).toMatchObject({
      cargoCapacity: 126,
      crewCapacity: 13,
      payloadCapacityBonusPercent: 5,
      researchLevel: 1,
    });
    expect(defaultRocketIiRecurringLogistics.cargoLaunchesPerCycle)
      .toBeCloseTo(6.2 / 126, 9);
    expect(defaultRocketIiRecurringLogistics.crewLaunchesPerCycle)
      .toBeCloseTo(1 / 24, 9);
    expect(defaultRocketIiRecurringLogistics.launchesPerCycle)
      .toBeCloseTo(0.090873016, 9);
    expect(defaultRocketIiRecurringLogistics.aluminumPerCycle)
      .toBeCloseTo(43.619048, 6);
    expect(defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle)
      .toBeCloseTo(10.904762, 6);
    expect(defaultRocketIiRecurringLogistics.waterPerCycle)
      .toBeCloseTo(14.539683, 6);
    expect(defaultRocketIiRecurringLogistics.hydrogenPerCycle)
      .toBeCloseTo(29.079365, 6);
  });

  it("models Composite Panels and Rocket II as real production lines", () => {
    expect(recipes.find((recipe) => recipe.id === "assembly-v-composite-panel"))
      .toMatchObject({
        building: "Assembly V",
        cycleDurationSeconds: 15,
        inputs: [
          { resourceId: "aluminum", quantity: 32 },
          { resourceId: "steel", quantity: 4 },
          { resourceId: "plastic", quantity: 8 },
        ],
        outputs: [{ resourceId: "compositePanel", quantity: 32 }],
      });
    expect(recipes.find((recipe) => recipe.id === "rocket-ii-assembly"))
      .toMatchObject({
        building: "Rocket Assembly Depot",
        cycleDurationSeconds: 360,
        outputs: [{ resourceId: "rocketII", quantity: 1 / 6 }],
      });
    expect(recipes.find((recipe) => recipe.id === "rocket-ii-launch-amortized"))
      .toMatchObject({
        inputs: [
          { resourceId: "rocketII", quantity: 0.09087301587301587 },
          { resourceId: "water", quantity: 14.53968253968254 },
          { resourceId: "hydrogen", quantity: 29.07936507936508 },
          { resourceId: "oxygen", quantity: 8.178571428571429 },
        ],
      });
  });

  it("retains a balanced space plan when the planning modules are inspected in isolation", () => {
    const result = calculateFactoryTotal([
      createResearchModule({ activeResearchLabIvCount: 2, mode: "space" }),
      { ...spaceStation, includedInFactoryTotals: true },
      { ...spacePointsExpansion, includedInFactoryTotals: true },
    ]);
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
    expect(flow("aluminum")?.consumed).toBeCloseTo(43.619048, 6);
    expect(flow("titaniumAlloy")?.consumed).toBeCloseTo(10.904762, 6);
    expect(flow("compositePanel")).toMatchObject({ net: 0 });
    expect(flow("rocketII")?.net).toBeCloseTo(0, 12);
  });
});
