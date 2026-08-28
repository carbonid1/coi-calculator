import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../../helpers/modifiers/calculate-tree-growth-speed";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { defaultInfiniteResearchLevels } from "../research";
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from "./area-maintenance";
import { DEFAULT_MODULE_ID } from "./default";
import { modules } from "./modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
} from "./nuclear";

it("keeps process waste and graphite balanced with the current coal-route capacity", () => {
  const cropFarming = calculateCropFarmingModifiers(
    defaultInfiniteResearchLevels.cropYield,
    defaultActiveEdicts.farmingBoost,
  );
  const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: DEFAULT_MODULE_ID,
    demand: {
      maintenanceI: 547.8,
      maintenanceII: 194.22,
      maintenanceIII: 236.55,
    },
    modules,
  });
  const configuredModules = modules.map(module => {
    const maintenanceAssignment = maintenanceAssignments[module.id];

    if (maintenanceAssignment) {
      module = attachMaintenanceDepotsToModule(module, maintenanceAssignment, "modeled");
    }

    if (module.id === NUCLEAR_MODULE_ID) {
      return createNuclearModule(defaultNuclearConfig, {
        averageGeneratorOutputMw: 77,
        hydrogenFuelDemandPerCycle: 46.5,
      });
    }

    return module;
  });
  const result = calculateFactoryTotal(
    configuredModules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
    {
      foodConsumption: calculateFoodConsumption(0, 2).multiplier,
      maintenanceOutput: calculateMaintenanceOutput(
        defaultInfiniteResearchLevels.maintenanceOutput,
      ).multiplier,
      solarPower: calculateSolarPower(
        defaultInfiniteResearchLevels.solarPower,
        defaultActiveEdicts.cleanPanels,
      ).multiplier,
      cropYield: cropFarming.yieldMultiplier,
      cropWater: cropFarming.waterDemandMultiplier,
      treeGrowthSpeed: calculateTreeGrowthSpeed(
        defaultInfiniteResearchLevels.treeGrowthSpeed,
      ).multiplier,
    },
  );
  const graphite = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "graphite",
  )!;
  const carbonDioxide = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "carbonDioxide",
  )!;
  const processWaste = ["carbonDioxide", "redMud", "exhaust", "wasteWater"]
    .map((resourceId) => result.calculation.allResourceFlows.find(
      (flow) => flow.resourceId === resourceId,
    ));
  const graphiteResults = result.calculation.regularResults.filter(
    (candidate) => candidate.recipe.id.startsWith("chemical-plant-ii-graphite"),
  );
  const carbonDioxideResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite",
  )!;
  const coalResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite-coal",
  )!;

  expect(carbonDioxideResult.builtBuildings).toBe(2);
  expect(carbonDioxideResult.activeBuildings).toBe(2);
  expect(carbonDioxideResult.dataSource).toBeUndefined();
  expect(coalResult.builtBuildings).toBe(3);
  expect(carbonDioxideResult.capacityPoolId).toBeUndefined();
  expect(coalResult.capacityPoolId).toBeUndefined();
  expect(carbonDioxideResult.supplyRatio).toBeGreaterThan(0);
  expect(coalResult.supplyRatio).toBeGreaterThan(0);
  expect(carbonDioxideResult.recipe.sharedCapacity).toBeUndefined();
  expect(coalResult.recipe.sharedCapacity).toBeUndefined();
  expect(coalResult.recipe.electricityMultiplier).toBe(2);
  expect(coalResult.supplyRatio).toBeGreaterThan(0.6);
  expect(coalResult.supplyRatio).toBeLessThan(0.7);
  expect(carbonDioxide.net).toBeCloseTo(0, 6);
  expect(graphite.produced).toBeCloseTo(graphite.consumed, 6);
  expect(graphite.net).toBeCloseTo(0, 6);
  expect(processWaste.every((flow) => flow != null)).toBe(true);
  expect(processWaste.every((flow) => Math.abs(flow?.net ?? 1) < 1e-6)).toBe(true);
});
