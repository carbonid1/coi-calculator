import { describe, expect, it } from "vitest";

import { type SyncedAreaEntity } from "../../game-state";
import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateNet } from "../../helpers/calculate/calculate";
import { createLiveAreaModules } from "../../helpers/live-area-modules/live-area-modules";
import { type CurrentChickenFarmEntity } from "../chicken-farm";
import { createChickenFarmAreaModule } from "./farms";

const slaughtering = "chicken-farm-slaughtering";
const eggsOnly = "chicken-farm-eggs-only";
const zones = [{ id: 11, name: "Chicken Farms" }, { id: 26, name: "Chikens v2" }];

const farm = (
  entityId: number,
  zoneId: number,
  running = false,
  chickens = 0,
  slaughtering = true,
): CurrentChickenFarmEntity => ({
  entityId, running, chickens, slaughtering,
  zones: zones.filter(zone => zone.id === zoneId),
});

const areaFarm = (entity: CurrentChickenFarmEntity, constructed = true): SyncedAreaEntity => ({
  entityId: entity.entityId,
  prototypeId: "ChickenFarm",
  prototypeName: "Chicken farm",
  constructed,
  constructionState: constructed ? "Constructed" : "InConstruction",
  running: constructed && entity.running,
  tile: { x: entity.entityId, y: 0 },
  zones: [...entity.zones],
  recipes: [],
  availableRecipeCount: 0,
});

const resolveAreas = (
  current: CurrentChickenFarmEntity[],
  ghosts: SyncedAreaEntity[] = [],
) => {
  const inventory = [...current.map(entity => areaFarm(entity)), ...ghosts];

  return createLiveAreaModules([{ id: -1, name: "Default" }, ...zones], inventory).map(module => {
    const configured = createChickenFarmAreaModule(module, current, inventory);
    const preset = configured.presets[0];
    const { lines } = buildModuleLines(configured, preset);
    const result = calculateNet(lines);

    return {
      module: configured,
      preset,
      lines,
      result,
      workers: calculateBuildingStats(lines, result).workers,
    };
  });
};

const newArea = (current: CurrentChickenFarmEntity[], ghosts: SyncedAreaEntity[] = []) => {
  const area = resolveAreas(current, ghosts).find(area => area.module.liveArea?.zoneId === 26);

  if (!area) throw new Error("New chicken area missing");
  return area;
};

describe("chicken farm area inventory", () => {
  it("projects all 21 construction ghosts at 500 chickens with slaughtering on", () => {
    const ghosts = Array.from({ length: 21 }, (_, i) => areaFarm(farm(i, 26), false));
    const area = newArea([], ghosts);

    expect(area.lines).toHaveLength(1);
    expect(area.lines[0]).toMatchObject({
      recipe: { id: slaughtering },
      builtBuildings: 0,
      activeBuildings: 21,
      currentActiveBuildings: 0,
      constructionGhosts: 21,
      unplacedPlannedBuildings: 0,
      speedLevel: 1,
      dataSource: "planned",
    });
    expect(area.workers).toBe(252);
    expect(area.result.allResourceFlows.find(flow => flow.resourceId === "chickenCarcass")?.produced)
      .toBe(210);
    expect(area.preset.planMismatches ?? []).toEqual([]);
  });

  it("replaces ghosts with actual empty paused inventory when construction completes", () => {
    const current = Array.from({ length: 21 }, (_, i) => farm(i, 26));
    const area = newArea(current);

    expect(area.lines).toHaveLength(1);
    expect(area.lines[0]).toMatchObject({
      builtBuildings: 21,
      activeBuildings: 0,
      currentActiveBuildings: 0,
      constructionGhosts: 0,
      unplacedPlannedBuildings: 0,
      speedLevel: 0,
      dataSource: "synced",
    });
    expect(area.module.liveArea).toMatchObject({ constructedBuildings: 21, pausedBuildings: 21 });
    expect(area.workers).toBe(0);
    expect(area.result.allResourceFlows.every(flow => flow.produced === 0 && flow.consumed === 0))
      .toBe(true);
    expect(area.preset.planMismatches ?? []).toEqual([]);
  });

  it("uses exact synced population and operating modes without filling or unpausing farms", () => {
    const area = newArea([
      farm(1, 26, true, 337),
      farm(2, 26),
      farm(3, 26, true, 500, false),
    ]);

    expect(area.lines.find(line => line.recipe.id === slaughtering)).toMatchObject({
      builtBuildings: 2, activeBuildings: 1, currentActiveBuildings: 1, speedLevel: 337 / 500,
    });
    expect(area.lines.find(line => line.recipe.id === eggsOnly)).toMatchObject({
      builtBuildings: 1, activeBuildings: 1, speedLevel: 1,
    });
    expect(area.workers).toBe(24);
    expect(area.result.allResourceFlows.find(flow => flow.resourceId === "chickenCarcass")?.produced)
      .toBeCloseTo(6.74);
  });

  it("keeps existing farm areas independent from the new paused area", () => {
    const areas = resolveAreas([
      ...Array.from({ length: 5 }, (_, i) => farm(i, 11, true, 500)),
      ...Array.from({ length: 21 }, (_, i) => farm(i + 100, 26)),
    ]);
    const original = areas.find(area => area.module.liveArea?.zoneId === 11)!;
    const expansion = areas.find(area => area.module.liveArea?.zoneId === 26)!;

    expect(original.lines[0]).toMatchObject({ activeBuildings: 5, speedLevel: 1, dataSource: "synced" });
    expect(expansion.lines[0]).toMatchObject({ activeBuildings: 0, speedLevel: 0, dataSource: "synced" });
    expect(original.result.allResourceFlows.find(flow => flow.resourceId === "chickenCarcass")?.produced)
      .toBe(50);
  });

  it("keeps actual activity distinct from projected ghosts in a mixed area", () => {
    const area = newArea([farm(1, 26, true, 250), farm(2, 26)], [areaFarm(farm(3, 26), false)]);

    expect(area.lines[0]).toMatchObject({
      builtBuildings: 2, activeBuildings: 2, currentActiveBuildings: 1,
      constructionGhosts: 1, unplacedPlannedBuildings: 0, speedLevel: 0.75, dataSource: "planned",
    });
  });

  it("assigns overlapping farm inventory to one stable area and unassigned farms to Default", () => {
    const overlap = { ...farm(1, 26, true, 500), zones: [...zones].reverse() };
    const unassigned = farm(2, -1, true, 500);
    const areas = resolveAreas([overlap, unassigned], [areaFarm({ ...overlap, entityId: 3 }, false)]);

    expect(areas.find(area => area.module.liveArea?.zoneId === 11)?.lines[0])
      .toMatchObject({ builtBuildings: 1, constructionGhosts: 1 });
    expect(areas.find(area => area.module.liveArea?.zoneId === 26)?.lines).toEqual([]);
    expect(areas.find(area => area.module.liveArea?.zoneId === -1)?.lines[0])
      .toMatchObject({ builtBuildings: 1, activeBuildings: 1 });
  });
});
