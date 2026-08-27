import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateNet } from "../../helpers/calculate/calculate";
import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import { buildings } from "../buildings";
import {
  activeHousingType,
  calculatePopulationCapacity,
  defaultHousingCount,
  plannedHousingCount,
  resolvedCurrentHousingCount,
  resolvedHousingCount,
} from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import { settlementConfig, settlementRecipeIds } from "../settlement";
import { createHousingModule } from "./housing";

it("keeps fifteen Housing III blocks built and plans two more for the workforce", () => {
  const capacityMultiplier = calculateHousingCapacity(
    defaultInfiniteResearchLevels.housingCapacity,
  ).multiplier;
  const housing = createHousingModule(
    resolvedHousingCount.value,
    defaultInfiniteResearchLevels.housingCapacity,
    resolvedCurrentHousingCount.value,
    resolvedHousingCount.source,
  );
  const residentLine = buildModuleLines(housing, housing.presets[0] ?? null).lines.find(
    ({ recipe }) => recipe.id === settlementRecipeIds.residents,
  );

  expect(activeHousingType.name).toBe("Housing III");
  expect(defaultHousingCount).toBe(11);
  expect(resolvedCurrentHousingCount).toEqual({ source: "modeled", value: 15 });
  expect(resolvedHousingCount).toEqual({ source: "planned", value: plannedHousingCount });
  expect(housing.builtBuildings[settlementRecipeIds.residents]).toBe(15);
  expect(housing.presets[0]?.activeBuildings[settlementRecipeIds.residents]).toBe(17);
  expect(housing.presets[0]?.dataSources?.[settlementRecipeIds.residents]).toBe("planned");
  expect(housing.builtBuildings[settlementRecipeIds.wastewaterTreatment]).toBe(1);
  expect(housing.presets[0]?.activeBuildings[settlementRecipeIds.wastewaterTreatment]).toBe(2);
  expect(housing.presets[0]?.dataSources?.[settlementRecipeIds.wastewaterTreatment]).toBe("planned");
  expect(housing.builtBuildings[settlementRecipeIds.anaerobicDigester]).toBe(2);
  expect(housing.presets[0]?.activeBuildings[settlementRecipeIds.anaerobicDigester]).toBe(3);
  expect(housing.presets[0]?.dataSources?.[settlementRecipeIds.anaerobicDigester]).toBe("planned");
  expect(residentLine?.recipe).toMatchObject({
    displayName: "Housing III",
    showConfigurationSummary: false,
  });
  expect(calculatePopulationCapacity(
    activeHousingType,
    resolvedHousingCount.value,
    capacityMultiplier,
  )).toBe(4_896);
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
  const population = activeHousingType.populationCapacity
    * defaultHousingCount
    * calculateHousingCapacity(defaultInfiniteResearchLevels.housingCapacity).multiplier;
  const householdGoods = settlementConfig.householdGoodsPerThousandPopsPerMonth
    * population
    / 1000
    * activeHousingType.serviceDemandMultipliers.householdGoods;
  const householdGoodsBiomass = householdGoods
    * settlementConfig.biomassPerHouseholdGood;
  const medicalSupplies = settlementConfig.medicalSuppliesPerHundredPopsPerMonth
    * population
    / 100;
  const expectedRecyclables = medicalSupplies
      * settlementConfig.recyclablesPerMedicalSupply
    + householdGoods * settlementConfig.recyclablesPerHouseholdGood;

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
  expect(actualOutput(baseResidents, "recyclables")).toBeCloseTo(expectedRecyclables);
  expect(baseResidents.recyclableSourceValueProduced)
    .toBeCloseTo(expectedRecyclables * 2);
  expect(actualOutput(baseResidents, "biomass")).toBeGreaterThan(householdGoodsBiomass);

  const biomassMixer = modified.regularResults.find(
    (result) => result.recipe.id === settlementRecipeIds.biomassCompostMixer,
  )!;

  expect(biomassMixer).toMatchObject({ activeBuildings: 2, builtBuildings: 2 });
  expect(biomassMixer.actualInputs[0]?.quantity)
    .toBeCloseTo(actualOutput(modifiedResidents, "biomass"));
  expect(modified.allResourceFlows.find((flow) => flow.resourceId === "biomass")?.net)
    .toBeCloseTo(0);
});

it("scales full-population housing electricity with capacity research", () => {
  const build = (level: number) => {
    const housingModule = createHousingModule(defaultHousingCount, level);
    const preset = housingModule.presets.find(
      (candidate) => candidate.id === housingModule.defaultPresetId,
    )!;
    const { lines } = buildModuleLines(housingModule, preset);
    const residentLines = lines.filter(
      (line) => line.recipe.id === settlementRecipeIds.residents,
    );
    const result = calculateNet(residentLines);

    return calculateBuildingStats(residentLines, result).electricityKw;
  };
  const level = defaultInfiniteResearchLevels.housingCapacity;
  const multiplier = calculateHousingCapacity(level).multiplier;
  const baseHousingElectricity = buildings[activeHousingType.name]!.electricityKw;

  expect(build(level) - build(0)).toBeCloseTo(
    baseHousingElectricity * defaultHousingCount * (multiplier - 1),
  );
});
