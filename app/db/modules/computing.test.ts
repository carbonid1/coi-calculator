import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateNet } from "../../helpers/calculate/calculate";
import { withTestBuildingRequirements } from '../../test-fixtures/building-requirements'
import { testPlanningDefinitions } from '../../test-fixtures/recorded-game-data';
import {
  computingRecipeIds,
} from "../computing";
import { createComputingModule } from "./computing";
import { type Module } from "./modules";

const expansion = { dataCenterCount: 8, rackCount: 384, waterChillers: 8 };

it("projects the computing expansion with cooling, power, workers, and rack installation", () => {
  const current = { dataCenterCount: 5, rackCount: 240, waterChillers: 5 };
  const computing = createComputingModule(testPlanningDefinitions.computing, current, current, undefined, expansion);
  const preset = computing.presets[0];
  const { lines } = buildModuleLines(withTestBuildingRequirements(computing), preset);
  const result = calculateNet(lines);

  expect(preset.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 8,
    [computingRecipeIds.basicRack]: 384,
    [computingRecipeIds.waterChiller]: 8,
  });
  expect(preset.currentActiveBuildings).toEqual(computing.builtBuildings);
  expect(preset.unplacedPlannedBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 3,
    [computingRecipeIds.basicRack]: 144,
    [computingRecipeIds.waterChiller]: 3,
  });
  expect(Object.values(preset.dataSources ?? {})).toEqual(["planned", "planned", "planned"]);
  expect(preset.planMismatches).toEqual([expect.objectContaining({
    recipeId: computingRecipeIds.basicRack, current: 240, target: 384,
    actions: [{ type: "configure", label: "Install 144 Basic racks" }],
  })]);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "computing")?.produced).toBe(1536);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "chilledWater")?.net).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "water")?.net).toBe(-48);
  expect(calculateBuildingStats(lines, result)).toMatchObject({ workers: 72, electricityKw: 40640 });
});

it("unpauses installed computing capacity before adding more and does not duplicate rack actions", () => {
  const computing = createComputingModule(testPlanningDefinitions.computing, expansion,
    { dataCenterCount: 5, rackCount: 240, waterChillers: 5 }, undefined, expansion);
  const preset = computing.presets[0];

  expect(Object.values(preset.unplacedPlannedBuildings ?? {})).toEqual([0, 0, 0]);
  expect(preset.planMismatches).toEqual([
    expect.objectContaining({ recipeId: computingRecipeIds.dataCenter,
      actions: [{ type: "unpause", label: "Unpause 3 Data Center" }] }),
    expect.objectContaining({ recipeId: computingRecipeIds.waterChiller,
      actions: [{ type: "unpause", label: "Unpause 3 Water Chiller" }] }),
  ]);
  expect(preset.nonActionablePlanRecipeIds).toContain(computingRecipeIds.basicRack);
});

it("unpauses the additional Data Center that houses the missing installed racks", () => {
  const computing = createComputingModule(testPlanningDefinitions.computing,
    { dataCenterCount: 9, rackCount: 384, waterChillers: 8 },
    { dataCenterCount: 8, rackCount: 336, waterChillers: 8 }, undefined, expansion,
  );
  const preset = computing.presets[0];
  const { lines } = buildModuleLines(withTestBuildingRequirements(computing), preset);

  expect(preset.activeBuildings[computingRecipeIds.dataCenter]).toBe(9);
  expect(preset.activeBuildings[computingRecipeIds.basicRack]).toBe(384);
  expect(preset.planMismatches).toEqual([expect.objectContaining({
    recipeId: computingRecipeIds.dataCenter,
    actions: [{ type: "unpause", label: "Unpause 1 Data Center" }],
  })]);
  expect(Object.values(preset.unplacedPlannedBuildings ?? {})).toEqual([0, 0, 0]);
  expect(calculateBuildingStats(lines, calculateNet(lines))).toMatchObject({ workers: 78 });
});

