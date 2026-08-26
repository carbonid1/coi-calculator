import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { calculateTreeGrowthSpeed } from "../../helpers/modifiers/calculate-tree-growth-speed";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { defaultInfiniteResearchLevels } from "../research";
import {
  CHICKEN_FARMS_MODULE_ID,
  GREENHOUSES_MODULE_ID,
} from "./farms";
import { createFbrPowerPlantModule } from "./fbr-power-plant";
import { general, plannedNewGeneralBuildings } from "./general";
import { modules } from "./modules";
import { NUCLEAR_MODULE_ID } from "./nuclear";
import { plannedProcessSteamBuildings, processSteam } from "./process-steam";

it("models the physical General Low Steam recovery cluster", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));

  expect(general.builtBuildings).toMatchObject({
    "seawater-pump": 1,
    "thermal-desalinator-low": 3,
    "cooling-tower-large-low": 1,
  });
  expect(preset?.builtBuildings).toMatchObject({
    "seawater-pump": 1,
    "thermal-desalinator-low": 3,
    "cooling-tower-large-low": 1,
  });
});

it("provides two Cracking Units for surplus Fuel Gas", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const crackingUnit = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "cracking-unit-fuel-gas-diesel",
  );

  expect(crackingUnit).toMatchObject({
    activeBuildings: 2,
    builtBuildings: 2,
    operatingMode: "fixed",
  });
});

it("provides two active Rubber Makers for the Ethanol route", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const rubberMaker = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "rubber-maker-ethanol",
  );

  expect(rubberMaker).toMatchObject({
    activeBuildings: 2,
    builtBuildings: 2,
  });
});

it("keeps five steel blocks built while planning a sixth refining block", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "arc-furnace-ii-iron-scrap",
    "arc-furnace-ii-iron-ore",
  ]) {
    expect(lines.find((line) => line.recipe.id === recipeId)).toMatchObject({
      activeBuildings: 5,
      builtBuildings: 5,
    });
  }
  for (const recipeId of ["oxygen-furnace-ii-steel", "cooled-caster-ii-steel"]) {
    expect(lines.find((line) => line.recipe.id === recipeId)).toMatchObject({
      activeBuildings: 6,
      builtBuildings: 5,
      dataSource: "planned",
    });
  }
});

it("runs one Gold Ore production line while keeping the spare Settling Tank paused", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const goldOreRecipeIds = [
    "gold-furnace-concentrate",
    "settling-tank-gold",
    "crusher-large-gold-crushing",
    "crusher-large-gold-milling",
  ];
  const lines = buildModuleLines(general, preset ?? null).lines;
  const goldLines = lines.filter(
    ({ recipe }) => recipe.id === "gold-furnace-scrap"
      || goldOreRecipeIds.includes(recipe.id),
  );
  const scrapFurnace = goldLines.find(({ recipe }) => recipe.id === "gold-furnace-scrap");
  const concentrateFurnace = goldLines.find(
    ({ recipe }) => recipe.id === "gold-furnace-concentrate",
  );
  const settlingTank = goldLines.find(
    ({ recipe }) => recipe.id === "settling-tank-gold",
  );
  const crushers = goldLines.filter(
    ({ recipe }) => recipe.id === "crusher-large-gold-crushing"
      || recipe.id === "crusher-large-gold-milling",
  );

  expect(goldLines).toHaveLength(goldOreRecipeIds.length + 1);
  expect(scrapFurnace).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(concentrateFurnace).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(settlingTank).toMatchObject({ activeBuildings: 1, builtBuildings: 2 });
  expect(crushers).toMatchObject([
    {
      activeBuildings: 1,
      builtBuildings: 1,
      recipe: {
        name: "Gold Ore Crushing (Gold Ore → Crushed Gold Ore)",
        inputs: [{ resourceId: "goldOre", quantity: 144 }],
        outputs: [{ resourceId: "goldOreCrushed", quantity: 144 }],
      },
    },
    {
      activeBuildings: 1,
      builtBuildings: 1,
      recipe: {
        name: "Gold Ore Milling (Crushed Gold Ore → Gold Ore Powder)",
        inputs: [{ resourceId: "goldOreCrushed", quantity: 72 }],
        outputs: [{ resourceId: "goldOrePowder", quantity: 72 }],
      },
    },
  ]);
});

it("combines Tree Sapling and food-process Biomass in the local General recovery line", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const shredder = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "shredder-tree-saplings",
  );
  const biomassMixer = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "mixer-ii-biomass-compost",
  );

  expect(shredder).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(shredder?.recipe).toMatchObject({
    cycleDurationSeconds: 10,
    inputs: [{ resourceId: "treeSapling", quantity: 24 }],
    outputs: [{ resourceId: "biomass", quantity: 24 }],
  });
  expect(biomassMixer?.recipe.balanceInputScope).toBe("module");
});

