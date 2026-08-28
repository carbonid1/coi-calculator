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
  defaultArea as general,
  modeledDefaultRecipeIds,
  plannedNewDefaultBuildings,
} from "./default";
import {
  CHICKEN_FARMS_MODULE_ID,
  GREENHOUSES_MODULE_ID,
} from "./farms";
import { createFbrPowerPlantModule } from "./fbr-power-plant";
import { modules } from "./modules";
import { NUCLEAR_MODULE_ID } from "./nuclear";
import { processSteam } from "./process-steam";

it("models the physical Default-area Low Steam recovery cluster", () => {
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

it("keeps one of two Cracking Units active and balances it against surplus Fuel Gas", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const crackingUnit = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "cracking-unit-fuel-gas-diesel",
  );

  expect(crackingUnit).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 2,
    dataSource: "modeled",
    operatingMode: "balanced",
  });

  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
  );
  const activeCrackingUnit = result.calculation.regularResults.find((line) => (
    line.moduleId === "general"
    && line.recipe.id === "cracking-unit-fuel-gas-diesel"
  ));
  const fuelGas = result.flows.find((flow) => flow.resourceId === "fuelGas");

  expect(activeCrackingUnit?.supplyRatio).toBeGreaterThan(0);
  expect(activeCrackingUnit?.supplyRatio).toBeLessThan(1);
  expect(fuelGas?.net).toBeCloseTo(0, 6);
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

it("treats the completed Default-area Titanium machines as modeled active capacity", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "crusher-large-titanium",
    "arc-furnace-ii-titanium-ore",
    "chemical-plant-ii-titanium-chlorination",
    "chemical-plant-ii-titanium-reduction",
    "arc-furnace-ii-titanium-sponge",
    "alloy-mixer-titanium",
    "cooled-caster-ii-titanium-alloy",
  ]) {
    expect(lines.find((line) => line.recipe.id === recipeId)).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
    });
    expect(lines.find((line) => line.recipe.id === recipeId)?.dataSource)
      .toBeUndefined();
  }
});

it("treats the completed front half of the Aluminum chain as current capacity", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;
  const expectedCounts = {
    "crusher-large-bauxite": { activeBuildings: 3, builtBuildings: 3 },
    "chemical-plant-ii-bauxite-digestion": { activeBuildings: 3, builtBuildings: 3 },
    "settling-tank-red-mud-acid": { activeBuildings: 5, builtBuildings: 5 },
    "rotary-kiln-alumina-fuel-gas": { activeBuildings: 3, builtBuildings: 4 },
    "aluminum-cell-electrolysis": { activeBuildings: 3, builtBuildings: 3 },
    "cooled-caster-ii-aluminum": { activeBuildings: 3, builtBuildings: 3 },
  };

  for (const [recipeId, counts] of Object.entries(expectedCounts)) {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);

    expect(line).toMatchObject(counts);
    expect(line?.dataSource).toBeUndefined();
  }
});

it("models the completed Solar Cell Mono recipe as current capacity", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "assembly-v-solar-cell-mono",
  );

  expect(line).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(line?.dataSource).toBeUndefined();
});

it("models the completed Sapphire Wafer and Chemical Fuel recipes", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "crystallizer-alumina",
    "chemical-plant-ii-chemical-fuel",
  ]) {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);

    expect(line).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
    expect(line?.dataSource).toBe("modeled");
  }
});

it("models the completed Electronics IV and Composite Core recipes", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "assembly-v-electronics-iv",
    "assembly-v-composite-core",
  ]) {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);

    expect(line).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
    expect(line?.dataSource).toBe("modeled");
  }
});

it("models the expanded Electronics II and III Assembly V capacity", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  expect(lines.find((line) => line.recipe.id === "assembly-v-electronics-ii"))
    .toMatchObject({ activeBuildings: 4, builtBuildings: 4, dataSource: "modeled" });
  expect(lines.find((line) => line.recipe.id === "assembly-v-electronics-iii"))
    .toMatchObject({ activeBuildings: 5, builtBuildings: 5, dataSource: "modeled" });
});

