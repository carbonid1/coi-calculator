import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import {
  resolveAreaBuildingCounts,
  resolveAreaRecipeBuildingCount,
} from "./area-building-sync";

const entity = (
  entityId: number,
  prototypeId: string,
  options: Partial<SyncedProductionEntity> = {},
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running: true,
  recipeIds: [],
  zones: [{ id: 20, name: "Solar Power" }],
  nuclearReactor: null,
  dataCenterRacks: null,
  ...options,
});

it("counts exact-area building identities by their game prototype", () => {
  const counts = resolveAreaBuildingCounts([
    entity(1, "SolarPanelMono"),
    entity(2, "SolarPanelMono", { running: false }),
    entity(3, "SolarPanel"),
    entity(4, "SolarPanel", { zones: [{ id: 21, name: "Solar Backup" }] }),
    entity(5, "FastBreederReactor"),
  ], "Solar Power");

  expect(counts).toEqual({
    solarPanel: { built: 1, running: 1 },
    solarPanelMono: { built: 2, running: 1 },
  });
});

it("counts only the matching recipe inside the exact area", () => {
  const counts = resolveAreaRecipeBuildingCount([
    entity(1, "AssemblyRoboticT2", {
      recipeIds: ["StationPartsAssembly"],
      zones: [{ id: 15, name: "Space Station" }],
    }),
    entity(2, "AssemblyRoboticT2", {
      recipeIds: ["StationPartsAssembly"],
      running: false,
      zones: [{ id: 15, name: "Space Station" }],
    }),
    entity(3, "AssemblyRoboticT2", {
      recipeIds: ["StationPartsAssembly"],
      zones: [{ id: 1, name: "Default" }],
    }),
    entity(4, "AssemblyRoboticT2", {
      recipeIds: ["Electronics4Assembly"],
      zones: [{ id: 15, name: "Space Station" }],
    }),
  ], "Space Station", "AssemblyRoboticT2", "StationPartsAssembly");

  expect(counts).toEqual({ built: 2, running: 1 });
});
