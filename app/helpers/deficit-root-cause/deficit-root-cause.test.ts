import { describe, expect, it } from "vitest";

import { type CropFarmGroup } from "../../db/crop-farming";
import { createCropFarmRecipe } from "../../db/recipes";
import { type ResourceId, resources } from "../../db/resources";
import { testCropFarming } from '../../test-fixtures/recorded-game-data';
import { type RegularResult, type ResourceFlow } from "../calculate/calculate";
import { getDeficitRootCause } from "./deficit-root-cause";

const farm = (overrides: Partial<CropFarmGroup> = {}, supplyRatio = 1): RegularResult => ({
  recipe: createCropFarmRecipe({
    id: "corn-wheat", name: "Corn and Wheat", farmCount: 1,
    tierId: "greenhouseII", schedule: ["corn", "wheat"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 110 },
    ...overrides,
  }, testCropFarming),
  moduleId: "farms", activeBuildings: 1, builtBuildings: 1,
  operatingMode: "fixed", supplyRatio, speedLevel: 1,
  actualInputs: [], actualOutputs: [], recyclableSourceValueProduced: 0,
});

const shortage = (resourceId: ResourceId): ResourceFlow => ({
  resourceId, name: resources[resourceId].name, produced: 0, consumed: 1, net: -1,
});

describe("crop deficit advice", () => {
  it.each(["greenhouse", "greenhouseII"] as const)("recommends rebalancing %s rotations for each short crop", (tierId) => {
    // Account for recipe demand so the expected message contains no boundary load.
    const consumer = {
      ...farm(), recipe: { id: "consumer", name: "Consumer", building: "Consumer",
        group: "production" as const, inputs: [], outputs: [] },
      actualInputs: [{ resourceId: "corn", quantity: 1 }, { resourceId: "wheat", quantity: 1 }],
    };

    for (const resourceId of ["corn", "wheat"] as const) {
      expect(getDeficitRootCause(resourceId, [farm({ tierId }), consumer], [shortage(resourceId)]))
        .toEqual({ kind: "at-capacity", detail: "Rebalance greenhouses" });
    }
  });

  it("recognizes greenhouses without fertilizer", () => {
    expect(getDeficitRootCause("corn", [farm({ fertilizer: null })], []).detail)
      .toBe("Rebalance greenhouses");
  });

  it.each(["water", "fertilizerII"] as const)("keeps the actual %s shortage when greenhouse production has spare capacity", (resourceId) => {
    expect(getDeficitRootCause("corn", [farm({}, 0.5)], [shortage(resourceId)]))
      .toEqual({ kind: "input-limited", detail: `${resources[resourceId].name} short` });
  });

  it("does not turn unexplained underproduction into greenhouse advice", () => {
    expect(getDeficitRootCause("corn", [farm({}, 0.5)], []))
      .toEqual({ kind: "input-limited", detail: "Input supply limited" });
  });

  it.each(["farm", "irrigatedFarm"] as const)("does not call %s capacity greenhouses", (tierId) => {
    expect(getDeficitRootCause("corn", [farm({ tierId, fertilizer: null })], []).detail)
      .toBe("Rebalance farms");
  });

  it("does not call a mixed crop farm fleet greenhouses", () => {
    expect(getDeficitRootCause("corn", [farm(), farm({ id: "field", tierId: "irrigatedFarm" })], []).detail)
      .toBe("Rebalance farms");
  });

  it("preserves build advice for non-crop producers", () => {
    const producer = farm();

    producer.recipe = { id: "glass", name: "Glass", building: "Glass maker II",
      group: "production", inputs: [], outputs: [{ resourceId: "glass", quantity: 10 }] };

    expect(getDeficitRootCause("glass", [producer], [shortage("glass")]).detail)
      .toBe("Glass maker II · build 1 · 1 outside recipes");
  });
});