it("models the third Acid Mixer II as built and active", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "mixer-ii-acid",
  );

  expect(line).toMatchObject({
    activeBuildings: 3,
    builtBuildings: 3,
    dataSource: "modeled",
  });
});

it("models the third Electronics I Assembly V as built and active", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "assembly-v-electronics-i",
  );

  expect(line).toMatchObject({
    activeBuildings: 3,
    builtBuildings: 3,
    dataSource: "modeled",
  });
});

it("models the third Ethanol Polymerization Plant as built and active", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "polymerization-plant-plastic-ethanol",
  );

  expect(line).toMatchObject({
    activeBuildings: 3,
    builtBuildings: 3,
    dataSource: "modeled",
  });
});

it("models two Antibiotics Fermentation Tanks with one paused", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "fermentation-tank-antibiotics",
  );

  expect(line).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 2,
    dataSource: "modeled",
  });
});

it("models two Exhaust Scrubbers with one paused", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "exhaust-scrubber-limestone",
  );

  expect(line).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 2,
    dataSource: "modeled",
  });
});

it("models the completed silicon expansion as active", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  expect(lines.find((line) => line.recipe.id === "arc-furnace-ii-silicon"))
    .toMatchObject({ activeBuildings: 2, builtBuildings: 2, dataSource: "modeled" });
  expect(lines.find((line) => line.recipe.id === "silicon-reactor-poly-silicon"))
    .toMatchObject({ activeBuildings: 6, builtBuildings: 6, dataSource: "modeled" });
  expect(lines.find((line) => line.recipe.id === "crystallizer-silicon-wafer"))
    .toMatchObject({ activeBuildings: 2, builtBuildings: 2, dataSource: "modeled" });
});

it("covers the silicon and Electronics II/III factory demand", () => {
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
  );

  for (const resourceId of [
    "polySilicon",
    "siliconWafer",
    "electronicsII",
    "electronicsIII",
  ]) {
    const flow = result.flows.find((candidate) => candidate.resourceId === resourceId);

    expect(flow?.net, resourceId).toBeGreaterThanOrEqual(0);
  }
});

it("models all three Microchip Machine II stages as three built and active", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const recipeIds = [
    "microchip-machine-ii-1a",
    "microchip-machine-ii-2a",
    "microchip-machine-ii-3a",
    "microchip-machine-ii-4a",
    "microchip-machine-ii-1b",
    "microchip-machine-ii-2b",
    "microchip-machine-ii-3b",
    "microchip-machine-ii-4b",
    "microchip-machine-ii-1c",
    "microchip-machine-ii-2c",
    "microchip-machine-ii-3c",
    "microchip-machine-ii-final",
  ];
  const lines = buildModuleLines(general, preset ?? null).lines.filter(
    ({ recipe }) => recipeIds.includes(recipe.id),
  );

  expect(lines).toHaveLength(recipeIds.length);
  expect(lines.every((line) => (
    line.activeBuildings === 3
    && line.builtBuildings === 3
    && line.dataSource === "modeled"
  ))).toBe(true);
});

it("keeps Station Parts ownership out of Default", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "assembly-v-crew-supplies",
    "chemical-plant-ii-ethanol",
  ]) {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);
    const expectedCount = recipeId === "chemical-plant-ii-ethanol" ? 4 : 1;

    expect(line).toMatchObject({
      activeBuildings: expectedCount,
      builtBuildings: expectedCount,
    });
    expect(line?.dataSource).toBe("modeled");
  }

  expect(lines.some(({ recipe }) => recipe.id === "assembly-v-station-parts"))
    .toBe(false);
});

it("models the completed Diamond and Cooking Oil Diamond Paste recipes", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const lines = buildModuleLines(general, preset ?? null).lines;

  for (const recipeId of [
    "diamond-reactor-synthesis",
    "chemical-plant-ii-diamond-paste-cooking-oil",
  ]) {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);

    expect(line).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
    expect(line?.dataSource).toBe("modeled");
  }

  const heavyOilFallback = lines.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-diamond-paste-heavy-oil",
  );

  expect(heavyOilFallback).toBeUndefined();
});

