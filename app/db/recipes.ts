import { chickenFarm } from "./chicken-farm";
import { activeHousingType } from "./housing";
import { type ResourceId } from "./resources";
import {
  calculateSettlementPopulationFlows,
  settlementRecipeIds,
} from "./settlement";
import { solarPanels } from "./solar";

export interface Ingredient {
  resourceId: ResourceId;
  quantity: number; // per 60 seconds
  outputModifierId?: OutputModifierId;
}

export type RecipeGroup = "source" | "electricity" | "production" | "waste" | "sink";
export type OutputModifierId = "maintenanceOutput" | "solarPower";
export type BalanceBy = "input" | "output";
export type SharedCapacityAllocation = "primary" | "fallback";
export type SourceKind = "map-mine" | "world-mine";

export interface SharedCapacity {
  /** Recipes with the same ID share one installed building pool inside a module. */
  id: string;
  /** Optional UI label for distinguishing separate pools of the same building type. */
  label?: string;
  /** Optional UI order; larger values render later than ordinary production cards. */
  displayOrder?: number;
  /** Lower values are allocated first, matching the in-game recipe order. */
  priority: number;
  /** Fallback recipes receive only capacity left after primary recipes. */
  allocation?: SharedCapacityAllocation;
}

export interface DecayStorage {
  capacity: number;
  decayCycles: number;
}

export interface Recipe {
  id: string;
  name: string;
  building: string;
  group: RecipeGroup;
  inputs: Ingredient[];
  outputs: Ingredient[];
  decayStorage?: DecayStorage;
  /** The resource side that determines utilization when this recipe is not fixed by its preset. */
  balanceBy?: BalanceBy;
  /** Inputs that cap utilization; input-balanced recipes default to every input. */
  balanceInputIds?: ResourceId[];
  /** Outputs that create demand for an output-balanced recipe; defaults to every output. */
  balanceOutputIds?: ResourceId[];
  sharedCapacity?: SharedCapacity;
  cycleDurationSeconds?: number;
  /**
   * Whether creating Recyclables applies the global recycling-efficiency loss.
   * Defaults to true. Captain of Industry v0.8.6 bypasses it for Shredder;
   * settlement collection uses its own source-to-Recyclables conversion.
   */
  appliesRecyclingEfficiency?: boolean;
  /** Emits the recoverable material composition carried by Recyclables. */
  sortsRecyclableSources?: boolean;
  /** Demand sources ignore declared capacity and supply only the remaining deficit. */
  sourceMode?: "demand";
  sourceKind?: SourceKind;
  /** Recipe-specific multiplier applied to the building's base electricity draw. */
  electricityMultiplier?: number;
  /** Generators in one group share utilization; lower priorities serve demand first. */
  electricityDispatch?: {
    groupId: string;
    priority: number;
  };
  /** Displays fractional throughput as a livestock count instead of a generic speed. */
  animalPopulationCapacity?: number;
}

const radioactiveWasteStorageCapacity = 2400;
const fissionProductDecayCycles = 100 * 12;
const radioactiveWasteStorageThroughput = radioactiveWasteStorageCapacity / fissionProductDecayCycles;
const housingIIPopulationFlows = calculateSettlementPopulationFlows(
  activeHousingType.populationCapacity,
);