it.each([
  { rackCount: 384, centers: 9, racks: 384, unpause: 1 },
  { rackCount: 400, centers: 10, racks: 416, unpause: 2 },
])("reuses actual rack hosts for a $rackCount-rack target", ({ rackCount, centers, racks, unpause }) => {
  const computing = createComputingModule(testPlanningDefinitions.computing,
    { dataCenterCount: 11, rackCount: 432, waterChillers: 8 },
    { dataCenterCount: 8, rackCount: 336, waterChillers: 8 },
    undefined, { ...expansion, rackCount }, [16, 32, 48],
  );

  expect(computing.presets[0].activeBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: centers, [computingRecipeIds.basicRack]: racks,
  });
  expect(computing.presets[0].planMismatches).toEqual([expect.objectContaining({
    recipeId: computingRecipeIds.dataCenter,
    actions: [{ type: "unpause", label: `Unpause ${unpause} Data Center` }],
  })]);
});

it("keeps construction separate from paused rack hosts and new builds", () => {
  const generatedArea: Module = {
    id: "computing", name: "Computing", description: "", builtBuildings: {},
    presets: [{ id: "live", name: "Live", description: "", activeBuildings: {}, fixed: [],
      capacityPools: { DataCenter: { built: 2, active: 2, currentActive: 1, constructionGhosts: 1 } },
    }],
  };
  const built = { dataCenterCount: 2, rackCount: 96, waterChillers: 4 };
  const running = { dataCenterCount: 1, rackCount: 48, waterChillers: 4 };
  const plan = { dataCenterCount: 2, rackCount: 96, waterChillers: 4 };
  const planned = createComputingModule(testPlanningDefinitions.computing, built, running, generatedArea, plan, [48]).presets[0];

  expect(planned.activeBuildings[computingRecipeIds.dataCenter]).toBe(3);
  expect(planned.planMismatches).toEqual([expect.objectContaining({
    recipeId: computingRecipeIds.dataCenter,
    actions: [{ type: "unpause", label: "Unpause 1 Data Center" }],
  })]);
  expect(planned.unplacedPlannedBuildings?.[computingRecipeIds.dataCenter]).toBe(0);

  const expanded = createComputingModule(testPlanningDefinitions.computing, built, running, generatedArea,
    { ...plan, dataCenterCount: 4, rackCount: 192 }, [48]).presets[0];

  expect(expanded.unplacedPlannedBuildings?.[computingRecipeIds.dataCenter]).toBe(1);
  expect(expanded.planMismatches?.[0].actions).toEqual([
    { type: "unpause", label: "Unpause 1 Data Center" },
    { type: "build", label: "Build 1 Data Center" },
  ]);
});

it.each([8, 9])("clears the computing plan when %s full Data Centers and chillers are running", count => {
  const current = { dataCenterCount: count, rackCount: count * 48, waterChillers: count };
  const computing = createComputingModule(testPlanningDefinitions.computing, current, current, undefined, expansion);
  const preset = computing.presets[0];

  expect(preset.activeBuildings).toEqual(computing.builtBuildings);
  expect(Object.values(preset.dataSources ?? {})).toEqual(["synced", "synced", "synced"]);
  expect(preset.planMismatches).toEqual([]);
  expect(Object.values(preset.unplacedPlannedBuildings ?? {})).toEqual([0, 0, 0]);
});

it("keeps built and running synced computing inventory separate", () => {
  const computingModule = createComputingModule(testPlanningDefinitions.computing,
    { dataCenterCount: 5, rackCount: 202, waterChillers: 5 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 4 },
  );
  const preset = computingModule.presets[0];

  expect(computingModule.builtBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 5,
    [computingRecipeIds.basicRack]: 202,
    [computingRecipeIds.waterChiller]: 5,
  });
  expect(preset.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 1,
    [computingRecipeIds.basicRack]: 48,
    [computingRecipeIds.waterChiller]: 4,
  });
  expect(preset.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "synced",
    [computingRecipeIds.basicRack]: "synced",
    [computingRecipeIds.waterChiller]: "synced",
  });
  expect(preset.planMismatches).toBeUndefined();
});

