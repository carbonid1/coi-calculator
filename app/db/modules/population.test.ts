import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateNet } from "../../helpers/calculate/calculate";
import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import { type ResolvedPopulationEntityInventory } from "../../helpers/population-entity-sync/population-entity-sync";
import { activeHousingType } from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import { settlementRecipeIds } from "../settlement";
import { type Module } from "./modules";
import {
  createPopulationModule,
  resolvePopulationHousingPlanTargets,
} from "./population";

const inventory = (
  counts: ResolvedPopulationEntityInventory["counts"],
): ResolvedPopulationEntityInventory => ({
  counts,
  entities: [],
  housingIiCandidates: counts[settlementRecipeIds.residentsII] ?? {
    built: 0,
    running: 0,
  },
  unmappedEntities: [],
});
const syncedHousingCapacityLevel = defaultInfiniteResearchLevels.housingCapacity;

const generatedPopulationArea = (zoneId = 14): Module => {
  const waterTreatmentRecipeId = `live-area-${zoneId}:WaterTreatmentPlant:WaterTreatmentT2`;

  return {
    id: `live-area-${zoneId}`,
    name: "Population",
    description: "",
    includedInFactoryTotals: false,
    builtBuildings: { [waterTreatmentRecipeId]: 2 },
    recipes: [{
      id: waterTreatmentRecipeId,
      name: "WaterTreatmentT2",
      building: "Wastewater treatment",
      group: "production",
      inputs: [
        { resourceId: "wasteWater", quantity: 160 },
        { resourceId: "filterMedia", quantity: 8 },
        { resourceId: "chlorine", quantity: 16 },
      ],
      outputs: [
        { resourceId: "water", quantity: 120 },
        { resourceId: "sludge", quantity: 36 },
      ],
      balanceBy: "input",
      balanceInputIds: ["wasteWater"],
    }],
    presets: [{
      id: "live",
      name: "Live area",
      description: "Synced completed buildings plus synced construction ghosts.",
      activeBuildings: { [waterTreatmentRecipeId]: 2 },
      currentActiveBuildings: { [waterTreatmentRecipeId]: 2 },
      builtBuildings: { [waterTreatmentRecipeId]: 2 },
      constructionGhosts: { [waterTreatmentRecipeId]: 0 },
      capacityPools: {
        HousingT3: {
          active: 17,
          built: 17,
          currentActive: 17,
          constructionGhosts: 0,
        },
        HousingT2: {
          active: 0,
          built: 3,
          currentActive: 0,
          constructionGhosts: 0,
        },
        SettlementComputingModule: {
          active: 1,
          built: 1,
          currentActive: 1,
          constructionGhosts: 0,
        },
        WaterTreatmentPlant: {
          active: 2,
          built: 2,
          currentActive: 2,
          constructionGhosts: 0,
        },
      },
      dataSources: { [waterTreatmentRecipeId]: "synced" },
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId,
      trackedBuildings: 24,
      constructedBuildings: 24,
      activeBuildings: 21,
      pausedBuildings: 3,
      constructionGhosts: 0,
      issues: [
        {
          id: "HousingT3:no-recipe",
          building: "Housing III",
          count: 17,
          message: "This building does not expose a production recipe.",
        },
        {
          id: "SettlementSquare1:no-recipe",
          building: "Square (light)",
          count: 1,
          message: "This building does not expose a production recipe.",
        },
        {
          id: "UnknownSettlementBuilding:no-recipe",
          building: "Unknown settlement building",
          count: 1,
          message: "This building does not expose a production recipe.",
        },
      ],
    },
  };
};

it("preserves the generated area while supplying recipe-less settlement calculations", () => {
  const population = createPopulationModule(
    inventory({
      [settlementRecipeIds.residents]: { built: 17, running: 17 },
      [settlementRecipeIds.residentsII]: { built: 3, running: 0 },
      [settlementRecipeIds.foodMarket]: { built: 7, running: 7 },
      [settlementRecipeIds.internetModule]: { built: 1, running: 1 },
      [settlementRecipeIds.wastewaterTreatment]: { built: 2, running: 2 },
    }),
    generatedPopulationArea(),
    syncedHousingCapacityLevel,
  );
  const preset = population.presets[0];
  const waterTreatmentRecipeId = "live-area-14:WaterTreatmentPlant:WaterTreatmentT2";
  const expectedPopulationCapacity = 5_184;

  expect(population).toMatchObject({
    id: "live-area-14",
    name: "Population",
    description: "",
    includedInFactoryTotals: true,
    defaultPresetId: "live",
  });
  expect(population.recipes?.map(recipe => recipe.id)).toEqual([waterTreatmentRecipeId]);
  expect(population.builtBuildings).toMatchObject({
    [waterTreatmentRecipeId]: 2,
    [settlementRecipeIds.residents]: 18,
    [settlementRecipeIds.residentsII]: 2,
    [settlementRecipeIds.foodMarket]: 7,
    [settlementRecipeIds.internetModule]: 1,
  });
  expect(preset).toMatchObject({
    description: "",
    activeBuildings: {
      [waterTreatmentRecipeId]: 2,
      [settlementRecipeIds.residents]: 18,
      [settlementRecipeIds.residentsII]: 0,
      [settlementRecipeIds.foodMarket]: 7,
      [settlementRecipeIds.internetModule]: 1,
    },
    speedLevels: {
      [settlementRecipeIds.internetModule]: expectedPopulationCapacity / 100,
    },
    dataSources: {
      [settlementRecipeIds.residents]: "planned",
      [settlementRecipeIds.residentsII]: "planned",
    },
    planMismatches: [{
      recipeId: settlementRecipeIds.residents,
      current: 17,
      target: 18,
      direction: "at-least",
      format: "configuration",
      actions: [
        {
          type: "unpause",
          label: "Unpause 1 Housing II",
        },
        {
          type: "upgrade",
          label: "Upgrade 1 Housing II to Housing III",
        },
      ],
    }],
  });
  expect(population.liveArea?.issues).toEqual([
    expect.objectContaining({ id: "UnknownSettlementBuilding:no-recipe" }),
  ]);

  const { lines } = buildModuleLines(population, preset);
  const result = calculateNet(lines);
  const stats = calculateBuildingStats(lines, result);

  expect(stats.computingTflops).toBeCloseTo(298.5984);
  expect(result.regularResults.find(item => (
    item.recipe.id === settlementRecipeIds.residents
  ))?.actualInputs.find(input => input.resourceId === "water")?.quantity).toBeCloseTo(273.7152);
});

it("projects recipe-less housing construction ghosts without inventing plan narration", () => {
  const area = generatedPopulationArea();
  const preset = area.presets[0];

  if (!preset?.capacityPools?.HousingT3 || !area.liveArea) {
    throw new Error("Missing Housing III capacity pool");
  }

  preset.capacityPools.HousingT3.active = 18;
  preset.capacityPools.HousingT3.constructionGhosts = 1;
  area.liveArea.constructionGhosts = 1;
  const population = createPopulationModule(
    inventory({
      [settlementRecipeIds.residents]: { built: 17, running: 17 },
      [settlementRecipeIds.internetModule]: { built: 1, running: 1 },
    }),
    area,
    syncedHousingCapacityLevel,
  );

  expect(population.presets[0]).toMatchObject({
    activeBuildings: { [settlementRecipeIds.residents]: 18 },
    currentActiveBuildings: { [settlementRecipeIds.residents]: 17 },
    builtBuildings: { [settlementRecipeIds.residents]: 17 },
    constructionGhosts: { [settlementRecipeIds.residents]: 1 },
    speedLevels: { [settlementRecipeIds.internetModule]: 51.84 },
  });
});

it("replaces an in-progress Housing II promotion instead of counting both tiers", () => {
  const population = createPopulationModule(
    inventory({
      [settlementRecipeIds.residents]: { built: 17, running: 17 },
      [settlementRecipeIds.residentsII]: { built: 3, running: 1 },
      [settlementRecipeIds.internetModule]: { built: 1, running: 1 },
    }),
    generatedPopulationArea(),
    syncedHousingCapacityLevel,
  );

  expect(population.presets[0]).toMatchObject({
    activeBuildings: {
      [settlementRecipeIds.residents]: 18,
      [settlementRecipeIds.residentsII]: 0,
    },
    speedLevels: {
      [settlementRecipeIds.internetModule]: 51.84,
    },
    planMismatches: [{
      actions: [{
        type: "upgrade",
        label: "Upgrade 1 Housing II to Housing III",
      }],
    }],
  });
});

it("allocates the global housing target to only one Population area", () => {
  const west = generatedPopulationArea(14);
  const east = generatedPopulationArea(27);
  const westInventory = inventory({
    [settlementRecipeIds.residents]: { built: 10, running: 10 },
  });
  const eastInventory = inventory({
    [settlementRecipeIds.residents]: { built: 7, running: 7 },
    [settlementRecipeIds.residentsII]: { built: 1, running: 0 },
  });
  const targets = resolvePopulationHousingPlanTargets([
    { generatedArea: west, syncedInventory: westInventory },
    { generatedArea: east, syncedInventory: eastInventory },
  ]);
  const westPopulation = createPopulationModule(
    westInventory,
    west,
    syncedHousingCapacityLevel,
    targets.get(14) ?? null,
  );
  const eastPopulation = createPopulationModule(
    eastInventory,
    east,
    syncedHousingCapacityLevel,
    targets.get(27) ?? null,
  );
  const westPreset = westPopulation.presets[0];
  const eastPreset = eastPopulation.presets[0];

  expect([...targets]).toEqual([[27, 8]]);
  expect(
    (westPreset?.activeBuildings[settlementRecipeIds.residents] ?? 0)
    + (eastPreset?.activeBuildings[settlementRecipeIds.residents] ?? 0),
  ).toBe(18);
  expect(westPreset?.planMismatches).toBeUndefined();
  expect(eastPreset?.planMismatches).toMatchObject([{
    current: 7,
    target: 8,
    actions: [
      { type: "unpause", label: "Unpause 1 Housing II" },
      { type: "upgrade", label: "Upgrade 1 Housing II to Housing III" },
    ],
  }]);
});

it("preserves configuration issues for configurable machine ghosts", () => {
  const area = generatedPopulationArea();
  const preset = area.presets[0];

  if (!preset || !area.liveArea) throw new Error("Missing generated Population state");

  area.recipes = [];
  area.builtBuildings = {};
  preset.activeBuildings = {};
  preset.currentActiveBuildings = {};
  preset.builtBuildings = {};
  preset.constructionGhosts = {};
  preset.capacityPools = {
    WaterTreatmentPlant: {
      active: 1,
      built: 0,
      currentActive: 0,
      constructionGhosts: 1,
    },
  };
  area.liveArea.issues = [{
    id: "WaterTreatmentPlant:recipe-choice",
    building: "Wastewater treatment",
    count: 1,
    message: "Choose a recipe after construction completes.",
  }];

  const population = createPopulationModule(
    inventory({}),
    area,
    syncedHousingCapacityLevel,
  );
  const populationPreset = population.presets[0];

  expect(populationPreset.activeBuildings).not.toHaveProperty(
    settlementRecipeIds.wastewaterTreatment,
  );
  expect(populationPreset.capacityPools).toMatchObject({
    WaterTreatmentPlant: {
      active: 1,
      built: 0,
      currentActive: 0,
      constructionGhosts: 1,
    },
  });
  expect(population.liveArea?.issues).toEqual([
    expect.objectContaining({ id: "WaterTreatmentPlant:recipe-choice" }),
  ]);
});

it("scales full-population housing electricity with capacity research", () => {
  const build = (level: number) => {
    const populationModule = createPopulationModule(
      inventory({
        [settlementRecipeIds.residents]: { built: 11, running: 11 },
      }),
      generatedPopulationArea(),
      level,
    );
    const { lines } = buildModuleLines(
      populationModule,
      populationModule.presets[0] ?? null,
    );
    const residentLines = lines.filter(line => (
      line.recipe.id === settlementRecipeIds.residents
    ));
    const result = calculateNet(residentLines);

    return calculateBuildingStats(residentLines, result).electricityKw;
  };
  const level = defaultInfiniteResearchLevels.housingCapacity;
  const multiplier = calculateHousingCapacity(level).multiplier;
  const basePopulation = activeHousingType.populationCapacity * 11;
  const baseElectricityKw = basePopulation * 1.1 * 1.2;

  expect(build(level) - build(0)).toBeCloseTo(
    baseElectricityKw * (multiplier - 1),
  );
});
