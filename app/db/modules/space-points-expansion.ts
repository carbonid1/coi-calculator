import { defaultSpaceStationLevel } from "../space-station";
import { type Module } from "./modules";

export const SPACE_POINTS_EXPANSION_MODULE_ID = "space-points-expansion";

/**
 * Locked construction plan: these are the new physical buildings reserved for
 * the Electronics IV chain. The recipes remain demand-balanced so the standard
 * module cards show their expected utilization rather than forcing every
 * building to run at full capacity.
 */
export const spacePointsExpansionBuiltBuildings = {
  "crusher-large-bauxite": 1,
  "chemical-plant-ii-bauxite-digestion": 1,
  "rotary-kiln-alumina-fuel-gas": 1,
  "crystallizer-alumina": 1,
  "liquid-dump-red-mud": 1,
  "chemical-plant-ii-graphite-coal": 1,
  "diamond-reactor-synthesis": 1,
  "chemical-plant-ii-diamond-paste-cooking-oil": 1,
  "chemical-plant-ii-diamond-paste-heavy-oil": 1,
  "lens-polisher": 2,
  "assembly-v-electronics-iii": 1,
  "assembly-v-electronics-iv": 1,
};

export const spacePointsExpansion: Module = {
  id: SPACE_POINTS_EXPANSION_MODULE_ID,
  name: "Space Points Exp.",
  description: "Locked new construction for 4 Electronics IV per production cycle",
  builtBuildings: spacePointsExpansionBuiltBuildings,
  presets: [{
    id: "locked-build-plan",
    name: "Locked build plan",
    description: "New buildings only; existing factory production supplies the remaining inputs",
    builtBuildings: spacePointsExpansionBuiltBuildings,
    activeBuildings: spacePointsExpansionBuiltBuildings,
    fixed: [],
    outputTargets: {
      electronicsIv: defaultSpaceStationLevel.researchSuppliesPerCycle,
    },
  }],
  defaultPresetId: "locked-build-plan",
};