it("shreds only the Tree Sapling surplus left by the settlement", () => {
  const cropFarming = calculateCropFarmingModifiers(
    defaultInfiniteResearchLevels.cropYield,
    defaultActiveEdicts.farmingBoost,
  );
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
    {
      cropYield: cropFarming.yieldMultiplier,
      cropWater: cropFarming.waterDemandMultiplier,
      foodConsumption: calculateFoodConsumption(0, 2).multiplier,
      treeGrowthSpeed: calculateTreeGrowthSpeed(
        defaultInfiniteResearchLevels.treeGrowthSpeed,
      ).multiplier,
    },
  );
  const flow = (resourceId: string) => result.calculation.allResourceFlows.find(
    (candidate) => candidate.resourceId === resourceId,
  );
  const line = (recipeId: string) => result.calculation.regularResults.find(
    (candidate) => candidate.recipe.id === recipeId,
  );
  const shredder = line("shredder-tree-saplings");
  const generalMixer = line("mixer-ii-biomass-compost");
  const housingMixer = line("housing-mixer-ii-biomass-compost");
  const residents = line("housing-residents");
  const generalBiomassProduced = result.calculation.regularResults.reduce((total, candidate) => (
    candidate.moduleId === "general"
      ? total + (candidate.actualOutputs.find(
          (output) => output.resourceId === "biomass",
        )?.quantity ?? 0)
      : total
  ), 0);

  expect(flow("treeSapling")?.net).toBeCloseTo(0);
  expect(flow("biomass")?.net).toBeCloseTo(0);
  expect(shredder?.actualInputs[0]?.quantity).toBeGreaterThan(0);
  expect(generalMixer?.actualInputs[0]?.quantity).toBeCloseTo(generalBiomassProduced);
  expect(housingMixer).toMatchObject({ activeBuildings: 2, builtBuildings: 2 });
  expect(housingMixer?.actualInputs[0]?.quantity)
    .toBeCloseTo(residents?.actualOutputs.find(
      (output) => output.resourceId === "biomass",
    )?.quantity ?? 0);
});

it("places steam-consuming planned production in Process Steam and the rest in General", () => {
  const generalPreset = general.presets.find(({ id }) => id === general.defaultPresetId) ?? null;
  const processSteamPreset = processSteam.presets.find(
    ({ id }) => id === processSteam.defaultPresetId,
  ) ?? null;
  const generalLines = buildModuleLines(general, generalPreset).lines.filter(
    ({ recipe }) => recipe.id in plannedNewGeneralBuildings,
  );
  const processSteamLines = buildModuleLines(processSteam, processSteamPreset).lines.filter(
    ({ recipe }) => recipe.id in plannedProcessSteamBuildings,
  );

  expect(generalLines).toHaveLength(Object.keys(plannedNewGeneralBuildings).length);
  expect(generalLines.every((line) => (
    line.dataSource === "planned"
    && line.builtBuildings === 0
    && !line.recipe.inputs.some(({ resourceId }) => resourceId.startsWith("steam"))
  ))).toBe(true);
  expect(processSteamLines).toMatchObject([{
    dataSource: "planned",
    builtBuildings: 0,
    activeBuildings: 1,
    recipe: {
      id: "distillation-stage-iii-titanium-purification",
      inputs: [
        { resourceId: "titaniumChloride", quantity: 12 },
        { resourceId: "steamHigh", quantity: 3 },
      ],
    },
  }]);
});

it("demand-balances enough Yellowcake for the two-FBR target", () => {
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
  );
  const yellowcake = result.flows.find((flow) => flow.resourceId === "yellowcake");
  const settlingTank = result.calculation.regularResults.find((candidate) => (
    candidate.moduleId === "general" && candidate.recipe.id === "settling-tank"
  ));

  expect(yellowcake?.consumed).toBe(9);
  expect(yellowcake?.produced).toBe(9);
  expect(yellowcake?.net).toBe(0);
  expect(settlingTank).toMatchObject({
    activeBuildings: 2,
    operatingMode: "balanced",
    supplyRatio: 0.75,
    actualInputs: [
      { resourceId: "uraniumOrePowder", quantity: 54 },
      { resourceId: "acid", quantity: 18 },
    ],
    actualOutputs: [
      { resourceId: "yellowcake", quantity: 9 },
      { resourceId: "toxicSlurry", quantity: 54 },
    ],
  });
});

it("keeps Greenhouse Groundwater Pumps local while Mines supplies factory reserve", () => {
  const result = calculateFactoryTotal(
    modules
      .filter((module) => module.id !== NUCLEAR_MODULE_ID)
      .concat(createFbrPowerPlantModule({
        averageGeneratorOutputMw: 30.2,
        hydrogenFuelDemandPerCycle: 50,
      })),
    activeContracts,
  );
  const groundwater = result.calculation.sourceResults.find(
    (candidate) => (
      candidate.moduleId === GREENHOUSES_MODULE_ID
      && candidate.recipe.id === "groundwater-pump"
    ),
  );
  const pumped = groundwater?.actualOutputs[0]?.quantity ?? 0;
  const minesGroundwater = result.calculation.sourceResults.find((candidate) => (
    candidate.moduleId === "mines"
    && candidate.recipe.id === "groundwater-pump-factory-reserve"
  ));
  const greenhouseWaterConsumed = result.calculation.regularResults.reduce((total, line) => (
    line.moduleId === GREENHOUSES_MODULE_ID
      ? total + (line.actualInputs.find((input) => input.resourceId === "water")?.quantity ?? 0)
      : total
  ), 0);
  const chickenWaterConsumed = result.calculation.regularResults.reduce((total, line) => (
    line.moduleId === CHICKEN_FARMS_MODULE_ID
      ? total + (line.actualInputs.find((input) => input.resourceId === "water")?.quantity ?? 0)
      : total
  ), 0);

  expect(groundwater?.activeBuildings).toBe(5);
  expect(pumped).toBeGreaterThan(0);
  expect(pumped).toBeLessThanOrEqual(5 * 48);
  expect(minesGroundwater).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(minesGroundwater?.actualOutputs[0]?.quantity).toBeGreaterThan(0);
  expect(minesGroundwater?.actualOutputs[0]?.quantity).toBeLessThanOrEqual(48);
  expect(chickenWaterConsumed).toBeGreaterThan(0);
  expect(pumped).toBeCloseTo(greenhouseWaterConsumed, 10);
});
