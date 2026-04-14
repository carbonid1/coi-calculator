import { type ResourceId } from "../resources";
import { type Module } from "./modules";

const ext = (vals: Partial<Record<ResourceId, number>>): Partial<Record<ResourceId, number>> => vals;

// Steam buildings — 1+1 has no super steam excess, 1+4 needs cooling
const steam1x1 = {
  "seawater-pump": 4,
  "turbine-super": 2,
  "turbine-high": 2,
  "turbine-low": 2,
  "hydrogen-reformer-super": 2,
  "thermal-desalinator-super": 6,
  "thermal-desalinator-depleted": 5,
  "cooling-tower-large-depleted": 1,
};

const steam1x4 = {
  ...steam1x1,
  "cooling-tower-large-super": 3,
};


// Only fuel loop is pinned — pre-calculated BFE/CFS split.
// Steam consumers are flexible (engine allocates by priority).
const fuelPinned = [
  "fbr-3x", "fbr-0x",
  "nuclear-reprocessing", "enrichment-plant", "enrichment-plant-uranium",
  "chemical-plant-blanket-enriched", "chemical-plant-yellowcake",
  "nuclear-reprocessing-spent-fuel", "nuclear-reprocessing-spent-mox",
];

export const fbrPowerPlant: Module = {
  id: "fbr-power-plant",
  name: "FBR Power Plant",
  description: "1 Breeder (3x) + N Energy (0x) — phased fuel loop",
  buildingTotals: {}, // presets define their own
  presets: [
    {
      id: "1+1-burn-du",
      name: "1+1 Burn DU",
      description: "75 MW — zero UO, 12 DU/60s, +0.45 EU20/60s",
      buildingTotals: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1, "enrichment-plant-uranium": 1,
        "chemical-plant-blanket-enriched": 2,
        ...steam1x1,
      },
      active: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 0.375,
        "enrichment-plant": 0.75,
        "enrichment-plant-uranium": 0.225,
        "chemical-plant-blanket-enriched": 1.2,
      },
      pinned: fuelPinned,
      externalInputs: ext({ acid: 0.75, moltenGlass: 0.75, steel: 0.375, salt: 4.8, depletedUranium: 12 }),
    },
    {
      id: "1+1-spent-fuel",
      name: "1+1 Spent Fuel",
      description: "75 MW — zero UO, 10 DU/60s, +0.5 EU20/60s, burns SF",
      buildingTotals: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1, "enrichment-plant-uranium": 1,
        "chemical-plant-blanket-enriched": 1,
        "nuclear-reprocessing-spent-fuel": 1,
        ...steam1x1,
      },
      active: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 0.375,
        "enrichment-plant": 0.75,
        "enrichment-plant-uranium": 0.25,
        "chemical-plant-blanket-enriched": 1,
        "nuclear-reprocessing-spent-fuel": 0.25,
      },
      pinned: fuelPinned,
      externalInputs: ext({ acid: 1.25, moltenGlass: 1.25, steel: 0.375, salt: 4.5, depletedUranium: 10, spentFuel: 0.5 }),
    },
    {
      id: "1+1-spent-mox",
      name: "1+1 Spent MOX",
      description: "37.5 MW — zero UO, 10 DU/60s, +0.5 EU20/60s, burns SM, H2 idle",
      buildingTotals: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1, "enrichment-plant-uranium": 1,
        "chemical-plant-blanket-enriched": 1,
        "nuclear-reprocessing-spent-mox": 1,
        ...steam1x1,
      },
      active: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 0.375,
        "enrichment-plant": 0.75,
        "enrichment-plant-uranium": 0.25,
        "chemical-plant-blanket-enriched": 1,
        "turbine-super": 1,
        "turbine-high": 1,
        "turbine-low": 1,
        "hydrogen-reformer-super": 0,
        "nuclear-reprocessing-spent-mox": 0.25,
      },
      pinned: fuelPinned,
      externalInputs: ext({ acid: 1.25, moltenGlass: 1.25, steel: 0.375, salt: 4.5, depletedUranium: 10, spentMox: 0.5 }),
    },
    {
      id: "1+4-steady",
      name: "1+4 Steady State",
      description: "255 MW — 54 UO, no DU needed",
      buildingTotals: {
        "fbr-3x": 1, "fbr-0x": 4,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 2,
        "chemical-plant-yellowcake": 1,
        ...steam1x4,
      },
      active: {
        "fbr-3x": 1, "fbr-0x": 4,
        "nuclear-reprocessing": 0.75,
        "enrichment-plant": 1.5,
        "chemical-plant-yellowcake": 0.75,
      },
      pinned: fuelPinned,
      externalInputs: ext({ acid: 1.5, moltenGlass: 1.5, steel: 0.75, salt: 3, yellowcake: 9 }),
    },
  ],
  defaultPresetId: "1+1-burn-du",
};
