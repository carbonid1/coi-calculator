import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { defaultHousingCount } from "../housing";
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

  expect(digester.totalBuildings).toBe(2);
  expect(digester.buildingCount).toBe(2);
  expect(sludge.produced).toBeCloseTo(21.168);
  expect(sludge.consumed).toBeCloseTo(sludge.produced);
  expect(sludge.net).toBeCloseTo(0);
});
