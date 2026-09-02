import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import {
  emptyChickenFarmSettings,
  plannedChickenFarmSettings,
  resolvedChickenFarmSettings,
  resolvedCurrentChickenFarmSettings,
} from "../chicken-farm";
import { baseConfig } from "../config";
import { recipes } from "../recipes";
import { chickenFarms, createChickenFarmsModule } from "./farms";
import { type Module } from "./modules";

describe("Chicken Farms", () => {
  it("supports disabling chicken farms completely", () => {
    const farmModule = createChickenFarmsModule({ totalChickenCount: 0, slaughtering: true });
    const preset = farmModule.presets[0];

    expect(farmModule.builtBuildings["chicken-farm-slaughtering"]).toBe(0);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0);
  });

  it("uses synced current settings instead of inventing a baseline", () => {
    const current = { totalChickenCount: 1_950, slaughtering: true };
    const farmModule = createChickenFarmsModule(
      current,
      current,
      "synced",
      "synced",
      [{
        slaughtering: true,
        built: 4,
        running: 4,
        chickens: 1_950,
        runningChickens: 1_950,
      }],
    );
    const preset = farmModule.presets[0];

    expect(farmModule.builtBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0.975);
    expect(preset?.dataSources?.["chicken-farm-slaughtering"]).toBe("synced");
  });

  it("keeps the target explicitly planned when no game state exists", () => {
    const preset = chickenFarms.presets[0];

    expect(resolvedCurrentChickenFarmSettings).toEqual({
      source: "default",
      value: emptyChickenFarmSettings,
    });
    expect(resolvedChickenFarmSettings).toEqual({
      source: "planned",
      value: plannedChickenFarmSettings,
    });
    expect(chickenFarms.builtBuildings["chicken-farm-slaughtering"]).toBe(0);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(5);
    expect(preset?.dataSources?.["chicken-farm-slaughtering"]).toBe("planned");
    expect(preset?.unplacedPlannedBuildings?.["chicken-farm-slaughtering"]).toBe(5);
  });

  it("layers the plan over synced farms without duplicating their capacity", () => {
    const farmModule = createChickenFarmsModule(
      plannedChickenFarmSettings,
      plannedChickenFarmSettings,
      "planned",
      "synced",
      [],
      undefined,
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
      plannedChickenFarmSettings,
      "planned",
      "synced",
      undefined,
      undefined,
      currentEntities,
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
      plannedChickenFarmSettings,
      "planned",
      "synced",
      [
        {
          slaughtering: true,
          built: 5,
          running: 5,
          chickens: 2_350,
          runningChickens: 2_350,
        },
        {
          slaughtering: false,
          built: 1,
          running: 1,
          chickens: 500,
          runningChickens: 500,
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
    expect(eggs?.produced).toBeCloseTo(42.75);
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
