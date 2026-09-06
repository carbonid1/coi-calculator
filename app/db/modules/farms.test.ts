import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import {
  plannedChickenFarmSettings,
} from "../chicken-farm";
import { baseConfig } from "../config";
import { recipes } from "../recipes";
import { createChickenFarmsModule } from "./farms";
import { type Module } from "./modules";

describe("Chicken Farms", () => {
  it("uses synced current settings instead of inventing a baseline", () => {
    const current = { totalChickenCount: 1_950, slaughtering: true };
    const farmModule = createChickenFarmsModule(
      current,
      [500, 500, 500, 450].map((chickens, index) => ({
        entityId: index + 1,
        running: true,
        slaughtering: true,
        chickens,
        zones: [],
      })),
    );
    const preset = farmModule.presets[0];

    expect(farmModule.builtBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0.975);
    expect(preset?.dataSources?.["chicken-farm-slaughtering"]).toBe("synced");
  });

  it("layers the plan over synced farms without duplicating their capacity", () => {
    const farmModule = createChickenFarmsModule(
      plannedChickenFarmSettings,
      [500, 500, 500, 450].map((chickens, index) => ({
        entityId: index + 1,
        running: true,
        slaughtering: true,
        chickens,
        zones: [{ id: index + 1, name: `Area ${index + 1}` }],
      })),
    );
    const preset = farmModule.presets[0];

    expect(farmModule.builtBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(5);
    expect(preset?.dataSources?.["chicken-farm-slaughtering"]).toBe("planned");
    expect(preset?.planMismatches?.[0].actions).toEqual([
      { type: "build", label: "Build 1 Chicken Farm" },
      { type: "add-animals", label: "Add 400 chickens" },
    ]);
  });

  it("attaches farm calculations to a randomly named synced area", () => {
    const syncedArea: Module = {
      id: "live-area-77",
      name: "Pollos del norte",
      description: "",
      gameSynced: true,
      includedInFactoryTotals: false,
      capabilities: ["chicken-farming"],
      builtBuildings: {},
      recipes: [],
      presets: [{
        id: "live",
        name: "Live area",
        description: "",
        activeBuildings: {},
        builtBuildings: {},
        dataSources: {},
        fixed: [],
      }],
      defaultPresetId: "live",
      liveArea: {
        zoneId: 77,
        trackedBuildings: 5,
        constructedBuildings: 5,
        activeBuildings: 5,
        pausedBuildings: 0,
        constructionGhosts: 0,
        issues: [],
      },
    };
    const currentEntities = [500, 500, 500, 500, 350].map((chickens, index) => ({
      entityId: index + 1,
      running: true,
      slaughtering: true,
      chickens,
      zones: [{ id: 77, name: "A label the calculator never matches" }],
    }));
    const farmArea = createChickenFarmsModule(
      plannedChickenFarmSettings,
      currentEntities,
      undefined,
      syncedArea,
    );

    expect(farmArea).toMatchObject({
      id: "live-area-77",
      name: "Pollos del norte",
      includedInFactoryTotals: true,
      liveArea: { zoneId: 77 },
    });
    expect(farmArea.presets[0]).toMatchObject({
      activeBuildings: { "chicken-farm-slaughtering": 5 },
      dataSources: { "chicken-farm-slaughtering": "synced" },
      speedLevels: { "chicken-farm-slaughtering": 0.94 },
    });
  });

  it("keeps extra synced operating modes after the minimum plan is reached", () => {
    const farmModule = createChickenFarmsModule(
      plannedChickenFarmSettings,
      [
        ...[500, 500, 500, 500, 350].map((chickens, index) => ({
          entityId: index + 1,
          running: true,
          slaughtering: true,
          chickens,
          zones: [],
        })),
        {
          entityId: 6,
          running: true,
          slaughtering: false,
          chickens: 500,
          zones: [],
        },
      ],
    );
    const result = calculateFactoryTotal(
      [farmModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const eggs = result.flows.find(flow => flow.resourceId === "eggs");

    expect(farmModule.presets[0].dataSources).toEqual({
      "chicken-farm-slaughtering": "synced",
      "chicken-farm-eggs-only": "synced",
    });
    expect(eggs?.produced).toBeCloseTo(41.748046875);
  });

  it("keeps both carcass-processing recipes available to synced modules", () => {
    const mixed = recipes.find(recipe => recipe.id === "food-processor-meat");
    const trimmingsOnly = recipes.find(
      recipe => recipe.id === "food-processor-meat-trimmings",
    );

    expect(mixed).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "output",
      inputs: [
        { resourceId: "chickenCarcass", quantity: 30 },
        { resourceId: "water", quantity: 9 },
        { resourceId: "salt", quantity: 3 },
      ],
    });
    expect(trimmingsOnly).toMatchObject({
      balanceBy: "input",
      allocation: "fallback",
      inputs: [{ resourceId: "chickenCarcass", quantity: 30 }],
    });
  });
});