export const recipes: Recipe[] = [
  // Sources
  {
    id: "seawater-pump",
    name: "Seawater Pump (Fast)",
    building: "Seawater Pump",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "seaWater", quantity: 216 }],
  },
  {
    id: "copper-map-mine",
    name: "Copper Ore (Map Mine)",
    building: "Copper Ore Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "copperOre", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "map-mine",
  },
  {
    id: "iron-map-mine",
    name: "Iron Ore (Map Mine)",
    building: "Iron Ore Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "ironOre", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "map-mine",
  },
  {
    id: "limestone-map-mine",
    name: "Limestone (Map Mine)",
    building: "Limestone Mine",
    group: "source",
    inputs: [],
    outputs: [
      { resourceId: "limestone", quantity: 0 },
    ],
    sourceMode: "demand",
    sourceKind: "map-mine",
  },
  {
    id: "sulfur-world-mine",
    name: "Sulfur (World Mine)",
    building: "Sulfur World Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "sulfur", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "world-mine",
  },
  {
    id: "gold-map-mine",
    name: "Gold Ore (Map Mine)",
    building: "Gold Ore Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "goldOre", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "map-mine",
  },
  {
    id: "sand-map-mine",
    name: "Sand (Map Mine)",
    building: "Sand Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "sand", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "map-mine",
  },
  {
    id: "rock-map-mine",
    name: "Rock (Map Mine)",
    building: "Rock Mine",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "rock", quantity: 0 }],
    sourceMode: "demand",
    sourceKind: "map-mine",
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
    inputs: [{ resourceId: "steamSuper", quantity: 48 }],
    outputs: [
      { resourceId: "steamHigh", quantity: 48 },
      { resourceId: "electricity", quantity: 15 },
    ],
    electricityDispatch: { groupId: "fbr-turbines", priority: 2 },
  },
  {
    id: "turbine-high",
    name: "High-Pressure Turbine II",
    building: "High-Pressure Turbine II",
    group: "electricity",
    inputs: [{ resourceId: "steamHigh", quantity: 48 }],
    outputs: [
      { resourceId: "steamLow", quantity: 48 },
      { resourceId: "electricity", quantity: 10 },
    ],
    electricityDispatch: { groupId: "fbr-turbines", priority: 2 },
  },
  {
    id: "turbine-low",
    name: "Low-Pressure Turbine II",
    building: "Low-Pressure Turbine II",
    group: "electricity",
    inputs: [{ resourceId: "steamLow", quantity: 48 }],
    outputs: [
      { resourceId: "steamDepleted", quantity: 48 },
      { resourceId: "electricity", quantity: 5 },
    ],
    electricityDispatch: { groupId: "fbr-turbines", priority: 2 },
  },
  {
    id: solarPanels.standard.recipeId,
    name: solarPanels.standard.name,
    building: solarPanels.standard.building,
    group: "electricity",
    inputs: [],
    outputs: [
      {
        resourceId: "electricity",
        quantity: solarPanels.standard.sunnyOutputKw / 1000,
        outputModifierId: "solarPower",
      },
    ],
    electricityDispatch: { groupId: "solar", priority: 1 },
  },
  {
    id: solarPanels.mono.recipeId,
    name: solarPanels.mono.name,
    building: solarPanels.mono.building,
    group: "electricity",
    inputs: [],
    outputs: [
      {
        resourceId: "electricity",
        quantity: solarPanels.mono.sunnyOutputKw / 1000,
        outputModifierId: "solarPower",
      },
    ],
    electricityDispatch: { groupId: "solar", priority: 1 },
  },

  // Production (order = priority)

  // Settlement demand at full Housing II population capacity
  {
    id: settlementRecipeIds.residents,
    name: "Housing II Residents",
    building: "Housing II",
    group: "production",
    inputs: housingIIPopulationFlows.inputs,
    outputs: housingIIPopulationFlows.outputs,
    // v0.8.6 settlement collection converts tracked recyclable sources with
    // its own 2:1 rule; the global recycling modifier is not applied here.
    appliesRecyclingEfficiency: false,
  },
  {
    id: settlementRecipeIds.foodMarket,
    name: "Food Market",
    building: "Food Market",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.foodMarketII,
    name: "Food Market II",
    building: "Food Market II",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.transformer,
    name: "Transformer",
    building: "Transformer",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.waterFacility,
    name: "Water Facility",
    building: "Water Facility",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.wasteCollection,
    name: "Waste Collection",
    building: "Waste Collection",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.recyclablesCollection,
    name: "Recyclables Collection",
    building: "Recyclables Collection",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.biomassCollection,
    name: "Biomass Collection",
    building: "Biomass Collection",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.clinic,
    name: "Clinic I",
    building: "Clinic I",
    group: "production",
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.wastewaterTreatment,
    name: "Wastewater Treatment (Filter Media)",
    building: "Wastewater Treatment",
    group: "production",
    cycleDurationSeconds: 30,
    balanceBy: "input",
    balanceInputIds: ["wasteWater"],
    inputs: [
      { resourceId: "wasteWater", quantity: 160 },
      { resourceId: "filterMedia", quantity: 8 },
      { resourceId: "chlorine", quantity: 16 },
    ],
    outputs: [
      { resourceId: "water", quantity: 120 },
      { resourceId: "sludge", quantity: 36 },
    ],
  },
  {
    id: settlementRecipeIds.anaerobicDigester,
    name: "Anaerobic Digester (Sludge)",
    building: "Anaerobic Digester",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "input",
    balanceInputIds: ["sludge"],
    inputs: [{ resourceId: "sludge", quantity: 18 }],
    outputs: [
      { resourceId: "fuelGas", quantity: 8 },
      { resourceId: "compost", quantity: 3 },
    ],
  },
  {
    id: settlementRecipeIds.biomassCompostMixer,
    name: "Mixer II (Biomass → Compost)",
    building: "Mixer II",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "input",
    balanceInputIds: ["biomass"],
    inputs: [{ resourceId: "biomass", quantity: 24 }],
    outputs: [{ resourceId: "compost", quantity: 16 }],
  },

  // Settlement food. Each recipe uses its own dedicated building installation.
  {
    id: "mill-wheat",
    name: "Mill (Wheat)",
    building: "Mill",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    balanceOutputIds: ["flour"],
    inputs: [{ resourceId: "wheat", quantity: 16 }],
    outputs: [
      { resourceId: "flour", quantity: 16 },
      { resourceId: "animalFeed", quantity: 2 },
    ],
  },
  {
    id: "mill-canola-cooking-oil",
    name: "Mill (Canola → Cooking Oil)",
    building: "Mill",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    balanceOutputIds: ["cookingOil"],
    inputs: [{ resourceId: "canola", quantity: 16 }],
    outputs: [
      { resourceId: "cookingOil", quantity: 12 },
      { resourceId: "animalFeed", quantity: 4 },
    ],
  },
  {
    id: "baking-unit-bread",
    name: "Baking Unit (Bread)",
    building: "Baking Unit",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    inputs: [
      { resourceId: "flour", quantity: 16 },
      { resourceId: "water", quantity: 8 },
    ],
    outputs: [{ resourceId: "bread", quantity: 24 }],
  },
  {
    id: "baking-unit-cake",
    name: "Baking Unit (Cake)",
    building: "Baking Unit",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    inputs: [
      { resourceId: "flour", quantity: 10 },
      { resourceId: "sugar", quantity: 4 },
      { resourceId: "cookingOil", quantity: 2 },
      { resourceId: "eggs", quantity: 2 },
      { resourceId: "fruit", quantity: 2 },
    ],
    outputs: [{ resourceId: "cake", quantity: 14 }],
  },
  {
    id: "food-processor-snack",
    name: "Food Processor (Snack)",
    building: "Food Processor",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    balanceOutputIds: ["snack"],
    inputs: [
      { resourceId: "corn", quantity: 24 },
      { resourceId: "sugar", quantity: 6 },
      { resourceId: "cookingOil", quantity: 3 },
      { resourceId: "salt", quantity: 3 },
    ],
    outputs: [
      { resourceId: "snack", quantity: 24 },
      { resourceId: "biomass", quantity: 3 },
    ],
  },
  {
    id: "food-processor-sugar",
    name: "Food Processor (Sugar)",
    building: "Food Processor",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    balanceOutputIds: ["sugar"],
    inputs: [
      { resourceId: "sugarCane", quantity: 15 },
      { resourceId: "water", quantity: 3 },
    ],
    outputs: [
      { resourceId: "sugar", quantity: 12 },
      { resourceId: "biomass", quantity: 6 },
    ],
  },
  {
    id: "mixer-ii-animal-feed-corn",
    name: "Mixer II (Animal Feed)",
    building: "Mixer II",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    inputs: [{ resourceId: "corn", quantity: 120 }],
    outputs: [{ resourceId: "animalFeed", quantity: 144 }],
  },
  {
    id: "mixer-ii-biomass-compost",
    name: "Mixer II (Biomass → Compost)",
    building: "Mixer II",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "input",
    // This second installation consumes only factory-wide Biomass left after
    // primary consumers, including byproducts created by General food recipes.
    sharedCapacity: {
      id: "mixer-ii-biomass-compost-general",
      priority: 1,
      allocation: "fallback",
    },
    inputs: [{ resourceId: "biomass", quantity: 24 }],
    outputs: [{ resourceId: "compost", quantity: 16 }],
  },

  // Medical Supplies I. These are the complete single-recipe steps in v0.8.6;
  // Steel, Plastic, and Ethanol each have multiple production paths.
  {
    id: "assembly-v-medical-supplies-i",
    name: "Assembly V (Medical Supplies I)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "medicalEquipment", quantity: 48 },
      { resourceId: "disinfectant", quantity: 48 },
    ],
    outputs: [{ resourceId: "medicalSupplies", quantity: 96 }],
  },
  {
    id: "assembly-v-medical-equipment",
    name: "Assembly V (Medical Equipment)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "steel", quantity: 24 },
      { resourceId: "plastic", quantity: 24 },
    ],
    outputs: [{ resourceId: "medicalEquipment", quantity: 24 }],
  },
  {
    id: "chemical-plant-ii-disinfectant",
    name: "Chemical Plant II (Disinfectant)",
    building: "Chemical Plant II",
    group: "production",
    cycleDurationSeconds: 40,
    balanceBy: "output",
    inputs: [
      { resourceId: "ethanol", quantity: 4.5 },
      { resourceId: "plastic", quantity: 3 },
    ],
    outputs: [{ resourceId: "disinfectant", quantity: 12 }],
  },

  // Population wastewater support. The selected Filter Media path uses
  // Manufactured Sand; Chlorine comes from Brine electrolysis.
  {
    id: "mixer-ii-filter-media-manufactured-sand",
    name: "Mixer II (Filter Media)",
    building: "Mixer II",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "gravel", quantity: 48 },
      { resourceId: "manufacturedSand", quantity: 24 },
      { resourceId: "coal", quantity: 6 },
    ],
    outputs: [{ resourceId: "filterMedia", quantity: 72 }],
  },
  {
    id: "crusher-large-rock-to-gravel",
    name: "Rock → Gravel",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    inputs: [{ resourceId: "rock", quantity: 144 }],
    outputs: [{ resourceId: "gravel", quantity: 144 }],
  },
  {
    id: "crusher-large-gravel-to-manufactured-sand",
    name: "Gravel → Manufactured Sand",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 60,
    balanceBy: "output",
    inputs: [{ resourceId: "gravel", quantity: 48 }],
    outputs: [{ resourceId: "manufacturedSand", quantity: 48 }],
  },
  {
    id: "coal-maker-wood",
    name: "Coal Maker (Wood)",
    building: "Coal Maker",
    group: "production",
    cycleDurationSeconds: 40,
    balanceBy: "output",
    inputs: [{ resourceId: "wood", quantity: 18 }],
    outputs: [
      { resourceId: "coal", quantity: 7.5 },
      { resourceId: "exhaust", quantity: 6 },
    ],
    balanceOutputIds: ["coal"],
  },
  {
    id: "electrolyzer-ii-chlorine",
    name: "Electrolyzer II (Chlorine)",
    building: "Electrolyzer II",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [{ resourceId: "brine", quantity: 72 }],
    outputs: [{ resourceId: "chlorine", quantity: 48 }],
  },

  // Livestock and food processing
  {
    id: "chicken-farm-slaughtering",
    name: "Chicken Farm (Slaughtering on)",
    building: "Chicken Farm",
    group: "production",
    inputs: [
      {
        resourceId: "animalFeed",
        quantity: chickenFarm.capacity * chickenFarm.feedPerChicken,
      },
      {
        resourceId: "water",
        quantity: chickenFarm.capacity * chickenFarm.waterPerChicken,
      },
    ],
    outputs: [
      {
        resourceId: "eggs",
        quantity: chickenFarm.capacity * chickenFarm.eggsPerChicken,
      },
      {
        resourceId: "chickenCarcass",
        quantity:
          ((chickenFarm.capacity * chickenFarm.birthsPer100Chickens) / 100) *
          chickenFarm.carcassPerSlaughteredChicken,
      },
    ],
    animalPopulationCapacity: chickenFarm.capacity,
  },
  {
    id: "chicken-farm-eggs-only",
    name: "Chicken Farm (Slaughtering off)",
    building: "Chicken Farm",
    group: "production",
    inputs: [
      {
        resourceId: "animalFeed",
        quantity: chickenFarm.capacity * chickenFarm.feedPerChicken,
      },
      {
        resourceId: "water",
        quantity: chickenFarm.capacity * chickenFarm.waterPerChicken,
      },
    ],
    outputs: [
      {
        resourceId: "eggs",
        quantity: chickenFarm.capacity * chickenFarm.eggsPerChicken,
      },
    ],
    animalPopulationCapacity: chickenFarm.capacity,
  },
  {
    id: "food-processor-meat",
    name: "Food Processor (Chicken Carcass → Meat)",
    building: "Food Processor",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "input",
    balanceInputIds: ["chickenCarcass"],
    inputs: [
      { resourceId: "chickenCarcass", quantity: 30 },
      { resourceId: "water", quantity: 9 },
      { resourceId: "salt", quantity: 3 },
    ],
    outputs: [
      { resourceId: "meat", quantity: 15 },
      { resourceId: "meatTrimmings", quantity: 6 },
    ],
  },

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
    outputs: [{ resourceId: "coreFuel", quantity: 4 }],
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
    outputs: [{ resourceId: "coreFuel", quantity: 4 }],
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
    inputs: [{ resourceId: "blanketFuelEnriched", quantity: 8 }],
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
    inputs: [{ resourceId: "blanketFuelEnriched", quantity: 16 }],
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
    inputs: [{ resourceId: "blanketFuelEnriched", quantity: 16 }],
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
    outputs: [{ resourceId: "enrichedUranium20", quantity: 3 }],
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
    outputs: [{ resourceId: "compactReactor", quantity: 4 }],
  },

  // Electronics chains
  {
    id: "assembly-v-electronics-i",
    name: "Assembly V (Electronics I)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 15,
    balanceBy: "output",
    inputs: [
      { resourceId: "rubber", quantity: 16 },
      { resourceId: "copper", quantity: 96 },
    ],
    outputs: [{ resourceId: "electronicsI", quantity: 96 }],
  },
  {
    id: "assembly-v-electronics-ii",
    name: "Assembly V (Electronics II)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "pcb", quantity: 24 },
      { resourceId: "electronicsI", quantity: 48 },
      { resourceId: "polySilicon", quantity: 12 },
    ],
    outputs: [{ resourceId: "electronicsII", quantity: 24 }],
  },
  {
    id: "assembly-v-pcb",
    name: "Assembly V (PCB)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "glass", quantity: 12 },
      { resourceId: "plastic", quantity: 24 },
      { resourceId: "copper", quantity: 12 },
    ],
    outputs: [{ resourceId: "pcb", quantity: 48 }],
  },
  {
    id: "assembly-v-food-pack-eggs",
    name: "Assembly V (Eggs + Bread)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 7.5,
    balanceBy: "output",
    balanceInputIds: ["eggs"],
    balanceOutputIds: ["foodPack"],
    sharedCapacity: {
      id: "assembly-v-food-pack",
      label: "Assembly V — Food Pack",
      priority: 1,
    },
    inputs: [
      { resourceId: "eggs", quantity: 24 },
      { resourceId: "bread", quantity: 48 },
    ],
    outputs: [{ resourceId: "foodPack", quantity: 32 }],
  },
  {
    id: "assembly-v-food-pack-meat",
    name: "Assembly V (Meat + Bread)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 7.5,
    balanceBy: "output",
    balanceInputIds: ["meat"],
    balanceOutputIds: ["foodPack"],
    sharedCapacity: {
      id: "assembly-v-food-pack",
      label: "Assembly V — Food Pack",
      priority: 2,
    },
    inputs: [
      { resourceId: "meat", quantity: 24 },
      { resourceId: "bread", quantity: 48 },
    ],
    outputs: [{ resourceId: "foodPack", quantity: 32 }],
  },
  {
    id: "silicon-reactor-poly-silicon",
    name: "Silicon Reactor (Poly Silicon)",
    building: "Silicon Reactor",
    group: "production",
    cycleDurationSeconds: 15,
    balanceBy: "output",
    inputs: [
      { resourceId: "moltenSilicon", quantity: 12 },
      { resourceId: "hydrogen", quantity: 4 },
    ],
    outputs: [{ resourceId: "polySilicon", quantity: 12 }],
  },
  {
    id: "crystallizer-silicon-wafer",
    name: "Crystallizer (Silicon Wafer)",
    building: "Crystallizer",
    group: "production",
    cycleDurationSeconds: 30,
    balanceBy: "output",
    inputs: [
      { resourceId: "polySilicon", quantity: 24 },
      { resourceId: "water", quantity: 4 },
    ],
    outputs: [{ resourceId: "siliconWafer", quantity: 12 }],
  },
  {
    id: "microchip-machine-ii-1a",
    name: "Microchip Machine II (1A: Acid + water)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-a",
      label: "Microchip Machine II — Stage A",
      priority: 1,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: "siliconWafer", quantity: 18 },
      { resourceId: "acid", quantity: 6 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage1A", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-1b",
    name: "Microchip Machine II (1B: Copper + plastic)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-b",
      label: "Microchip Machine II — Stage B",
      priority: 1,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: "microchipStage1A", quantity: 18 },
      { resourceId: "copper", quantity: 6 },
      { resourceId: "plastic", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage1B", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-1c",
    name: "Microchip Machine II (1C: Gold)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-c",
      label: "Microchip Machine II — Stage C",
      priority: 1,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: "microchipStage1B", quantity: 18 },
      { resourceId: "gold", quantity: 3 },
    ],
    outputs: [{ resourceId: "microchipStage1C", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-2a",
    name: "Microchip Machine II (2A: Acid + water)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-a",
      label: "Microchip Machine II — Stage A",
      priority: 2,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: "microchipStage1C", quantity: 18 },
      { resourceId: "acid", quantity: 6 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage2A", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-2b",
    name: "Microchip Machine II (2B: Copper + plastic)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-b",
      label: "Microchip Machine II — Stage B",
      priority: 2,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: "microchipStage2A", quantity: 18 },
      { resourceId: "copper", quantity: 6 },
      { resourceId: "plastic", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage2B", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-2c",
    name: "Microchip Machine II (2C: Gold)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-c",
      label: "Microchip Machine II — Stage C",
      priority: 2,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: "microchipStage2B", quantity: 18 },
      { resourceId: "gold", quantity: 3 },
    ],
    outputs: [{ resourceId: "microchipStage2C", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-3a",
    name: "Microchip Machine II (3A: Acid + water)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-a",
      label: "Microchip Machine II — Stage A",
      priority: 3,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: "microchipStage2C", quantity: 18 },
      { resourceId: "acid", quantity: 6 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage3A", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-3b",
    name: "Microchip Machine II (3B: Copper + plastic)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-b",
      label: "Microchip Machine II — Stage B",
      priority: 3,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: "microchipStage3A", quantity: 18 },
      { resourceId: "copper", quantity: 6 },
      { resourceId: "plastic", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage3B", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-3c",
    name: "Microchip Machine II (3C: Gold)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-c",
      label: "Microchip Machine II — Stage C",
      priority: 3,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: "microchipStage3B", quantity: 18 },
      { resourceId: "gold", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage3C", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-4a",
    name: "Microchip Machine II (4A: Acid + water)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-a",
      label: "Microchip Machine II — Stage A",
      priority: 4,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: "microchipStage3C", quantity: 18 },
      { resourceId: "acid", quantity: 6 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage4A", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-4b",
    name: "Microchip Machine II (4B: Copper + plastic)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-b",
      label: "Microchip Machine II — Stage B",
      priority: 4,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: "microchipStage4A", quantity: 18 },
      { resourceId: "copper", quantity: 6 },
      { resourceId: "plastic", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchipStage4B", quantity: 18 }],
  },
  {
    id: "microchip-machine-ii-final",
    name: "Microchip Machine II (4C: Microchips)",
    building: "Microchip Machine II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: {
      id: "microchip-machine-ii-c",
      label: "Microchip Machine II — Stage C",
      priority: 4,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: "microchipStage4B", quantity: 18 },
      { resourceId: "gold", quantity: 6 },
    ],
    outputs: [{ resourceId: "microchips", quantity: 36 }],
  },
  {
    id: "assembly-v-electronics-iii",
    name: "Assembly V (Electronics III)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    inputs: [
      { resourceId: "microchips", quantity: 6 },
      { resourceId: "electronicsII", quantity: 12 },
    ],
    outputs: [{ resourceId: "electronicsIII", quantity: 6 }],
  },
  {
    id: "rubber-maker-naphtha",
    name: "Rubber Maker I (Naphtha)",
    building: "Rubber Maker I",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: { id: "rubber-maker-i", priority: 1 },
    inputs: [
      { resourceId: "naphtha", quantity: 12 },
      { resourceId: "sulfur", quantity: 3 },
    ],
    outputs: [{ resourceId: "rubber", quantity: 24 }],
  },
  {
    id: "rubber-maker-ethanol",
    name: "Rubber Maker I (Ethanol)",
    building: "Rubber Maker I",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    sharedCapacity: { id: "rubber-maker-i", priority: 2 },
    inputs: [
      { resourceId: "ethanol", quantity: 12 },
      { resourceId: "sulfur", quantity: 3 },
    ],
    outputs: [{ resourceId: "rubber", quantity: 24 }],
  },
  {
    id: "chemical-plant-ii-ethanol",
    name: "Chemical Plant II (Ethanol)",
    building: "Chemical Plant II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["ethanol"],
    sharedCapacity: { id: "chemical-plant-ii-electronics", priority: 1 },
    inputs: [
      { resourceId: "hydrogen", quantity: 36 },
      { resourceId: "carbonDioxide", quantity: 27 },
    ],
    outputs: [
      { resourceId: "ethanol", quantity: 18 },
      { resourceId: "water", quantity: 9 },
    ],
  },
  {
    id: "chemical-plant-ii-graphite",
    name: "Chemical Plant II (Graphite)",
    building: "Chemical Plant II",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "input",
    sharedCapacity: {
      id: "chemical-plant-ii-electronics",
      priority: 2,
      allocation: "fallback",
    },
    inputs: [{ resourceId: "carbonDioxide", quantity: 144 }],
    outputs: [{ resourceId: "graphite", quantity: 6 }],
  },
  {
    id: "copper-electrolysis-acid",
    name: "Copper Electrolysis (Acid)",
    building: "Copper Electrolysis",
    group: "production",
    cycleDurationSeconds: 40,
    balanceBy: "output",
    inputs: [
      { resourceId: "impureCopper", quantity: 24 },
      { resourceId: "acid", quantity: 6 },
    ],
    outputs: [{ resourceId: "copper", quantity: 24 }],
  },
  {
    id: "waste-sorting-recyclables",
    name: "Waste Sorting Plant",
    building: "Waste Sorting Plant",
    group: "production",
    balanceBy: "input",
    inputs: [{ resourceId: "recyclables", quantity: 144 }],
    // In v0.8.6 the sorter emits the hidden recoverable-material mix carried by
    // its Recyclables input. These placeholders are resolved by the calculator.
    outputs: [
      { resourceId: "ironScrap", quantity: 0 },
      { resourceId: "copperScrap", quantity: 0 },
      { resourceId: "aluminumScrap", quantity: 0 },
      { resourceId: "goldScrap", quantity: 0 },
      { resourceId: "brokenGlass", quantity: 0 },
    ],
    sortsRecyclableSources: true,
  },
  {
    id: "assembly-v-mechanical-parts",
    name: "Assembly V (Mechanical Parts)",
    building: "Assembly V",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [{ resourceId: "steel", quantity: 48 }],
    outputs: [{ resourceId: "mechanicalParts", quantity: 96 }],
  },
  {
    id: "cooled-caster-ii-steel",
    name: "Cooled Caster II (Steel)",
    building: "Cooled Caster II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    inputs: [
      { resourceId: "moltenSteel", quantity: 24 },
      { resourceId: "water", quantity: 12 },
    ],
    outputs: [{ resourceId: "steel", quantity: 24 }],
  },
  {
    id: "oxygen-furnace-ii-steel",
    name: "Oxygen Furnace II",
    building: "Oxygen Furnace II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["moltenSteel"],
    inputs: [
      { resourceId: "moltenIron", quantity: 48 },
      { resourceId: "oxygen", quantity: 18 },
    ],
    outputs: [
      { resourceId: "moltenSteel", quantity: 24 },
      { resourceId: "exhaust", quantity: 36 },
    ],
  },
  {
    id: "arc-furnace-ii-iron-scrap",
    name: "Arc Furnace II (Iron Scrap — priority 1)",
    building: "Arc Furnace II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "input",
    balanceInputIds: ["ironScrap"],
    sharedCapacity: { id: "arc-furnace-ii-iron", priority: 1 },
    inputs: [
      { resourceId: "ironScrap", quantity: 48 },
      { resourceId: "graphite", quantity: 3 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [
      { resourceId: "moltenIron", quantity: 48 },
      { resourceId: "steamLow", quantity: 6 },
      { resourceId: "exhaust", quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: "arc-furnace-ii-iron-ore",
    name: "Arc Furnace II (Crushed Iron Ore — priority 2)",
    building: "Arc Furnace II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["moltenIron"],
    sharedCapacity: { id: "arc-furnace-ii-iron", priority: 2 },
    inputs: [
      { resourceId: "ironOreCrushed", quantity: 48 },
      { resourceId: "limestone", quantity: 6 },
      { resourceId: "graphite", quantity: 3 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [
      { resourceId: "moltenIron", quantity: 48 },
      { resourceId: "slag", quantity: 18 },
      { resourceId: "steamLow", quantity: 6 },
      { resourceId: "exhaust", quantity: 12 },
    ],
  },
  {
    id: "crusher-large-iron",
    name: "Crusher (Large) — Iron Ore",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 30,
    balanceBy: "output",
    inputs: [{ resourceId: "ironOre", quantity: 192 }],
    outputs: [{ resourceId: "ironOreCrushed", quantity: 192 }],
  },
  {
    id: "arc-furnace-ii-copper-scrap",
    name: "Arc Furnace II (Copper Scrap — priority 1)",
    building: "Arc Furnace II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "input",
    balanceInputIds: ["copperScrap"],
    sharedCapacity: { id: "arc-furnace-ii-copper", priority: 1 },
    inputs: [
      { resourceId: "copperScrap", quantity: 48 },
      { resourceId: "graphite", quantity: 3 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [
      { resourceId: "moltenCopper", quantity: 48 },
      { resourceId: "steamLow", quantity: 6 },
      { resourceId: "exhaust", quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: "arc-furnace-ii-copper-ore",
    name: "Arc Furnace II (Crushed Ore — priority 2)",
    building: "Arc Furnace II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["moltenCopper"],
    sharedCapacity: { id: "arc-furnace-ii-copper", priority: 2 },
    inputs: [
      { resourceId: "copperOreCrushed", quantity: 48 },
      { resourceId: "sand", quantity: 6 },
      { resourceId: "graphite", quantity: 3 },
      { resourceId: "water", quantity: 6 },
    ],
    outputs: [
      { resourceId: "moltenCopper", quantity: 48 },
      { resourceId: "slag", quantity: 18 },
      { resourceId: "steamLow", quantity: 6 },
      { resourceId: "exhaust", quantity: 12 },
    ],
  },
  {
    id: "metal-caster-ii-copper",
    name: "Metal Caster II (Copper)",
    building: "Metal Caster II",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    inputs: [{ resourceId: "moltenCopper", quantity: 24 }],
    outputs: [{ resourceId: "impureCopper", quantity: 24 }],
  },
  {
    id: "crusher-large-copper",
    name: "Crusher (Large) — Copper Ore",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 30,
    balanceBy: "output",
    inputs: [{ resourceId: "copperOre", quantity: 192 }],
    outputs: [{ resourceId: "copperOreCrushed", quantity: 192 }],
  },
  {
    id: "gold-furnace-scrap",
    name: "Gold Furnace (Gold Scrap — priority 1)",
    building: "Gold Furnace",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "input",
    balanceInputIds: ["goldScrap"],
    sharedCapacity: { id: "gold-furnace", priority: 1 },
    inputs: [{ resourceId: "goldScrap", quantity: 9 }],
    outputs: [{ resourceId: "gold", quantity: 9 }],
    electricityMultiplier: 0.6,
  },
  {
    id: "gold-furnace-concentrate",
    name: "Gold Furnace (Concentrate — priority 2)",
    building: "Gold Furnace",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["gold"],
    sharedCapacity: { id: "gold-furnace", priority: 2 },
    inputs: [
      { resourceId: "goldOreConcentrate", quantity: 18 },
      { resourceId: "sand", quantity: 3 },
    ],
    outputs: [
      { resourceId: "gold", quantity: 9 },
      { resourceId: "exhaust", quantity: 12 },
    ],
  },
  {
    id: "settling-tank-gold",
    name: "Settling Tank (Gold Ore Concentrate)",
    building: "Settling Tank",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    balanceOutputIds: ["goldOreConcentrate"],
    inputs: [
      { resourceId: "goldOrePowder", quantity: 36 },
      { resourceId: "acid", quantity: 12 },
    ],
    outputs: [
      { resourceId: "goldOreConcentrate", quantity: 9 },
      { resourceId: "toxicSlurry", quantity: 27 },
    ],
  },
  {
    id: "crusher-large-gold-crushing",
    name: "Gold Ore Crushing",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 20,
    balanceBy: "output",
    inputs: [{ resourceId: "goldOre", quantity: 144 }],
    outputs: [{ resourceId: "goldOreCrushed", quantity: 144 }],
  },
  {
    id: "crusher-large-gold-milling",
    name: "Gold Ore Milling",
    building: "Crusher (Large)",
    group: "production",
    cycleDurationSeconds: 40,
    balanceBy: "output",
    inputs: [{ resourceId: "goldOreCrushed", quantity: 72 }],
    outputs: [{ resourceId: "goldOrePowder", quantity: 72 }],
  },

  // Maintenance
  {
    id: "maintenance-i-basic",
    name: "Maintenance I (Basic)",
    building: "Maintenance Depot (Basic)",
    group: "production",
    cycleDurationSeconds: 30,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 12 },
      { resourceId: "electronicsI", quantity: 6 },
    ],
    outputs: [{ resourceId: "maintenanceI", quantity: 220, outputModifierId: "maintenanceOutput" }],
  },
  {
    id: "maintenance-i",
    name: "Maintenance I",
    building: "Maintenance Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 24 },
      { resourceId: "electronicsI", quantity: 12 },
    ],
    outputs: [{ resourceId: "maintenanceI", quantity: 480, outputModifierId: "maintenanceOutput" }],
  },
  {
    id: "maintenance-i-recycling",
    name: "Maintenance I (Recycling)",
    building: "Maintenance Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 24 },
      { resourceId: "electronicsI", quantity: 12 },
    ],
    outputs: [
      { resourceId: "maintenanceI", quantity: 480, outputModifierId: "maintenanceOutput" },
      { resourceId: "recyclables", quantity: 18 },
    ],
  },
  {
    id: "maintenance-ii",
    name: "Maintenance II",
    building: "Maintenance II Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 18 },
      { resourceId: "electronicsII", quantity: 12 },
    ],
    outputs: [
      { resourceId: "maintenanceII", quantity: 480, outputModifierId: "maintenanceOutput" },
    ],
  },
  {
    id: "maintenance-ii-recycling",
    name: "Maintenance II (Recycling)",
    building: "Maintenance II Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 18 },
      { resourceId: "electronicsII", quantity: 12 },
    ],
    outputs: [
      { resourceId: "maintenanceII", quantity: 480, outputModifierId: "maintenanceOutput" },
      { resourceId: "recyclables", quantity: 24 },
    ],
  },
  {
    id: "maintenance-iii",
    name: "Maintenance III",
    building: "Maintenance III Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 9 },
      { resourceId: "electronicsIII", quantity: 6 },
    ],
    outputs: [
      { resourceId: "maintenanceIII", quantity: 240, outputModifierId: "maintenanceOutput" },
    ],
  },
  {
    id: "maintenance-iii-recycling",
    name: "Maintenance III (Recycling)",
    building: "Maintenance III Depot",
    group: "production",
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: "mechanicalParts", quantity: 9 },
      { resourceId: "electronicsIII", quantity: 6 },
    ],
    outputs: [
      { resourceId: "maintenanceIII", quantity: 240, outputModifierId: "maintenanceOutput" },
      { resourceId: "recyclables", quantity: 24 },
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
    outputs: [{ resourceId: "moxRod", quantity: 2 }],
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
    outputs: [{ resourceId: "blanketFuel", quantity: 4 }],
  },
  {
    id: "chemical-plant-yellowcake",
    name: "Chemical Plant (Yellowcake → Blanket Fuel)",
    building: "Chemical Plant II",
    group: "production",
    balanceBy: "output",
    inputs: [
      { resourceId: "yellowcake", quantity: 6 },
      { resourceId: "salt", quantity: 2 },
    ],
    outputs: [{ resourceId: "blanketFuel", quantity: 2 }],
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
  {
    id: "radioactive-waste-storage",
    name: "Radioactive Waste Storage (Fission Product)",
    building: "Radioactive Waste Storage",
    group: "waste",
    inputs: [{ resourceId: "fissionProduct", quantity: radioactiveWasteStorageThroughput }],
    outputs: [{ resourceId: "retiredWaste", quantity: radioactiveWasteStorageThroughput }],
    decayStorage: {
      capacity: radioactiveWasteStorageCapacity,
      decayCycles: fissionProductDecayCycles,
    },
    balanceBy: "input",
  },
  {
    id: "shredder-retired-waste",
    name: "Shredder (Retired Waste)",
    building: "Shredder",
    group: "waste",
    inputs: [{ resourceId: "retiredWaste", quantity: 6 }],
    outputs: [{ resourceId: "recyclables", quantity: 6 }],
    // Preserve the recoverable source materials carried by Retired Waste.
    appliesRecyclingEfficiency: false,
    balanceBy: "input",
  },

  // Uranium processing
  {
    id: "mixer-ii-acid",
    name: "Mixer II (Acid)",
    building: "Mixer II",
    group: "production",
    cycleDurationSeconds: 10,
    balanceBy: "output",
    inputs: [
      { resourceId: "sulfur", quantity: 12 },
      { resourceId: "water", quantity: 60 },
    ],
    outputs: [{ resourceId: "acid", quantity: 72 }],
  },
  {
    id: "crusher",
    name: "Crusher (Uranium Ore)",
    building: "Crusher",
    group: "production",
    inputs: [{ resourceId: "uraniumOre", quantity: 12 }],
    outputs: [{ resourceId: "uraniumOrePowder", quantity: 12 }],
  },
  {
    id: "crusher-large",
    name: "Crusher (Large) — Uranium Ore",
    building: "Crusher (Large)",
    group: "production",
    balanceBy: "output",
    inputs: [{ resourceId: "uraniumOre", quantity: 72 }],
    outputs: [{ resourceId: "uraniumOrePowder", quantity: 72 }],
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
    balanceBy: "input",
    balanceInputIds: ["steamSuper"],
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
    balanceBy: "input",
    balanceInputIds: ["steamDepleted"],
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
    balanceBy: "input",
    balanceInputIds: ["steamSuper"],
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
    inputs: [{ resourceId: "steamDepleted", quantity: 96 }],
    outputs: [{ resourceId: "water", quantity: 72 }],
  },
  {
    id: "cooling-tower-large-super",
    name: "Cooling Tower Large (Super)",
    building: "Cooling Tower (Large)",
    group: "sink",
    inputs: [{ resourceId: "steamSuper", quantity: 96 }],
    outputs: [{ resourceId: "water", quantity: 60 }],
  },
];