it("keeps the Air Separator paused after the temporary run", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const airSeparator = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "air-separator-nitrogen",
  );

  expect(airSeparator).toMatchObject({
    activeBuildings: 0,
    builtBuildings: 1,
  });
  expect(preset?.plannedFollowUps ?? []).not.toContainEqual(expect.objectContaining({
    recipeId: "air-separator-nitrogen",
  }));
});

it("pauses every built Coal Maker without planning more", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const coalMaker = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "coal-maker-wood",
  );

  expect(coalMaker).toMatchObject({
    activeBuildings: 0,
    builtBuildings: 3,
  });
  expect(coalMaker?.dataSource).toBeUndefined();
  expect(preset?.dataSources?.["coal-maker-wood"]).toBeUndefined();
});

it("keeps the three built Bread Baking Units active without another construction plan", () => {
  const preset = general.presets.find((candidate) => (
    candidate.id === general.defaultPresetId
  ));
  const bakingUnit = buildModuleLines(general, preset ?? null).lines.find(
    (line) => line.recipe.id === "baking-unit-bread",
  );

  expect(bakingUnit).toMatchObject({
    activeBuildings: 3,
    builtBuildings: 3,
  });
  expect(bakingUnit?.dataSource).toBe("modeled");
  expect(preset?.plannedFollowUps).toBeUndefined();
});

it("keeps five steel refining blocks active when projected demand fits", () => {
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
      activeBuildings: 5,
      builtBuildings: 5,
    });
    expect(lines.find((line) => line.recipe.id === recipeId)?.dataSource).toBeUndefined();
  }
});

it("pauses three Gold Ore buildings and disables the Gold Furnace concentrate recipe", () => {
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
  expect(concentrateFurnace).toMatchObject({ activeBuildings: 0, builtBuildings: 1 });
  expect(settlingTank).toMatchObject({ activeBuildings: 0, builtBuildings: 2 });
  expect(crushers).toMatchObject([
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
  expect(goldLines.every(({ dataSource }) => dataSource === "modeled")).toBe(true);
});

it("combines Tree Sapling and food-process Biomass in the local Default recovery line", () => {
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

it("keeps the completed advanced recipes current in their operating modules", () => {
  const generalPreset = general.presets.find(({ id }) => id === general.defaultPresetId) ?? null;
  const processSteamPreset = processSteam.presets.find(
    ({ id }) => id === processSteam.defaultPresetId,
  ) ?? null;
  const generalLines = buildModuleLines(general, generalPreset).lines.filter(
    ({ recipe }) => ["assembly-v-composite-panel", "lens-polisher"].includes(recipe.id),
  );
  const titaniumPurification = buildModuleLines(processSteam, processSteamPreset).lines.find(
    ({ recipe }) => recipe.id === "distillation-stage-iii-titanium-purification",
  );

  expect(Object.keys(plannedNewDefaultBuildings)).toHaveLength(0);
  expect(modeledDefaultRecipeIds).toEqual(expect.arrayContaining([
    "assembly-v-composite-panel",
    "lens-polisher",
  ]));
  expect(generalLines).toHaveLength(2);
  expect(generalLines.every((line) => (
    line.dataSource === "modeled"
    && line.builtBuildings === 2
    && line.activeBuildings === 2
    && !line.recipe.inputs.some(({ resourceId }) => resourceId.startsWith("steam"))
  ))).toBe(true);
  expect(titaniumPurification).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 1,
    recipe: {
      id: "distillation-stage-iii-titanium-purification",
      inputs: [
        { resourceId: "titaniumChloride", quantity: 12 },
        { resourceId: "steamHigh", quantity: 3 },
      ],
    },
  });
  expect(titaniumPurification?.dataSource).toBeUndefined();
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

it("keeps Greenhouse Groundwater Pumps local while Default supplies factory reserve", () => {
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
  const generalGroundwater = result.calculation.sourceResults.find((candidate) => (
    candidate.moduleId === "general"
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
  expect(generalGroundwater).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(generalGroundwater?.actualOutputs[0]?.quantity).toBeGreaterThan(0);
  expect(generalGroundwater?.actualOutputs[0]?.quantity).toBeLessThanOrEqual(48);
  expect(chickenWaterConsumed).toBeGreaterThan(0);
  expect(pumped).toBeCloseTo(greenhouseWaterConsumed, 10);
});
