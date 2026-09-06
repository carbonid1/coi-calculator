import { activeHousingType, housingTypes } from "./housing";
import { settlementConfig } from "./settlement";
import { calculateSpaceStationLevel, defaultSpaceStationLevel } from "./space-station";

export interface BuildingData {
  workers: number;
  electricityKw: number;
  /** Pausing this building has no recurring-cost benefit worth recommending. */
  suppressPauseAttention?: boolean;
  /** Full-load computing demand. Capacity providers leave this at zero. */
  computingTflops?: number;
  /** Recurring Unity demand while the building is operating. */
  unityPerCycle?: number;
}

const buildings: Record<string, BuildingData> = {
  [activeHousingType.name]: {
    workers: 0,
    electricityKw: activeHousingType.populationCapacity
      * settlementConfig.electricityKwPerPop
      * activeHousingType.serviceDemandMultipliers.electricity,
  },
  [housingTypes.housingII.name]: {
    workers: 0,
    electricityKw: housingTypes.housingII.populationCapacity
      * settlementConfig.electricityKwPerPop
      * housingTypes.housingII.serviceDemandMultipliers.electricity,
  },
  "Internet Module": {
    workers: 12,
    electricityKw: 500,
    computingTflops: settlementConfig.computingTflopsPerHundredPops,
  },
  "Food Market": { workers: 3, electricityKw: 0 },
  "Food Market II": { workers: 6, electricityKw: 0 },
  "Transformer": { workers: 8, electricityKw: 0 },
  "Water Facility": { workers: 6, electricityKw: 100 },
  "Household Goods Module": { workers: 16, electricityKw: 150 },
  "Waste Collection": { workers: 4, electricityKw: 0 },
  "Recyclables Collection": { workers: 12, electricityKw: 0 },
  "Biomass Collection": { workers: 6, electricityKw: 0 },
  "Clinic I": { workers: 36, electricityKw: 60 },
  "Wastewater Treatment": { workers: 26, electricityKw: 600 },
  "Anaerobic Digester": { workers: 4, electricityKw: 50 },
  "Incineration Plant": { workers: 16, electricityKw: 500 },
  "Sour Water Stripper": { workers: 8, electricityKw: 160 },
  "Cracking Unit": { workers: 12, electricityKw: 160 },
  "Forestry Control Tower": { workers: 0, electricityKw: 0 },
  // The calculator models the game's fast recipes, whose 300% power
  // multiplier raises the T1/T2 base draws from 100/200 kW to 300/600 kW.
  "Seawater Pump": { workers: 1, electricityKw: 300 },
  "Seawater Pump (Tall)": { workers: 1, electricityKw: 600 },
  "Groundwater Pump": { workers: 2, electricityKw: 120 },
  "Fast Breeder Reactor": { workers: 200, electricityKw: 0 },
  "Super-Pressure Turbine": { workers: 1, electricityKw: 0 },
  "High-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Low-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Power Generator II": { workers: 5, electricityKw: 0 },
  "Solar Panel": { workers: 0, electricityKw: 0 },
  "Solar Panel (Mono)": { workers: 0, electricityKw: 0 },
  "Hydrogen Reformer": { workers: 8, electricityKw: 400 },
  "Thermal Desalinator": { workers: 4, electricityKw: 400 },
  "Chemical Plant": { workers: 8, electricityKw: 250 },
  "Chemical Plant II": { workers: 14, electricityKw: 400 },
  "Air Separator": { workers: 6, electricityKw: 400 },
  "Polymerization Plant": { workers: 12, electricityKw: 400 },
  "Nuclear Reprocessing Plant": { workers: 30, electricityKw: 2000, computingTflops: 24 },
  "Office I": { workers: 250, electricityKw: 250, computingTflops: 12 },
  "Office II": { workers: 500, electricityKw: 400, computingTflops: 24 },
  "Office III": { workers: 1000, electricityKw: 600, computingTflops: 48 },
  "Captain's office I": { workers: 8, electricityKw: 100 },
  "Captain's office II": { workers: 24, electricityKw: 250 },
  "Research Lab IV": { workers: 80, electricityKw: 1000, computingTflops: 12, unityPerCycle: 0.5 },
  "Space Station I": { workers: calculateSpaceStationLevel(1).crew, electricityKw: 0 },
  "Space Station II": { workers: calculateSpaceStationLevel(2).crew, electricityKw: 0 },
  "Space Station III": { workers: calculateSpaceStationLevel(3).crew, electricityKw: 0 },
  "Space Station IV": { workers: defaultSpaceStationLevel.crew, electricityKw: 0 },
  "Space Station Orbital Research": {
    workers: 0,
    electricityKw: 0,
    suppressPauseAttention: true,
  },
  "Rocket Assembly Depot": {
    workers: 160,
    electricityKw: 2000,
    computingTflops: 8,
  },
  "Rocket Launch Pad": { workers: 30, electricityKw: 0 },
  "Radioactive Waste Storage": { workers: 10, electricityKw: 120 },
  "Shredder": { workers: 1, electricityKw: 100 },
  "Enrichment Plant": { workers: 14, electricityKw: 4000 },
  "Crusher": { workers: 2, electricityKw: 300 },
  "Crusher (Large)": { workers: 6, electricityKw: 1000 },
  "Settling Tank": { workers: 6, electricityKw: 120 },
  "Mixer II": { workers: 4, electricityKw: 200 },
  "Coal Maker": { workers: 2, electricityKw: 0 },
  "Electrolyzer II": { workers: 3, electricityKw: 1100 },
  "Evaporation Pond (Heated)": { workers: 6, electricityKw: 250 },
  "Chicken Farm": { workers: 12, electricityKw: 0 },
  "Farm": { workers: 8, electricityKw: 0 },
  "Irrigated Farm": { workers: 10, electricityKw: 0 },
  "Greenhouse": { workers: 16, electricityKw: 0 },
  "Greenhouse II": { workers: 20, electricityKw: 0 },
  "Food Processor": { workers: 8, electricityKw: 100 },
  "Mill": { workers: 5, electricityKw: 120 },
  "Baking Unit": { workers: 8, electricityKw: 200 },
  "Fermentation Tank": { workers: 4, electricityKw: 20 },
  "Assembly V": { workers: 0, electricityKw: 400, computingTflops: 6 },
  "Diamond Reactor": { workers: 8, electricityKw: 2000, computingTflops: 2 },
  "Lens Polisher": { workers: 6, electricityKw: 200, computingTflops: 4 },
  "Silicon Reactor": { workers: 2, electricityKw: 80 },
  "Crystallizer": { workers: 8, electricityKw: 500, computingTflops: 4 },
  "Microchip Machine II": { workers: 6, electricityKw: 500, computingTflops: 12 },
  "Rubber Maker I": { workers: 6, electricityKw: 300 },
  "Waste Sorting Plant": { workers: 32, electricityKw: 300 },
  "Exhaust Scrubber": { workers: 8, electricityKw: 200 },
  "Gold Furnace": { workers: 6, electricityKw: 800 },
  "Arc Furnace II": { workers: 14, electricityKw: 6000 },
  "Arc Furnace": { workers: 12, electricityKw: 4000 },
  "Aluminum Cell": { workers: 14, electricityKw: 8000 },
  "Rotary Kiln (gas)": { workers: 10, electricityKw: 100 },
  "Compactor": { workers: 1, electricityKw: 100 },
  "Liquid Dump": { workers: 1, electricityKw: 0 },
  "Smoke stack (large)": {
    workers: 0,
    electricityKw: 0,
    suppressPauseAttention: true,
  },
  "Glass Maker II": { workers: 8, electricityKw: 500 },
  "Oxygen Furnace": { workers: 4, electricityKw: 120 },
  "Oxygen Furnace II": { workers: 6, electricityKw: 200 },
  "Cooled Caster": { workers: 2, electricityKw: 0 },
  "Cooled Caster II": { workers: 2, electricityKw: 0 },
  "Metal Caster II": { workers: 2, electricityKw: 0 },
  "Copper Electrolysis": { workers: 5, electricityKw: 400 },
  "Distillation (Stage III)": { workers: 8, electricityKw: 0 },
  "Alloy Mixer": { workers: 12, electricityKw: 1000 },
  "Maintenance Depot (Basic)": { workers: 6, electricityKw: 100 },
  "Maintenance Depot": { workers: 12, electricityKw: 200 },
  "Maintenance II Depot": { workers: 16, electricityKw: 400 },
  "Maintenance III Depot": { workers: 20, electricityKw: 600 },
  "The Statue of Maintenance (Golden)": { workers: 0, electricityKw: 0 },
  "Ore sorting plant": { workers: 6, electricityKw: 100 },
  "Ore sorting plant (large)": { workers: 30, electricityKw: 700 },
  "Electric locomotive II": { workers: 1, electricityKw: 0 },
  "Unit station module (electrified)": { workers: 1, electricityKw: 50 },
  "Fluid station module (electrified)": { workers: 1, electricityKw: 50 },
  "Loose station module (electrified)": { workers: 1, electricityKw: 50 },
  "Molten station module (electrified)": { workers: 2, electricityKw: 150 },
  "Stacker tower": { workers: 4, electricityKw: 0 },
  "Train depot": { workers: 8, electricityKw: 0 },
  "Vehicles depot": { workers: 6, electricityKw: 0 },
  "Vehicles depot II": { workers: 10, electricityKw: 0 },
  "Vehicles depot III": { workers: 16, electricityKw: 0 },
  "Vehicles": { workers: 1, electricityKw: 0 },
  "Cooling Tower (Large)": {
    workers: 0,
    electricityKw: 0,
    suppressPauseAttention: true,
  },
  "Data Center": { workers: 6, electricityKw: 0 },
  "Basic Rack": { workers: 0, electricityKw: 85 },
  "Water Chiller": { workers: 3, electricityKw: 1000 },
};

const normalizeBuildingName = (name: string) => name.trim().toLocaleLowerCase("en-US");

const buildingsByNormalizedName = new Map(
  Object.entries(buildings).map(([name, building]) => [
    normalizeBuildingName(name),
    building,
  ]),
);

/** Resolves game-localized English display casing to calculator building data. */
export const getBuildingData = (name: string): BuildingData | undefined => (
  buildings[name] ?? buildingsByNormalizedName.get(normalizeBuildingName(name))
);
