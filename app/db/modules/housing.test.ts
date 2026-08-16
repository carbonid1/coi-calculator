import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { defaultHousingCount } from "../housing";
import { settlementRecipeIds } from "../settlement";
import { createHousingModule } from "./housing";

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
  const householdGoodsBiomass = 11.088;

  expect(actualOutput(modifiedResidents, "biomass")).toBeCloseTo(
    (actualOutput(baseResidents, "biomass") - householdGoodsBiomass) * 1.4
      + householdGoodsBiomass,
  );
  expect(actualInput(modifiedResidents, "water"))
    .toBeCloseTo(actualInput(baseResidents, "water") * 0.85);
  expect(actualOutput(modifiedResidents, "waste"))
    .toBeCloseTo(actualOutput(baseResidents, "waste"));
  expect(actualOutput(modifiedResidents, "wasteWater"))
    .toBeCloseTo(actualOutput(baseResidents, "wasteWater") * 0.85);
  expect(actualOutput(baseResidents, "recyclables")).toBeCloseTo(20.46);
  expect(baseResidents.recyclableSourceValueProduced).toBeCloseTo(40.92);
  expect(actualOutput(baseResidents, "biomass")).toBeGreaterThan(householdGoodsBiomass);
});
