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
