import { describe, expect, it } from "vitest";

import { type Module } from "../../db/modules/modules";
import { type BuildingDiagnostic } from "../building-diagnostics/building-diagnostics";
import {
  getPlannedBuildSummaries,
  getPlannedConfigurationSummaries,
  getPlannedFollowUpSummaries,
} from "./planned-builds";

const diagnostic = (
  overrides: Partial<BuildingDiagnostic>,
): BuildingDiagnostic => ({
  key: "space:first",
  moduleId: "space",
  moduleName: "Space plan",
  buildingName: "Assembly V",
  recipeName: "Composite Core",
  plannedCapacity: true,
  load: 1,
  active: 2,
  built: 0,
  attention: null,
  attentionCount: 0,
  affectedResources: [],
  ...overrides,
});

describe("planned build summaries", () => {
  it("keeps planned capacity actionable by recipe", () => {
    const summaries = getPlannedBuildSummaries([
      diagnostic({ active: 2 }),
      diagnostic({
        key: "space:second",
        recipeName: "Station Parts",
        active: 1,
      }),
      diagnostic({
        key: "space:built",
        buildingName: "Cooled Caster II",
        active: 1,
        built: 1,
      }),
      diagnostic({
        key: "current:assembly",
        moduleId: "current",
        plannedCapacity: false,
        active: 4,
        built: 3,
        attention: "build",
        attentionCount: 1,
      }),
    ]);

    expect(summaries).toMatchObject([
      {
        key: "space:first",
        moduleName: "Space plan",
        buildingName: "Assembly V",
        recipeName: "Composite Core",
        built: 0,
        target: 2,
        count: 2,
      },
      {
        key: "space:second",
        moduleName: "Space plan",
        buildingName: "Assembly V",
        recipeName: "Station Parts",
        built: 0,
        target: 1,
        count: 1,
      },
    ]);
  });

  it("groups planned settings applied to existing buildings", () => {
    const summaries = getPlannedConfigurationSummaries([
      diagnostic({
        key: "farms:first",
        moduleId: "farms",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        recipeName: "Potato rotation",
        active: 1,
        built: 1,
      }),
      diagnostic({
        key: "farms:second",
        moduleId: "farms",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        recipeName: "Wheat rotation",
        active: 1,
        built: 1,
      }),
      diagnostic({
        key: "farms:new",
        moduleId: "farms",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        active: 2,
        built: 1,
      }),
      diagnostic({
        key: "current:existing",
        moduleId: "current",
        plannedCapacity: false,
        active: 1,
        built: 1,
      }),
    ]);

    expect(summaries).toMatchObject([
      {
        key: "farms:first",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        recipeName: "Potato rotation",
        count: 1,
      },
      {
        key: "farms:second",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        recipeName: "Wheat rotation",
        count: 1,
      },
    ]);
  });

  it("keeps sequenced pause reminders in the checklist", () => {
    const plannedModule: Module = {
      id: "general",
      name: "General",
      description: "",
      builtBuildings: { bread: 3 },
      defaultPresetId: "plan",
      presets: [{
        id: "plan",
        name: "Plan",
        description: "",
        activeBuildings: { bread: 4 },
        fixed: [],
        plannedFollowUps: [{
          id: "pause-bread",
          recipeId: "bread",
          action: "pause",
          count: 1,
          note: "Pause after the surplus is stocked.",
        }],
      }],
    };
    const bread = diagnostic({
      key: "general:bread",
      moduleId: "general",
      moduleName: "General",
      buildingName: "Baking Unit",
      recipeName: "Bread",
      active: 4,
      built: 3,
    });

    expect(getPlannedFollowUpSummaries([plannedModule], [bread])).toMatchObject([{
      key: "general:pause-bread",
      buildingName: "Baking Unit",
      recipeName: "Bread",
      action: "pause",
      count: 1,
      note: "Pause after the surplus is stocked.",
      diagnostic: bread,
    }]);
  });
});
