import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { getSyncedCropFarmEntities } from "../../helpers/synced-production-config/synced-production-config";
import { testWeather } from "../../test-fixtures/synced-island-settings";
import { type CurrentCropFarmEntity } from "../crop-farming";
import { type Recipe } from "../recipes";
import {
  createCropFarmAreaModule,
  createDefaultCropFarmModule,
  getCropFarmGroundwaterRecipeId,
  getCropFarmOwnerZone,
} from "./crop-farm-areas";
import { defaultArea } from "./default";
import { type Module } from "./modules";

const area = (
  zoneId: number,
  areaRecipes: readonly Recipe[] = [],
  recipeCount = 1,
): Module => ({
  id: `live-area-${zoneId}`,
  name: "Random agriculture",
  description: "",
  gameSynced: true,
  includedInFactoryTotals: false,
  builtBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
  recipes: areaRecipes,
  presets: [{
    id: "live",
    name: "Live area",
    description: "",
    activeBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
    currentActiveBuildings: Object.fromEntries(
      areaRecipes.map(recipe => [recipe.id, recipeCount]),
    ),
    builtBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
    constructionGhosts: {},
    dataSources: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, "synced"])),
    fixed: [],
  }],
  defaultPresetId: "live",
  liveArea: {
    zoneId,
    trackedBuildings: recipeCount,
    constructedBuildings: recipeCount,
    activeBuildings: recipeCount,
    pausedBuildings: 0,
    constructionGhosts: 0,
    issues: [],
  },
});

const farm = (
  overrides: Partial<CurrentCropFarmEntity> = {},
): CurrentCropFarmEntity => ({
  entityId: 1,
  tierId: "greenhouseII",
  schedule: ["potato", "fruit", "wheat", "soybean"],
  fertilityTargetPercent: 110,
  fertilizerId: "fertilizerII",
  running: true,
  zones: [{ id: 17, name: "Random agriculture" }],
  ...overrides,
});

