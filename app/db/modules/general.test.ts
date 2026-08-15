import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { createFbrPowerPlantModule } from "./fbr-power-plant";
import {
  CHICKEN_FARMS_MODULE_ID,
  GREENHOUSES_MODULE_ID,
} from "./farms";
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
    "thermal-desalinator-low": 2,
    "cooling-tower-large-low": 1,
  });
  expect(preset?.builtBuildings).toMatchObject({
    "seawater-pump": 1,
    "thermal-desalinator-low": 2,
    "cooling-tower-large-low": 1,
  });
});

it("keeps every built Titanium-chain recipe paused", () => {
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

  expect(lines
    .filter(({ recipe }) => titaniumRecipeIds.includes(recipe.id))
    .toSorted((a, b) => (
      titaniumRecipeIds.indexOf(a.recipe.id) - titaniumRecipeIds.indexOf(b.recipe.id)
    ))
    .map(({ recipe, builtBuildings, activeBuildings }) => ({
      id: recipe.id,
      builtBuildings,
      activeBuildings,
    })))
    .toEqual(titaniumRecipeIds.map((id) => ({
      id,
      builtBuildings: 1,
      activeBuildings: 0,
    })));
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
        averageNuclearGenerationMw: 30.2,
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
