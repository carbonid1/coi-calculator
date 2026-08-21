import { expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import { modules } from "../../db/modules/modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
} from "../../db/modules/nuclear";
import { calculateFactoryTotal } from "../factory-total/factory-total";
import { createNuclearPowerBlocks } from "./nuclear-power-blocks";

it("presents the breeder without turbines and the power reactor with its turbine bank", () => {
  const configuredModules = modules.map(module =>
    module.id === NUCLEAR_MODULE_ID
      ? createNuclearModule(defaultNuclearConfig, {
          averageGeneratorOutputMw: 77,
          hydrogenFuelDemandPerCycle: 46.5,
        })
      : module,
  );
  const factory = calculateFactoryTotal(configuredModules, activeContracts);
  const electricityLines = factory.allLines.filter((line) => (
    line.moduleId === NUCLEAR_MODULE_ID && line.recipe.group === "electricity"
  ));
  const results = factory.calculation.regularResults.filter(
    (result) => result.moduleId === NUCLEAR_MODULE_ID,
  );
  const blocks = createNuclearPowerBlocks(electricityLines, results);

  expect(blocks[0]?.turbineBank).toEqual([]);
  expect(blocks.map((block) => ({
    reactor: block.reactor.line.recipe.id,
    trains: block.turbineBank.find(
      ({ line }) => line.recipe.id === "turbine-super",
    )?.line.builtBuildings,
    activeTrains: block.turbineBank.find(
      ({ line }) => line.recipe.id === "turbine-super",
    )?.line.activeBuildings,
    generators: block.turbineBank.find(
      ({ line }) => line.recipe.id === "power-generator-ii-nuclear",
    )?.line.builtBuildings,
  }))).toEqual([
    { reactor: "fbr-3x", trains: undefined, activeTrains: undefined, generators: undefined },
    { reactor: "fbr-0x", trains: 8, activeTrains: 3, generators: 16 },
  ]);

  expect(blocks.map((block) => block.reactor.result?.actualOutputs)).toEqual([
    [
      { resourceId: "steamSuper", quantity: 24 },
      { resourceId: "coreFuelSpent", quantity: 4 },
      { resourceId: "blanketFuelEnriched", quantity: 12 },
    ],
    [
      { resourceId: "steamSuper", quantity: 384 },
      { resourceId: "coreFuelSpent", quantity: 8 },
    ],
  ]);

  const presentedElectricity = blocks.flatMap((block) => block.turbineBank)
    .flatMap(({ result }) => result?.actualOutputs ?? [])
    .filter((output) => output.resourceId === "electricity")
    .reduce((total, output) => total + output.quantity, 0);
  const calculatedNuclearElectricity = results
    .flatMap((result) => result.actualOutputs)
    .filter((output) => output.resourceId === "electricity")
    .reduce((total, output) => total + output.quantity, 0);

  expect(presentedElectricity).toBeCloseTo(calculatedNuclearElectricity, 10);
});
