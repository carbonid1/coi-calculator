import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateNet } from "../../helpers/calculate/calculate";
import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import { type ResolvedPopulationEntityInventory } from "../../helpers/population-entity-sync/population-entity-sync";
import { activeHousingType } from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import { settlementRecipeIds } from "../settlement";
import { type Module } from "./modules";
import { createLegacyPopulationArea, createPopulationModule } from "./population";

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

const generatedPopulationArea = (): Module => {
  const waterTreatmentRecipeId = "live-area-14:WaterTreatmentPlant:WaterTreatmentT2";

  return {
    id: "live-area-14",
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
      zoneId: 14,
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
  );
  const preset = population.presets[0];
  const waterTreatmentRecipeId = "live-area-14:WaterTreatmentPlant:WaterTreatmentT2";
  const expectedPopulationCapacity = 4_896;

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
    [settlementRecipeIds.residents]: 17,
    [settlementRecipeIds.residentsII]: 3,
    [settlementRecipeIds.foodMarket]: 7,
    [settlementRecipeIds.internetModule]: 1,
  });
  expect(preset).toMatchObject({
    description: "",
    activeBuildings: {
      [waterTreatmentRecipeId]: 2,
      [settlementRecipeIds.residents]: 17,
      [settlementRecipeIds.residentsII]: 0,
      [settlementRecipeIds.foodMarket]: 7,
      [settlementRecipeIds.internetModule]: 1,
    },
    speedLevels: {
      [settlementRecipeIds.internetModule]: expectedPopulationCapacity / 100,
    },
  });
  expect(preset.planMismatches).toBeUndefined();
  expect(population.liveArea?.issues).toEqual([
    expect.objectContaining({ id: "UnknownSettlementBuilding:no-recipe" }),
  ]);

  const { lines } = buildModuleLines(population, preset);
  const result = calculateNet(lines);
  const stats = calculateBuildingStats(lines, result);

  expect(stats.computingTflops).toBeCloseTo(282.0096);
  expect(result.regularResults.find(item => (
    item.recipe.id === settlementRecipeIds.residents
  ))?.actualInputs.find(input => input.resourceId === "water")?.quantity).toBeCloseTo(258.5088);
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
  );

  expect(population.presets[0]).toMatchObject({
    activeBuildings: { [settlementRecipeIds.residents]: 18 },
    currentActiveBuildings: { [settlementRecipeIds.residents]: 17 },
    builtBuildings: { [settlementRecipeIds.residents]: 17 },
    constructionGhosts: { [settlementRecipeIds.residents]: 1 },
    speedLevels: { [settlementRecipeIds.internetModule]: 51.84 },
  });
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

  const population = createPopulationModule(inventory({}), area);
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

it("falls back to known waste recipes for supported pre-ghost Population snapshots", () => {
  const productionEntities: SyncedProductionEntity[] = [
    {
      entityId: 1,
      prototypeId: "HousingT3",
      running: true,
      recipeIds: [],
      zones: [{ id: 14, name: "Population" }],
      nuclearReactor: null,
    },
    {
      entityId: 2,
      prototypeId: "WaterTreatmentPlant",
      running: true,
      recipeIds: ["WaterTreatmentT2"],
      zones: [{ id: 14, name: "Population" }],
      nuclearReactor: null,
    },
  ];
  const area = createLegacyPopulationArea(
    { id: 14, name: "Population" },
    productionEntities,
  );
  const population = createPopulationModule(
    inventory({
      [settlementRecipeIds.residents]: { built: 1, running: 1 },
      [settlementRecipeIds.wastewaterTreatment]: { built: 1, running: 1 },
    }),
    area,
  );

  expect(population).toMatchObject({
    id: "live-area-14",
    includedInFactoryTotals: true,
    liveArea: {
      trackedBuildings: 2,
      activeBuildings: 2,
      pausedBuildings: 0,
      issues: [],
    },
  });
  expect(population.presets[0].activeBuildings).toMatchObject({
    [settlementRecipeIds.residents]: 1,
    [settlementRecipeIds.wastewaterTreatment]: 1,
  });
  expect(population.presets[0].fixed).toContain(settlementRecipeIds.residents);
  expect(population.presets[0].fixed).not.toContain(
    settlementRecipeIds.wastewaterTreatment,
  );
});

it("scales full-population housing electricity with capacity research", () => {
  const build = (level: number) => {
    const populationModule = createPopulationModule(
      inventory({
        [settlementRecipeIds.residents]: { built: 11, running: 11 },
      }),
      createLegacyPopulationArea({ id: 14, name: "Population" }, []),
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
