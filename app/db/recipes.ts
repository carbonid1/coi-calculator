import { type ResourceId } from "./resources";

export type Ingredient = {
  resourceId: ResourceId;
  quantity: number; // per 60 seconds
};

export type RecipeGroup = "source" | "electricity" | "production" | "sink";

export type Recipe = {
  id: string;
  name: string;
  building: string;
  group: RecipeGroup;
  inputs: Ingredient[];
  outputs: Ingredient[];
};

export const recipes: Recipe[] = [
  // Sources
  {
    id: "seawater-pump",
    name: "Seawater Pump (Fast)",
    building: "Seawater Pump",
    group: "source",
    inputs: [],
    outputs: [
      { resourceId: "seaWater", quantity: 216 },
    ],
  },

  // Electricity
  {
    id: "fbr",
    name: "Fast Breeder Reactor",
    building: "Fast Breeder Reactor",
    group: "electricity",
    inputs: [
      { resourceId: "water", quantity: 96 },
      { resourceId: "coreFuel", quantity: 4 },
      { resourceId: "blanketFuel", quantity: 4 },
    ],
    outputs: [
      { resourceId: "steamSuper", quantity: 96 },
      { resourceId: "coreFuelSpent", quantity: 4 },
      { resourceId: "blanketFuelEnriched", quantity: 4 },
    ],
  },
  {
    id: "fbr-0x",
    name: "FBR (0x Enrichment)",
    building: "Fast Breeder Reactor",
    group: "electricity",
    inputs: [
      { resourceId: "water", quantity: 96 },
      { resourceId: "coreFuel", quantity: 2 },
    ],
    outputs: [
      { resourceId: "steamSuper", quantity: 96 },
      { resourceId: "coreFuelSpent", quantity: 2 },
    ],
  },
  {
    id: "fbr-3x",
    name: "FBR (3x Enrichment)",
    building: "Fast Breeder Reactor",
    group: "electricity",
    inputs: [
      { resourceId: "water", quantity: 24 },
      { resourceId: "coreFuel", quantity: 4 },
      { resourceId: "blanketFuel", quantity: 12 },
    ],
    outputs: [
      { resourceId: "steamSuper", quantity: 24 },
      { resourceId: "coreFuelSpent", quantity: 4 },
      { resourceId: "blanketFuelEnriched", quantity: 12 },
    ],
  },
  {
    id: "turbine-super",
    name: "Super-Pressure Turbine",
    building: "Super-Pressure Turbine",
    group: "electricity",
    inputs: [
      { resourceId: "steamSuper", quantity: 48 },
    ],
    outputs: [
      { resourceId: "steamHigh", quantity: 48 },
      { resourceId: "electricity", quantity: 15 },
    ],
  },
  {
    id: "turbine-high",
    name: "High-Pressure Turbine II",
    building: "High-Pressure Turbine II",
    group: "electricity",
    inputs: [
      { resourceId: "steamHigh", quantity: 48 },
    ],
    outputs: [
      { resourceId: "steamLow", quantity: 48 },
      { resourceId: "electricity", quantity: 10 },
    ],
  },
  {
    id: "turbine-low",
    name: "Low-Pressure Turbine II",
    building: "Low-Pressure Turbine II",
    group: "electricity",
    inputs: [
      { resourceId: "steamLow", quantity: 48 },
    ],
    outputs: [
      { resourceId: "steamDepleted", quantity: 48 },
      { resourceId: "electricity", quantity: 5 },
    ],
  },

  // Production (order = priority)

  // Nuclear fuel cycle
  {
    id: "chemical-plant-uranium",
    name: "Chemical Plant (Uranium → Core Fuel)",
    building: "Chemical Plant II",
    group: "production",
    inputs: [
      { resourceId: "enrichedUranium20", quantity: 2 },
      { resourceId: "salt", quantity: 4 },
    ],
    outputs: [
      { resourceId: "coreFuel", quantity: 4 },
    ],
  },
  {
    id: "chemical-plant-plutonium",
    name: "Chemical Plant (Plutonium → Core Fuel)",
    building: "Chemical Plant II",
    group: "production",
    inputs: [
      { resourceId: "plutonium", quantity: 1 },
      { resourceId: "salt", quantity: 4 },
    ],
    outputs: [
      { resourceId: "coreFuel", quantity: 4 },
    ],
  },
  {
    id: "nuclear-reprocessing",
    name: "Nuclear Reprocessing (Core Fuel Spent)",
    building: "Nuclear Reprocessing Plant",
    group: "production",
    inputs: [
      { resourceId: "coreFuelSpent", quantity: 16 },
      { resourceId: "acid", quantity: 2 },
      { resourceId: "moltenGlass", quantity: 2 },
      { resourceId: "steel", quantity: 1 },
    ],
    outputs: [
      { resourceId: "coreFuel", quantity: 12 },
      { resourceId: "fissionProduct", quantity: 2 },
    ],
  },
  {
    id: "enrichment-plant",
    name: "Enrichment Plant (Core Fuel)",
    building: "Enrichment Plant",
    group: "production",
    inputs: [
      { resourceId: "blanketFuelEnriched", quantity: 8 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 6 },
      { resourceId: "coreFuel", quantity: 2 },
    ],
  },
  {
    id: "enrichment-plant-plutonium",
    name: "Enrichment Plant (Plutonium)",
    building: "Enrichment Plant",
    group: "production",
    inputs: [
      { resourceId: "blanketFuelEnriched", quantity: 16 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 12 },
      { resourceId: "plutonium", quantity: 1 },
    ],
  },
  {
    id: "enrichment-plant-uranium",
    name: "Enrichment Plant (Enriched Uranium)",
    building: "Enrichment Plant",
    group: "production",
    inputs: [
      { resourceId: "blanketFuelEnriched", quantity: 16 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 12 },
      { resourceId: "enrichedUranium20", quantity: 2 },
    ],
  },
  {
    id: "chemical-plant-enrichment",
    name: "Chemical Plant (Plutonium → Enriched Uranium 20%)",
    building: "Chemical Plant",
    group: "production",
    inputs: [
      { resourceId: "plutonium", quantity: 3 },
      { resourceId: "enrichedUranium4", quantity: 3 },
    ],
    outputs: [
      { resourceId: "enrichedUranium20", quantity: 3 },
    ],
  },
  {
    id: "assembly-v-compact-reactor",
    name: "Assembly V (Compact Reactor)",
    building: "Assembly V",
    group: "production",
    inputs: [
      { resourceId: "titaniumAlloy", quantity: 12 },
      { resourceId: "electronicsIv", quantity: 6 },
      { resourceId: "enrichedUranium20", quantity: 2 },
    ],
    outputs: [
      { resourceId: "compactReactor", quantity: 4 },
    ],
  },
  {
    id: "chemical-plant-mox-rod",
    name: "Chemical Plant (Plutonium → MOX Rod)",
    building: "Chemical Plant II",
    group: "production",
    inputs: [
      { resourceId: "plutonium", quantity: 1 },
      { resourceId: "depletedUranium", quantity: 4 },
    ],
    outputs: [
      { resourceId: "moxRod", quantity: 2 },
    ],
  },
  {
    id: "chemical-plant-blanket-enriched",
    name: "Chemical Plant (Enriched → Blanket Fuel)",
    building: "Chemical Plant II",
    group: "production",
    inputs: [
      { resourceId: "blanketFuelEnriched", quantity: 2 },
      { resourceId: "depletedUranium", quantity: 10 },
      { resourceId: "salt", quantity: 4 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 4 },
    ],
  },
  {
    id: "chemical-plant-yellowcake",
    name: "Chemical Plant (Yellowcake → Blanket Fuel)",
    building: "Chemical Plant II",
    group: "production",
    inputs: [
      { resourceId: "yellowcake", quantity: 12 },
      { resourceId: "salt", quantity: 4 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 4 },
    ],
  },
  {
    id: "nuclear-reprocessing-spent-fuel",
    name: "Nuclear Reprocessing (Spent Fuel)",
    building: "Nuclear Reprocessing Plant",
    group: "production",
    inputs: [
      { resourceId: "spentFuel", quantity: 2 },
      { resourceId: "acid", quantity: 2 },
      { resourceId: "moltenGlass", quantity: 2 },
      { resourceId: "salt", quantity: 2 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 2 },
      { resourceId: "fissionProduct", quantity: 2 },
    ],
  },
  {
    id: "nuclear-reprocessing-spent-mox",
    name: "Nuclear Reprocessing (Spent MOX)",
    building: "Nuclear Reprocessing Plant",
    group: "production",
    inputs: [
      { resourceId: "spentMox", quantity: 2 },
      { resourceId: "acid", quantity: 2 },
      { resourceId: "moltenGlass", quantity: 2 },
      { resourceId: "salt", quantity: 2 },
    ],
    outputs: [
      { resourceId: "blanketFuel", quantity: 2 },
      { resourceId: "fissionProduct", quantity: 2 },
    ],
  },

  // Uranium processing
  {
    id: "crusher",
    name: "Crusher (Uranium Ore)",
    building: "Crusher",
    group: "production",
    inputs: [
      { resourceId: "uraniumOre", quantity: 12 },
    ],
    outputs: [
      { resourceId: "uraniumOrePowder", quantity: 12 },
    ],
  },
  {
    id: "settling-tank",
    name: "Settling Tank (Yellowcake)",
    building: "Settling Tank",
    group: "production",
    inputs: [
      { resourceId: "uraniumOrePowder", quantity: 36 },
      { resourceId: "acid", quantity: 12 },
    ],
    outputs: [
      { resourceId: "yellowcake", quantity: 6 },
      { resourceId: "toxicSlurry", quantity: 36 },
    ],
  },
  {
    id: "enrichment-plant-eu4",
    name: "Enrichment Plant (Yellowcake → EU4)",
    building: "Enrichment Plant",
    group: "production",
    inputs: [
      { resourceId: "yellowcake", quantity: 3 },
      { resourceId: "hydrogenFluoride", quantity: 1 },
    ],
    outputs: [
      { resourceId: "enrichedUranium4", quantity: 0.5 },
      { resourceId: "depletedUranium", quantity: 2.5 },
    ],
  },
  {
    id: "enrichment-plant-eu20",
    name: "Enrichment Plant (EU4 → EU20)",
    building: "Enrichment Plant",
    group: "production",
    inputs: [
      { resourceId: "enrichedUranium4", quantity: 2.5 },
      { resourceId: "hydrogenFluoride", quantity: 1 },
    ],
    outputs: [
      { resourceId: "enrichedUranium20", quantity: 0.5 },
      { resourceId: "depletedUranium", quantity: 2 },
    ],
  },

  // Water & hydrogen
  {
    id: "hydrogen-reformer-super",
    name: "Hydrogen Reformer (Super Steam)",
    building: "Hydrogen Reformer",
    group: "production",
    inputs: [
      { resourceId: "water", quantity: 16 },
      { resourceId: "steamSuper", quantity: 12 },
    ],
    outputs: [
      { resourceId: "hydrogen", quantity: 32 },
      { resourceId: "oxygen", quantity: 32 },
      { resourceId: "steamDepleted", quantity: 12 },
    ],
  },
  {
    id: "thermal-desalinator-depleted",
    name: "Thermal Desalinator (Depleted Steam)",
    building: "Thermal Desalinator",
    group: "production",
    inputs: [
      { resourceId: "seaWater", quantity: 15 },
      { resourceId: "steamDepleted", quantity: 24 },
    ],
    outputs: [
      { resourceId: "water", quantity: 33 },
      { resourceId: "brine", quantity: 6 },
    ],
  },
  {
    id: "thermal-desalinator-super",
    name: "Thermal Desalinator (Super Steam)",
    building: "Thermal Desalinator",
    group: "production",
    inputs: [
      { resourceId: "seaWater", quantity: 108 },
      { resourceId: "steamSuper", quantity: 6 },
    ],
    outputs: [
      { resourceId: "water", quantity: 72 },
      { resourceId: "brine", quantity: 42 },
    ],
  },

  // Sinks
  {
    id: "cooling-tower-large-depleted",
    name: "Cooling Tower Large (Depleted)",
    building: "Cooling Tower (Large)",
    group: "sink",
    inputs: [
      { resourceId: "steamDepleted", quantity: 96 },
    ],
    outputs: [
      { resourceId: "water", quantity: 72 },
    ],
  },
  {
    id: "cooling-tower-large-super",
    name: "Cooling Tower Large (Super)",
    building: "Cooling Tower (Large)",
    group: "sink",
    inputs: [
      { resourceId: "steamSuper", quantity: 96 },
    ],
    outputs: [
      { resourceId: "water", quantity: 60 },
    ],
  },
];
