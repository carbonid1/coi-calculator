import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { activeHousingType, defaultHousingCount } from "../housing";
import { settlementRecipeIds } from "../settlement";
import { createHousingModule } from "./housing";

it("uses two anaerobic digesters to consume the population sludge surplus", () => {
  const housing = createHousingModule(defaultHousingCount);
  const preset = housing.presets.find(
    (candidate) => candidate.id === housing.defaultPresetId,
  )!;
  const { lines } = buildModuleLines(housing, preset);
  const digester = lines.find(
    (line) => line.recipe.id === settlementRecipeIds.anaerobicDigester,
  )!;
  const sludge = calculateNet(lines).allResourceFlows.find(
    (flow) => flow.resourceId === "sludge",
  )!;

  expect(digester.builtBuildings).toBe(2);
  expect(digester.activeBuildings).toBe(2);
  expect(defaultHousingCount).toBe(17);
  expect(defaultHousingCount * activeHousingType.populationCapacity).toBe(2_380);
  expect(sludge.produced).toBeCloseTo(22.491);
  expect(sludge.consumed).toBeCloseTo(sludge.produced);
  expect(sludge.net).toBeCloseTo(0);
});

it("applies settlement demand modifiers to Factory Total flows", () => {
  const housing = createHousingModule(defaultHousingCount);
  const preset = housing.presets.find(
    (candidate) => candidate.id === housing.defaultPresetId,
  )!;
  const { lines } = buildModuleLines(housing, preset);
  const base = calculateNet(lines);
  const modified = calculateNet(lines, {}, undefined, {
    foodConsumption: 1.4,
    settlementWater: 0.85,
  });
  const baseResidents = base.regularResults.find(
    (result) => result.recipe.id === settlementRecipeIds.residents,
  )!;
  const modifiedResidents = modified.regularResults.find(
    (result) => result.recipe.id === settlementRecipeIds.residents,
  )!;
  const actualInput = (
    result: typeof baseResidents,
    resourceId: string,
  ) => result.actualInputs.find((input) => input.resourceId === resourceId)!.quantity;
  const actualOutput = (
    result: typeof baseResidents,
    resourceId: string,
  ) => result.actualOutputs.find((output) => output.resourceId === resourceId)!.quantity;

  expect(actualInput(modifiedResidents, "potato"))
    .toBeCloseTo(actualInput(baseResidents, "potato") * 1.4);
  expect(actualOutput(modifiedResidents, "biomass"))
    .toBeCloseTo(actualOutput(baseResidents, "biomass") * 1.4);
  expect(actualInput(modifiedResidents, "water"))
    .toBeCloseTo(actualInput(baseResidents, "water") * 0.85);
  expect(actualOutput(modifiedResidents, "waste"))
    .toBeCloseTo(actualOutput(baseResidents, "waste"));
  expect(actualOutput(modifiedResidents, "wasteWater"))
    .toBeCloseTo(actualOutput(baseResidents, "wasteWater"));
});
