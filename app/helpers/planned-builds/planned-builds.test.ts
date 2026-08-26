import { describe, expect, it } from "vitest";

import { type BuildingDiagnostic } from "../building-diagnostics/building-diagnostics";
import {
  getPlannedBuildSummaries,
  getPlannedConfigurationSummaries,
} from "./planned-builds";

const diagnostic = (
  overrides: Partial<BuildingDiagnostic>,
): BuildingDiagnostic => ({
  key: "space:first",
  moduleId: "space",
  moduleName: "Space plan",
  buildingName: "Assembly V",
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
  it("groups recipe capacity into the remaining physical buildings", () => {
    const summaries = getPlannedBuildSummaries([
      diagnostic({ active: 2 }),
      diagnostic({ key: "space:second", active: 1 }),
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

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      moduleName: "Space plan",
      buildingName: "Assembly V",
      built: 0,
      target: 3,
      count: 3,
    });
  });

  it("groups planned settings applied to existing buildings", () => {
    const summaries = getPlannedConfigurationSummaries([
      diagnostic({
        key: "farms:first",
        moduleId: "farms",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
        active: 1,
        built: 1,
      }),
      diagnostic({
        key: "farms:second",
        moduleId: "farms",
        moduleName: "Greenhouses",
        buildingName: "Greenhouse II",
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

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      moduleName: "Greenhouses",
      buildingName: "Greenhouse II",
      count: 2,
    });
  });
});