describe("synced crop-farm areas", () => {
  it("specializes any generated area using its exact synced farm configuration", () => {
    const farmModule = createCropFarmAreaModule(area(17), [farm()]);
    const recipe = farmModule.recipes?.find(candidate => candidate.farmFertilizer);

    expect(farmModule.name).toBe("Random agriculture");
    expect(farmModule.includedInFactoryTotals).toBe(true);
    expect(recipe).toMatchObject({
      building: "Greenhouse II",
      farmFertilizer: {
        targetFertilityPercent: 110,
        maximumFertilityPercent: 140,
      },
      inputs: expect.arrayContaining([
        expect.objectContaining({ resourceId: "fertilizerII" }),
      ]),
    });
    expect(farmModule.presets[0].dataSources?.[recipe?.id ?? ""]).toBe("synced");
    expect(farmModule.presets[0].fixed).toContain(recipe?.id);
  });

  it("groups only farms with identical schedules, targets, and supplied fertilizer", () => {
    const farmModule = createCropFarmAreaModule(area(17), [
      farm({ entityId: 1 }),
      farm({ entityId: 2 }),
      farm({ entityId: 3, fertilizerId: "fertilizerI" }),
      farm({ entityId: 4, fertilityTargetPercent: 120 }),
    ]);
    const farmRecipes = farmModule.recipes?.filter(recipe => recipe.farmFertilizer) ?? [];
    const counts = farmRecipes.map(
      recipe => farmModule.builtBuildings[recipe.id],
    ).toSorted();

    expect(farmRecipes).toHaveLength(3);
    expect(counts).toEqual([1, 1, 2]);
  });

  it("assigns overlapping farms to one stable area and unzoned farms to Default", () => {
    const overlapping = farm({
      zones: [{ id: 17, name: "West" }, { id: 12, name: "East" }],
    });
    const unzoned = farm({ entityId: 2, zones: [] });

    expect(getCropFarmOwnerZone(overlapping)?.id).toBe(12);
    expect(createCropFarmAreaModule(area(17), [overlapping]).recipes).toHaveLength(0);
    expect(createCropFarmAreaModule(area(12), [overlapping]).recipes).toHaveLength(1);
    expect(createDefaultCropFarmModule(defaultArea, [unzoned]).recipes).toEqual(
      expect.arrayContaining([expect.objectContaining({ building: "Greenhouse II" })]),
    );
  });

  it("ignores empty rotations instead of inventing production", () => {
    const farmModule = createCropFarmAreaModule(area(17), [farm({
      schedule: [],
      fertilizerId: null,
      fertilityTargetPercent: 0,
    })]);

    expect(farmModule.recipes).toHaveLength(0);
    expect(farmModule.liveArea?.issues).toEqual([]);
  });

  it.each([
    { schedule: ["Crop_Wheat", null, null, null], months: 6 },
    { schedule: ["Crop_Wheat", null, "Crop_Corn", null], months: 10 },
    { schedule: ["Crop_Wheat", "Crop_Corn", "Crop_NoCrop", null], months: 13 },
  ])("uses only selected crops in the synced rotation's $months-month output average", ({ schedule, months }) => {
    const entities = getSyncedCropFarmEntities([{
      entityId: 42,
      prototypeId: "FarmT4",
      running: true,
      fertilityTargetPercent: 140,
      fertilizerProductId: "Product_Fertilizer2",
      schedule,
      zones: [{ id: 17, name: "Random agriculture" }],
    }]);
    const farmModule = createCropFarmAreaModule(area(17), entities);
    const result = calculateFactoryTotal([farmModule], { recyclingEfficiencyPercent: 0 });
    const wheat = result.flows.find(flow => flow.resourceId === "wheat");

    expect(farmModule.liveArea?.issues).toEqual([]);
    expect(wheat?.produced).toBeCloseTo(58 * 1.5 * 1.4 / months);
  });

  it("retains explicitly selected No Crop as a configured rotation", () => {
    const farmModule = createCropFarmAreaModule(area(17), [farm({
      schedule: ["none"],
      fertilizerId: null,
      fertilityTargetPercent: 0,
    })]);

    expect(farmModule.recipes).toHaveLength(1);
    expect(farmModule.recipes?.[0]).toMatchObject({
      name: "Greenhouse II (No Crop)",
      outputs: [],
    });
    expect(farmModule.liveArea?.issues).toEqual([]);
  });

  it("reports unsupported crops without inventing production", () => {
    const farmModule = createCropFarmAreaModule(area(17), [farm({
      schedule: ["potato", "Crop_Modded", "wheat", "soybean"],
    })]);

    expect(farmModule.recipes).toHaveLength(0);
    expect(farmModule.liveArea?.issues).toContainEqual(expect.objectContaining({
      id: "crop-farms:unsupported-crop",
      count: 1,
    }));
  });

  it("caps production at the supplied fertilizer's fertility limit", () => {
    const limited = createCropFarmAreaModule(area(17), [farm({
      fertilizerId: "organic",
      fertilityTargetPercent: 140,
    })]);
    const reachable = createCropFarmAreaModule(area(17), [farm({
      fertilizerId: "organic",
      fertilityTargetPercent: 100,
    })]);
    const limitedRecipe = limited.recipes?.find(recipe => recipe.farmFertilizer);
    const reachableRecipe = reachable.recipes?.find(recipe => recipe.farmFertilizer);

    expect(limitedRecipe?.outputs).toEqual(reachableRecipe?.outputs);
    expect(limited.liveArea?.issues).toContainEqual(expect.objectContaining({
      id: "crop-farms:fertilizer-limit",
      count: 1,
    }));
  });

  it("calculates synced farm flows without a fixed Greenhouses module", () => {
    const farmModule = createCropFarmAreaModule(area(17), [farm(), farm({ entityId: 2 })]);
    const result = calculateFactoryTotal([farmModule], { recyclingEfficiencyPercent: 0, outputModifiers: { weather: testWeather } });
    const recipe = farmModule.recipes?.find(candidate => candidate.farmFertilizer);
    const line = result.calculation.regularResults.find(candidate => (
      candidate.recipe.id === recipe?.id
    ));

    expect(line).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 2,
      dataSource: "synced",
      supplyRatio: 1,
    });
    expect(line?.actualInputs.find(input => input.resourceId === "water")?.quantity)
      .toBeCloseTo(51.82833333333333);
    expect(line?.actualInputs.find(input => input.resourceId === "fertilizerII")?.quantity)
      .toBeCloseTo(13.422857142857142);
    expect(line?.actualOutputs).toEqual(recipe?.outputs.map(output => ({
      resourceId: output.resourceId,
      quantity: output.quantity * 2,
    })));
  });

  it("uses the synced area pump as a constrained local Water source", () => {
    const pumpId = getCropFarmGroundwaterRecipeId(17);
    const pump: Recipe = {
      id: pumpId,
      name: "Groundwater pumping",
      building: "Groundwater Pump",
      group: "production",
      inputs: [],
      outputs: [{ resourceId: "water", quantity: 48 }],
    };
    const constraint = {
      aquiferCount: 1,
      currentReserve: 12_000,
      reserveCapacity: 20_000,
      projectedPumpCount: 3,
      aquiferSustainableCeilingPerCycle: 90,
      pumpCapacityPerCycle: 144,
      sustainableOutputPerCycle: 90,
    };
    const farmModule = createCropFarmAreaModule(area(17, [pump], 3), [farm()], constraint);

    expect(farmModule.recipes?.find(recipe => recipe.id === pumpId)).toMatchObject({
      group: "source",
      sourceMode: "module-demand-capped",
      sourceKind: "groundwater",
      outputs: [{ resourceId: "water", quantity: 30 }],
      groundwaterConstraint: { sustainableOutputPerCycle: 90 },
    });
  });
});