it("preserves the generated area identity and removes handled recipe issues", () => {
  const generatedWaterChillerRecipeId = "live-area-15:WaterChiller:WaterChilling";
  const generatedArea: Module = {
    id: "live-area-15",
    name: "Computing",
    description: "",
    includedInFactoryTotals: false,
    builtBuildings: { [generatedWaterChillerRecipeId]: 1 },
    recipes: [{
      id: generatedWaterChillerRecipeId,
      name: "WaterChilling",
      building: "Water chiller",
      group: "production",
      inputs: [{ resourceId: "water", quantity: 30 }],
      outputs: [{ resourceId: "chilledWater", quantity: 24 }],
    }],
    presets: [{
      id: "live",
      name: "Live area",
      description: "Synced completed buildings plus synced construction ghosts.",
      activeBuildings: { [generatedWaterChillerRecipeId]: 2 },
      currentActiveBuildings: { [generatedWaterChillerRecipeId]: 1 },
      builtBuildings: { [generatedWaterChillerRecipeId]: 1 },
      constructionGhosts: { [generatedWaterChillerRecipeId]: 1 },
      capacityPools: {
        DataCenter: {
          active: 2,
          built: 1,
          currentActive: 1,
          constructionGhosts: 1,
        },
        WaterChiller: {
          active: 2,
          built: 1,
          currentActive: 1,
          constructionGhosts: 1,
        },
      },
      dataSources: { [generatedWaterChillerRecipeId]: "synced" },
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId: 15,
      trackedBuildings: 4,
      constructedBuildings: 2,
      activeBuildings: 2,
      pausedBuildings: 0,
      constructionGhosts: 2,
      issues: [
        {
          id: "DataCenter:no-recipe",
          building: "Data Center",
          count: 1,
          message: "This building does not expose a production recipe.",
        },
      ],
    },
  };
  const computing = createComputingModule(testPlanningDefinitions.computing,
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    generatedArea,
  );

  expect(computing.id).toBe("live-area-15");
  expect(computing.defaultPresetId).toBe("live");
  expect(computing.includedInFactoryTotals).toBe(true);
  expect(computing.liveArea?.issues).toEqual([]);
  expect(computing.recipes).toEqual([]);
  expect(computing.builtBuildings).not.toHaveProperty(generatedWaterChillerRecipeId);
  expect(computing.presets[0].activeBuildings).not.toHaveProperty(
    generatedWaterChillerRecipeId,
  );
  expect(computing.presets[0].description).toBe("");
  expect(computing.presets[0]).toMatchObject({
    activeBuildings: {
      [computingRecipeIds.dataCenter]: 2,
      [computingRecipeIds.basicRack]: 48,
      [computingRecipeIds.waterChiller]: 2,
    },
    currentActiveBuildings: {
      [computingRecipeIds.dataCenter]: 1,
      [computingRecipeIds.basicRack]: 48,
      [computingRecipeIds.waterChiller]: 1,
    },
    constructionGhosts: {
      [computingRecipeIds.dataCenter]: 1,
      [computingRecipeIds.basicRack]: 0,
      [computingRecipeIds.waterChiller]: 1,
    },
  });
  expect(computing.presets[0].capacityPools).toEqual({});
  expect(computing.presets[0].dataSources).toMatchObject({
    [computingRecipeIds.dataCenter]: "synced",
    [computingRecipeIds.basicRack]: "synced",
    [computingRecipeIds.waterChiller]: "synced",
  });

  const planned = createComputingModule(testPlanningDefinitions.computing,
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    generatedArea,
    { dataCenterCount: 3, rackCount: 144, waterChillers: 3 },
  ).presets[0];

  expect(planned.activeBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 3,
    [computingRecipeIds.basicRack]: 144,
    [computingRecipeIds.waterChiller]: 3,
  });
  expect(planned.unplacedPlannedBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 1,
    [computingRecipeIds.basicRack]: 96,
    [computingRecipeIds.waterChiller]: 1,
  });
  expect(planned.constructionGhosts).toEqual(computing.presets[0].constructionGhosts);
});
