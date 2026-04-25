import { type ResourceId } from "../resources";
import { type Module } from "./modules";

const ext = (vals: Partial<Record<ResourceId, number>>): Partial<Record<ResourceId, number>> => vals;

// Non-fuel buildings are identical across every preset so the physical plant
// never needs reworking. Steam / water / hydrogen infrastructure is sized for
// the 1+1 DU case; in YC modes the surplus gets absorbed by cooling + desal +
// reformer by priority.
const plantInfra = {
  "seawater-pump": 4,
  "turbine-super": 2,
  "turbine-high": 2,
  "turbine-low": 2,
  "thermal-desalinator-depleted": 2,
  "thermal-desalinator-super": 6,
  "hydrogen-reformer-super": 2,
  "cooling-tower-large-depleted": 1,
  "cooling-tower-large-super": 1,
};

const fuelPinnedDu = [
  "fbr-3x", "fbr-0x",
  "nuclear-reprocessing", "enrichment-plant", "enrichment-plant-uranium",
  "chemical-plant-blanket-enriched",
];

const fuelPinnedYc = ["fbr"];

export const fbrPowerPlant: Module = {
  id: "fbr-power-plant",
  name: "FBR Power Plant",
  description: "1+1 DU burn and YC-only no-breed modes — shared plant infrastructure",
  buildingTotals: {}, // presets define their own
  presets: [
    {
      id: "1+1-burn-du",
      name: "1+1 Burn DU",
      description: "75 MW — 0 UO, 12 DU/60s, +0.45 EU20/60s",
      buildingTotals: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1, "enrichment-plant-uranium": 1,
        "chemical-plant-blanket-enriched": 2,
        ...plantInfra,
      },
      active: {
        "fbr-3x": 1, "fbr-0x": 1,
        "nuclear-reprocessing": 0.375,
        "enrichment-plant": 0.75,
        "enrichment-plant-uranium": 0.225,
        "chemical-plant-blanket-enriched": 1.2,
      },
      pinned: fuelPinnedDu,
      externalInputs: ext({ acid: 0.75, moltenGlass: 0.75, steel: 0.375, salt: 4.8, depletedUranium: 12 }),
    },
    {
      id: "1fbr-yc",
      name: "1 FBR ×2 — YC, no breed",
      description: "60 MW + 64 H₂ — 6 YC/60s (36 UO), reactor speed 2x, 1x operating mode, no EU20, no DU",
      buildingTotals: {
        "fbr": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1,
        "chemical-plant-yellowcake": 1,
        ...plantInfra,
      },
      active: {
        "fbr": 1,
        "nuclear-reprocessing": 1,
        "enrichment-plant": 1,
        "chemical-plant-yellowcake": 1,
      },
      speedLevels: { "fbr": 2 },
      pinned: fuelPinnedYc,
      externalInputs: ext({ acid: 1, moltenGlass: 1, steel: 0.5, salt: 2, yellowcake: 6 }),
    },
  ],
  defaultPresetId: "1+1-burn-du",
};
