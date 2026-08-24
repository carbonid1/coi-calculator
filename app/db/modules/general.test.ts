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
import { general } from "./general";
import { modules } from "./modules";
import { NUCLEAR_MODULE_ID } from "./nuclear";
import { processSteam } from "./process-steam";

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

it("recycles Gold Scrap while keeping the built Gold Ore crushers paused", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const pausedGoldRecipeIds = [
    "gold-furnace-concentrate",
    "settling-tank-gold",
  ];
  const pausedCrusherRecipeIds = [
    "crusher-large-gold-crushing",
    "crusher-large-gold-milling",
  ];
  const lines = buildModuleLines(general, preset ?? null).lines;
  const goldLines = lines.filter(
    ({ recipe }) => recipe.id === "gold-furnace-scrap"
      || pausedGoldRecipeIds.includes(recipe.id)
      || pausedCrusherRecipeIds.includes(recipe.id),
  );
  const scrapFurnace = goldLines.find(({ recipe }) => recipe.id === "gold-furnace-scrap");
  const pausedLines = goldLines.filter(({ recipe }) => pausedGoldRecipeIds.includes(recipe.id));
  const pausedCrushers = goldLines.filter(
    ({ recipe }) => pausedCrusherRecipeIds.includes(recipe.id),
  );

  expect(goldLines).toHaveLength(
    pausedGoldRecipeIds.length + pausedCrusherRecipeIds.length + 1,
  );
  expect(scrapFurnace).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(pausedLines.every(({ activeBuildings }) => activeBuildings === 0)).toBe(true);
  expect(pausedLines.every(({ builtBuildings }) => builtBuildings > 0)).toBe(true);
  expect(pausedCrushers).toMatchObject([
    {
      activeBuildings: 0,
      builtBuildings: 1,
      recipe: {
        name: "Gold Ore Crushing (Gold Ore → Crushed Gold Ore)",
        inputs: [{ resourceId: "goldOre", quantity: 144 }],
        outputs: [{ resourceId: "goldOreCrushed", quantity: 144 }],
      },
    },
    {
      activeBuildings: 0,
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

it("keeps the Titanium expansion chain out of legacy factory modules", () => {
  const titaniumRecipeIds = [
    "crusher-large-titanium",
    "arc-furnace-ii-titanium-ore",
    "chemical-plant-ii-titanium-chlorination",
    "distillation-stage-iii-titanium-purification",
    "chemical-plant-ii-titanium-reduction",
    "arc-furnace-ii-titanium-sponge",
    "alloy-mixer-titanium",
    "cooled-caster-ii-titanium-alloy",
  ];
  const lines = [general, processSteam].flatMap((module) => {
    const preset = module.presets.find(({ id }) => id === module.defaultPresetId) ?? null;

    return buildModuleLines(module, preset).lines;
  });

  expect(lines.filter(({ recipe }) => titaniumRecipeIds.includes(recipe.id))).toEqual([]);
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

it("caps the five Greenhouse Groundwater Pumps without covering Chicken Farms", () => {
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
  const minesGroundwater = result.allLines.find((line) => (
    line.moduleId === "mines" && line.recipe.id === "groundwater-pump"
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

  expect(groundwater?.activeBuildings).toBe(4);
  expect(pumped).toBeGreaterThan(0);
  expect(pumped).toBeLessThanOrEqual(4 * 48);
  expect(minesGroundwater).toMatchObject({ activeBuildings: 0, builtBuildings: 0 });
  expect(chickenWaterConsumed).toBeGreaterThan(0);
  expect(pumped).toBeCloseTo(greenhouseWaterConsumed, 10);
});
