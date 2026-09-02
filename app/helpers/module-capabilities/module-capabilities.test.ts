import { describe, expect, it } from "vitest";

import { inferModuleCapabilities } from "./module-capabilities";

describe("module capabilities", () => {
  it("infers multiple capabilities from stable prototype IDs", () => {
    expect(inferModuleCapabilities([
      { prototypeId: "FarmT4" },
      { prototypeId: "OfficeBuildingT3" },
      { prototypeId: "DataCenter" },
    ])).toEqual(["computing", "crop-farming", "offices"]);
  });

  it("does not depend on a module or prototype display name", () => {
    expect(inferModuleCapabilities([
      { prototypeId: "HousingT3" },
      { prototypeId: "RocketLaunchPad" },
      { prototypeId: "ForestryTower", forestry: {} },
    ])).toEqual(["forestry", "population", "space-station"]);
  });

  it("marks synthetic Default explicitly", () => {
    expect(inferModuleCapabilities([], { isDefault: true })).toEqual(["default"]);
  });
});
