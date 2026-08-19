import {
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationLevel,
} from "../space-station";
import { type Module } from "./modules";

export const SPACE_POINTS_EXPANSION_MODULE_ID = "space-points-expansion";

const plannedRedMudRecovery = {
  ironOreCrushedPerCycle: 15.832451499118164,
} as const;

/**
 * Locked construction plan for the new Aluminum, Titanium Alloy, and
 * Electronics IV chains. Established factory products remain module imports;
 * this module never hides their deficits by adding legacy production capacity.
 */
export const spacePointsExpansionBuiltBuildings = {
  "crusher-large-bauxite": 2,
  "chemical-plant-ii-bauxite-digestion": 2,
  "rotary-kiln-alumina-fuel-gas": 2,
  "aluminum-cell-electrolysis": 2,
  "cooled-caster-ii-aluminum": 2,
  "crystallizer-alumina": 1,
  "settling-tank-red-mud-acid": 4,
  "crusher-large-titanium": 1,
  "arc-furnace-ii-titanium-ore": 1,
  "chemical-plant-ii-titanium-chlorination": 1,
  "distillation-stage-iii-titanium-purification": 1,
  "chemical-plant-ii-titanium-reduction": 1,
  "arc-furnace-ii-titanium-sponge": 1,
  "alloy-mixer-titanium": 1,
  "cooled-caster-ii-titanium-alloy": 1,
  "diamond-reactor-synthesis": 1,
  "chemical-plant-ii-diamond-paste-cooking-oil": 1,
  "chemical-plant-ii-diamond-paste-heavy-oil": 1,
  "lens-polisher": 2,
  "assembly-v-electronics-iv": 1,
};

export const spacePointsExpansion: Module = {
  id: SPACE_POINTS_EXPANSION_MODULE_ID,
  name: "Space Points Exp.",
  description: "Locked new production for recurring Rocket II supplies and 4 Electronics IV per production cycle",
  includedInFactoryTotals: false,
  builtBuildings: spacePointsExpansionBuiltBuildings,
  presets: [{
    id: "locked-build-plan",
    name: "Locked build plan",
    description: "New chains only; established factory products are imported",
    builtBuildings: spacePointsExpansionBuiltBuildings,
    activeBuildings: spacePointsExpansionBuiltBuildings,
    fixed: [],
    outputTargets: {
      aluminum: defaultRocketIiRecurringLogistics.aluminumPerCycle,
      titaniumAlloy: defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle,
      electronicsIv: defaultSpaceStationLevel.researchSuppliesPerCycle,
      ironOreCrushed: plannedRedMudRecovery.ironOreCrushedPerCycle,
    },
  }],
  defaultPresetId: "locked-build-plan",
};
