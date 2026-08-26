import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { createSolarPowerModule } from "./solar-power";

it("retains built solar capacity while only running panels generate", () => {
  const solarModule = createSolarPowerModule(
    { standard: 10, mono: 20 },
    { standard: 8, mono: 15 },
  );
  const preset = solarModule.presets[0];
  const { lines } = buildModuleLines(solarModule, preset);

  expect(lines.map(line => ({
    id: line.recipe.id,
    active: line.activeBuildings,
    built: line.builtBuildings,
  }))).toEqual([
    { id: "solar-panel", active: 8, built: 10 },
    { id: "solar-panel-mono", active: 15, built: 20 },
  ]);
});

it("keeps installed panels built while the planned target exposes build pressure", () => {
  const solarModule = createSolarPowerModule(
    { standard: 10, mono: 20 },
    { standard: 8, mono: 15 },
    { mono: 25 },
  );
  const preset = solarModule.presets[0];

  expect(solarModule.builtBuildings).toEqual({
    "solar-panel": 10,
    "solar-panel-mono": 20,
  });
  expect(preset?.activeBuildings).toEqual({
    "solar-panel": 8,
    "solar-panel-mono": 25,
  });
  expect(preset?.dataSources).toEqual({ "solar-panel-mono": "planned" });
});

it("counts synced construction down toward a fixed target", () => {
  const partiallyBuilt = createSolarPowerModule(
    { standard: 10, mono: 22 },
    { standard: 8, mono: 22 },
    { mono: 25 },
  );
  const completed = createSolarPowerModule(
    { standard: 10, mono: 25 },
    { standard: 8, mono: 25 },
    { mono: 25 },
  );

  expect(partiallyBuilt.presets[0]?.activeBuildings["solar-panel-mono"]).toBe(25);
  expect(partiallyBuilt.presets[0]?.dataSources).toEqual({
    "solar-panel-mono": "planned",
  });
  expect(completed.presets[0]?.activeBuildings["solar-panel-mono"]).toBe(25);
  expect(completed.presets[0]?.dataSources).toBeUndefined();
});

it("treats synced capacity above the target as complete", () => {
  const solarModule = createSolarPowerModule(
    { standard: 10, mono: 27 },
    { standard: 8, mono: 27 },
    { mono: 25 },
  );

  expect(solarModule.presets[0]?.activeBuildings["solar-panel-mono"]).toBe(27);
  expect(solarModule.presets[0]?.dataSources).toBeUndefined();
});

it("keeps the target planned until enough built panels are running", () => {
  const solarModule = createSolarPowerModule(
    { standard: 10, mono: 25 },
    { standard: 8, mono: 23 },
    { mono: 25 },
  );

  expect(solarModule.presets[0]?.activeBuildings["solar-panel-mono"]).toBe(25);
  expect(solarModule.presets[0]?.dataSources).toEqual({
    "solar-panel-mono": "planned",
  });
});
