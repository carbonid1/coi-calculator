import { describe, expect, it } from "vitest";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import {
  defaultChickenFarmSettings,
  plannedChickenFarmSettings,
  resolvedChickenFarmSettings,
  resolvedCurrentChickenFarmSettings,
} from "../chicken-farm";
import { activeContracts } from "../contracts";
import {
  activeCropFarmGroups,
  crops,
} from "../crop-farming";
import { defaultActiveEdicts } from "../edicts";
import { calculateOfficePlan, resolvedOfficePlan } from "../offices";
import { recipes } from "../recipes";
import { defaultInfiniteResearchLevels } from "../research";
import {
  createChickenFarmsModule,
  createGreenhousesModule,
  chickenFarms,
  greenhouses,
} from "./farms";
import { modules } from "./modules";

describe("active crop farm plan", () => {
  it("supports disabling chicken farms completely", () => {
    const chickenFarmsModule = createChickenFarmsModule({
      totalChickenCount: 0,
      slaughtering: true,
    });
    const preset = chickenFarmsModule.presets.at(0);

    expect(chickenFarmsModule.builtBuildings?.["chicken-farm-slaughtering"]).toBe(0);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0);
  });

  it("runs 1,950 chickens within the four existing farms", () => {
    const chickenFarmsModule = createChickenFarmsModule(defaultChickenFarmSettings);
    const preset = chickenFarmsModule.presets.at(0);

    expect(defaultChickenFarmSettings.totalChickenCount).toBe(1_950);
    expect(chickenFarmsModule.builtBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0.975);
  });

  it("keeps four chicken farms built and plans the fifth for 2,350 chickens", () => {
    const preset = chickenFarms.presets.at(0);

    expect(resolvedCurrentChickenFarmSettings).toEqual({
      source: "default",
      value: defaultChickenFarmSettings,
    });
    expect(resolvedChickenFarmSettings).toEqual({
      source: "planned",
      value: plannedChickenFarmSettings,
    });
    expect(chickenFarms.builtBuildings["chicken-farm-slaughtering"]).toBe(4);
    expect(preset?.activeBuildings["chicken-farm-slaughtering"]).toBe(5);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0.94);
    expect(preset?.dataSources?.["chicken-farm-slaughtering"]).toBe("planned");
  });

  it("separates missing chicken buildings from missing population", () => {
    const chickenFarmsModule = createChickenFarmsModule(
      plannedChickenFarmSettings,
      defaultChickenFarmSettings,
      "planned",
      "synced",
      [{
        slaughtering: true,
        built: 4,
        running: 4,
        chickens: 1_950,
        runningChickens: 1_950,
      }],
    );

    expect(chickenFarmsModule.presets[0].planMismatches).toMatchObject([{
      current: 1_950,
      target: 2_350,
      currentSource: "synced",
      actions: [
        { type: "build", label: "Build 1 Chicken Farm" },
        { type: "add-animals", label: "Add 400 chickens" },
      ],
    }]);
  });

  it("keeps paused chicken farms planned until farm count and population are active", () => {
    const paused = createChickenFarmsModule(
      plannedChickenFarmSettings,
      plannedChickenFarmSettings,
      "planned",
      "synced",
      [{
        slaughtering: true,
        built: 5,
        running: 1,
        chickens: 2_350,
        runningChickens: 500,
      }],
    );
    const reached = createChickenFarmsModule(
      plannedChickenFarmSettings,
      plannedChickenFarmSettings,
      "planned",
      "synced",
      [{
        slaughtering: true,
        built: 5,
        running: 5,
        chickens: 2_350,
        runningChickens: 2_350,
      }],
    );

    expect(paused.presets[0].dataSources?.["chicken-farm-slaughtering"]).toBe("planned");
    expect(paused.presets[0].planMismatches?.[0].actions).toEqual([
      { type: "unpause", label: "Unpause 4 Chicken Farms" },
    ]);
    expect(reached.presets[0].dataSources?.["chicken-farm-slaughtering"]).toBe("synced");
    expect(reached.presets[0].planMismatches).toBeUndefined();
  });

  it("keeps extra synced chicken modes visible after the minimum plan is reached", () => {
    const chickenFarmsModule = createChickenFarmsModule(
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
    const preset = chickenFarmsModule.presets[0];
    const result = calculateFactoryTotal([chickenFarmsModule]);
    const flow = (resourceId: string) => result.flows.find(
      candidate => candidate.resourceId === resourceId,
    );

    expect(chickenFarmsModule.builtBuildings).toEqual({
      "chicken-farm-slaughtering": 5,
      "chicken-farm-eggs-only": 1,
    });
    expect(preset.activeBuildings).toEqual({
      "chicken-farm-slaughtering": 5,
      "chicken-farm-eggs-only": 1,
    });
    expect(preset.dataSources).toEqual({
      "chicken-farm-slaughtering": "synced",
      "chicken-farm-eggs-only": "synced",
    });
    expect(flow("animalFeed")?.consumed).toBeCloseTo(85.5);
    expect(flow("water")?.consumed).toBeCloseTo(102.6);
    expect(flow("eggs")?.produced).toBeCloseTo(42.75);
    expect(flow("chickenCarcass")?.produced).toBeCloseTo(47);
  });

  it("keeps an at-most chicken plan active until excess farms and animals are removed", () => {
    const chickenFarmsModule = createChickenFarmsModule(
      plannedChickenFarmSettings,
      plannedChickenFarmSettings,
      "planned",
      "synced",
      [{
        slaughtering: true,
        built: 6,
        running: 6,
        chickens: 2_500,
        runningChickens: 2_500,
      }],
      "at-most",
    );
    const preset = chickenFarmsModule.presets[0];

    expect(preset.activeBuildings["chicken-farm-slaughtering"]).toBe(5);
    expect(preset.speedLevels?.["chicken-farm-slaughtering"]).toBe(0.94);
    expect(preset.dataSources?.["chicken-farm-slaughtering"]).toBe("planned");
    expect(preset.planMismatches).toMatchObject([{
      direction: "at-most",
      actions: [
        { type: "pause", label: "Pause 1 Chicken Farm" },
        { type: "remove-animals", label: "Remove 150 chickens" },
      ],
    }]);
  });

  it("treats the nine greenhouse rotations as planned configuration", () => {
    const preset = greenhouses.presets.at(0);
    const activeFarmIds = activeCropFarmGroups.map((group) => group.id);

    expect(activeCropFarmGroups).toHaveLength(9);
    expect(activeFarmIds.reduce(
      (total, id) => total + (greenhouses.builtBuildings[id] ?? 0),
      0,
    )).toBe(8);
    expect(activeFarmIds.filter((id) => greenhouses.builtBuildings[id] === 0)).toHaveLength(1);
    expect(activeFarmIds.every((id) => preset?.activeBuildings[id] === 1)).toBe(true);
    expect(activeFarmIds.every((id) => preset?.dataSources?.[id] === "planned")).toBe(true);
  });

  it("distinguishes greenhouse reconfiguration from the one missing building", () => {
    const greenhousesModule = createGreenhousesModule();
    const actions = greenhousesModule.presets[0].planMismatches?.flatMap(
      mismatch => mismatch.actions,
    ) ?? [];

    expect(actions.filter(({ type }) => type === "configure")).toHaveLength(8);
    expect(actions.filter(({ type }) => type === "build")).toEqual([{
      type: "build",
      label: "Build 1 Greenhouse II",
    }]);
  });

  it("marks an exact live greenhouse rotation synced while retaining unmet plans", () => {
    const exact = activeCropFarmGroups[0];
    const greenhousesModule = createGreenhousesModule(activeCropFarmGroups, [{
      tierId: "greenhouseII",
      schedule: exact.schedule,
      fertilityTargetPercent: exact.fertilizer?.targetFertilityPercent ?? 100,
      built: 1,
      running: 1,
    }], "synced");

    expect(greenhousesModule.presets[0].dataSources?.[exact.id]).toBe("synced");
    expect(greenhousesModule.presets[0].planMismatches?.map(({ recipeId }) => recipeId))
      .not.toContain(exact.id);
  });

  it("keeps the exact greenhouse plan active while an extra live farm still runs", () => {
    const target = activeCropFarmGroups[0];
    const greenhousesModule = createGreenhousesModule([target], [
      {
        tierId: "greenhouseII",
        schedule: target.schedule,
        fertilityTargetPercent: 140,
        built: 1,
        running: 1,
      },
      {
        tierId: "greenhouseII",
        schedule: ["corn", "corn", "corn", "corn"],
        fertilityTargetPercent: 140,
        built: 1,
        running: 1,
      },
    ], "synced");
    const preset = greenhousesModule.presets[0];

    expect(preset.activeBuildings[target.id]).toBe(1);
    expect(preset.dataSources?.[target.id]).toBe("planned");
    expect(preset.planMismatches).toMatchObject([{
      recipeId: target.id,
      current: 2,
      target: 1,
      direction: "at-most",
      actions: [{
        type: "pause",
        label: "Pause 1 additional Greenhouse",
      }],
    }]);
  });

  it("supports an at-most target for a specific greenhouse configuration", () => {
    const target = activeCropFarmGroups[0];
    const greenhousesModule = createGreenhousesModule([target], [{
      tierId: "greenhouseII",
      schedule: target.schedule,
      fertilityTargetPercent: 140,
      built: 2,
      running: 2,
    }], "synced", {
      defaultDirection: "at-most",
      totalDirection: "at-most",
    });
    const preset = greenhousesModule.presets[0];

    expect(preset.activeBuildings[target.id]).toBe(1);
    expect(preset.planMismatches).toMatchObject([{
      recipeId: target.id,
      direction: "at-most",
      actions: [{ type: "pause", label: "Pause 1 Greenhouse" }],
    }]);
  });

  it("reconfigures running greenhouses before selecting paused capacity", () => {
    const target = activeCropFarmGroups[0];
    const greenhousesModule = createGreenhousesModule([target], [
      {
        tierId: "greenhouseII",
        schedule: ["corn", "corn", "corn", "corn"],
        fertilityTargetPercent: 140,
        built: 1,
        running: 0,
      },
      {
        tierId: "greenhouseII",
        schedule: ["wheat", "wheat", "wheat", "wheat"],
        fertilityTargetPercent: 140,
        built: 1,
        running: 1,
      },
    ], "synced");

    expect(greenhousesModule.presets[0].planMismatches?.[0].actions).toEqual([{
      type: "configure",
      label: "Configure 1 Greenhouse",
    }]);
  });

  it("connects five active Groundwater Pumps only to Greenhouses", () => {
    const greenhousePreset = greenhouses.presets.at(0);
    const chickenFarmsModule = createChickenFarmsModule(defaultChickenFarmSettings);

    expect(greenhouses.builtBuildings["groundwater-pump"]).toBe(5);
    expect(greenhousePreset?.activeBuildings["groundwater-pump"]).toBe(5);
    expect(chickenFarmsModule.builtBuildings).not.toHaveProperty("groundwater-pump");
  });

  it("uses separate dedicated v0.8.7 Carcass processors in General", () => {
    const mixed = recipes.find((recipe) => recipe.id === "food-processor-meat");
    const trimmingsOnly = recipes.find(
      (recipe) => recipe.id === "food-processor-meat-trimmings",
    );

    expect(mixed).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "output",
      balanceOutputIds: ["meat"],
      inputs: [
        { resourceId: "chickenCarcass", quantity: 30 },
        { resourceId: "water", quantity: 9 },
        { resourceId: "salt", quantity: 3 },
      ],
      outputs: [
        { resourceId: "meat", quantity: 15 },
        { resourceId: "meatTrimmings", quantity: 6 },
      ],
    });
    expect(trimmingsOnly).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "input",
      balanceInputIds: ["chickenCarcass"],
      allocation: "fallback",
      allocationPriority: 10,
      inputs: [{ resourceId: "chickenCarcass", quantity: 30 }],
      outputs: [{ resourceId: "meatTrimmings", quantity: 27 }],
    });
    expect(mixed?.sharedCapacity).toBeUndefined();
    expect(trimmingsOnly?.sharedCapacity).toBeUndefined();
    expect(modules.find((module) => module.id === "general")?.builtBuildings).toMatchObject({
      "food-processor-meat": 2,
      "food-processor-meat-trimmings": 1,
    });
    expect(createChickenFarmsModule(defaultChickenFarmSettings).builtBuildings).not.toHaveProperty(
      "food-processor-meat",
    );
  });

  it("never repeats a fertility-consuming crop across adjacent slots", () => {
    for (const group of activeCropFarmGroups) {
      group.schedule.forEach((cropId, index) => {
        const nextCropId = group.schedule[(index + 1) % group.schedule.length];

        if (crops[cropId].fertilityPercentPerDay > 0) {
          expect(nextCropId, `${group.name}, slot ${index + 1}`).not.toBe(cropId);
        }
      });
    }
  });

  it("keeps all active crops supplied with no more than 5 surplus per month", () => {
    const focusBonuses = calculateOfficePlan(
      resolvedOfficePlan.value,
      defaultInfiniteResearchLevels.focusPoints,
    ).bonuses;
    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
      focusBonuses.cropYield,
    );
    const result = calculateFactoryTotal(
      modules,
      activeContracts,
      calculateRecyclingEfficiency(
        defaultActiveEdicts.recyclingIncrease,
        focusBonuses.recyclingEfficiency,
      ).effectivePercent,
      {
        cropYield: cropFarming.yieldMultiplier,
        cropWater: cropFarming.waterDemandMultiplier,
        foodConsumption: calculateFoodConsumption(
          0,
          2,
          focusBonuses.foodConsumption,
        ).multiplier,
        maintenanceOutput: calculateMaintenanceOutput(
          defaultInfiniteResearchLevels.maintenanceOutput,
          focusBonuses.maintenanceProduction,
        ).multiplier,
        settlementConsumption: 1 + focusBonuses.settlementConsumption / 100,
      },
      1,
      1 + focusBonuses.contractsProfitability / 100,
    );
    const cropFlows = new Map(
      result.calculation.allResourceFlows.map((flow) => [flow.resourceId, flow]),
    );
    const fallbackConsumption = new Map<string, number>();

    for (const line of result.calculation.regularResults) {
      if (line.recipe.allocation !== "fallback" && line.recipe.allocation !== "surplus") {
        continue;
      }

      for (const input of line.actualInputs) {
        fallbackConsumption.set(
          input.resourceId,
          (fallbackConsumption.get(input.resourceId) ?? 0) + input.quantity,
        );
      }
    }

    expect(activeCropFarmGroups.reduce((total, group) => total + group.farmCount, 0)).toBe(9);

    for (const crop of Object.values(crops)) {
      if (!crop.productId) continue;

      const flow = cropFlows.get(crop.productId);

      if (!flow || flow.produced <= 0) continue;

      const primarySurplus = Math.max(0, flow.net)
        + (fallbackConsumption.get(crop.productId) ?? 0);

      expect(flow.net, crop.name).toBeGreaterThanOrEqual(-0.001);
      expect(primarySurplus, crop.name).toBeLessThanOrEqual(5.001);
    }
  });

});
