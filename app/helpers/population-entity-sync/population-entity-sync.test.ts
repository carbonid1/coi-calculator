import { expect, it } from "vitest";

import { settlementRecipeIds } from "../../db/settlement";
import { type SyncedProductionEntity } from "../../game-state";
import {
  getPopulationZones,
  resolvePopulationEntityInventory,
} from "./population-entity-sync";

const entity = (
  entityId: number,
  prototypeId: string,
  options: Partial<SyncedProductionEntity> = {},
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running: true,
  recipeIds: [],
  zones: [{ id: 25, name: "Population" }],
  nuclearReactor: null,
  dataCenterRacks: null,
  ...options,
});

it("maps only calculator-owned Population buildings from the exact area", () => {
  const inventory = resolvePopulationEntityInventory([
    entity(1, "HousingT3"),
    entity(2, "HousingT3", { running: false }),
    entity(3, "SettlementFoodModule"),
    entity(4, "SettlementLandfillModule", { running: false }),
    entity(5, "Hospital"),
    entity(6, "SettlementComputingModule"),
    entity(7, "TrainStationFluid_ELEC"),
    entity(8, "HousingT3", { zones: [{ id: 26, name: "Population East" }] }),
    entity(9, "HousingT2", { running: false }),
  ]);

  expect(inventory.counts).toMatchObject({
    [settlementRecipeIds.residents]: { built: 2, running: 1 },
    [settlementRecipeIds.foodMarket]: { built: 1, running: 1 },
    [settlementRecipeIds.wasteCollection]: { built: 1, running: 0 },
    [settlementRecipeIds.clinic]: { built: 1, running: 1 },
    [settlementRecipeIds.internetModule]: { built: 1, running: 1 },
    [settlementRecipeIds.residentsII]: { built: 1, running: 0 },
  });
  expect(inventory.housingIiCandidates).toEqual({ built: 1, running: 0 });
  expect(inventory.unmappedEntities.map(candidate => candidate.entityId)).toEqual([7]);
});

it("binds configurable waste-processing buildings only to matching recipes", () => {
  const inventory = resolvePopulationEntityInventory([
    entity(1, "WaterTreatmentPlant", { recipeIds: ["WaterTreatmentT2"] }),
    entity(2, "WaterTreatmentPlant", { recipeIds: ["ToxicSlurryTreatment"] }),
    entity(3, "AnaerobicDigester", { recipeIds: ["SludgeDigestion"] }),
    entity(4, "AnaerobicDigester", { recipeIds: ["CornDigestion"] }),
    entity(5, "IndustrialMixerT2", { recipeIds: ["BiomassCompost"], running: false }),
  ]);

  expect(inventory.counts).toMatchObject({
    [settlementRecipeIds.wastewaterTreatment]: { built: 1, running: 1 },
    [settlementRecipeIds.anaerobicDigester]: { built: 1, running: 1 },
    [settlementRecipeIds.biomassCompostMixer]: { built: 1, running: 0 },
  });
  expect(inventory.unmappedEntities.map(candidate => candidate.entityId)).toEqual([2, 4]);
});

it("scopes duplicate Population names by synced area ID", () => {
  const entities = [
    entity(1, "HousingT3"),
    entity(2, "HousingT3", { zones: [{ id: 27, name: "Population" }] }),
    entity(3, "HousingT2", { zones: [{ id: 27, name: "Population" }] }),
  ];

  expect(getPopulationZones(entities)).toEqual([
    { id: 25, name: "Population" },
    { id: 27, name: "Population" },
  ]);
  expect(resolvePopulationEntityInventory(entities, 25).counts).toMatchObject({
    [settlementRecipeIds.residents]: { built: 1, running: 1 },
  });
  expect(resolvePopulationEntityInventory(entities, 27).counts).toMatchObject({
    [settlementRecipeIds.residents]: { built: 1, running: 1 },
    [settlementRecipeIds.residentsII]: { built: 1, running: 1 },
  });
});
