import { activeHousingType } from "./housing";
import { settlementConfig } from "./settlement";

interface BuildingData {
  workers: number;
  electricityKw: number;
}

export const buildings: Record<string, BuildingData> = {
  "Housing II": {
    workers: 0,
    electricityKw: activeHousingType.populationCapacity
      * settlementConfig.electricityKwPerPop
      * settlementConfig.housingIIElectricityMultiplier,
  },
  "Food Market": { workers: 3, electricityKw: 0 },
  "Food Market II": { workers: 6, electricityKw: 0 },
  "Transformer": { workers: 8, electricityKw: 0 },
  "Water Facility": { workers: 6, electricityKw: 100 },
  "Waste Collection": { workers: 4, electricityKw: 0 },
  "Recyclables Collection": { workers: 12, electricityKw: 0 },
  "Biomass Collection": { workers: 6, electricityKw: 0 },
  "Clinic I": { workers: 36, electricityKw: 60 },
  "Wastewater Treatment": { workers: 26, electricityKw: 600 },
  "Anaerobic Digester": { workers: 4, electricityKw: 50 },
  "Seawater Pump": { workers: 1, electricityKw: 100 },
  "Fast Breeder Reactor": { workers: 200, electricityKw: 0 },
  "Super-Pressure Turbine": { workers: 1, electricityKw: 0 },
  "High-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Low-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Solar Panel": { workers: 0, electricityKw: 0 },
  "Solar Panel (Mono)": { workers: 0, electricityKw: 0 },
  "Hydrogen Reformer": { workers: 8, electricityKw: 400 },
  "Thermal Desalinator": { workers: 4, electricityKw: 400 },
  "Chemical Plant": { workers: 8, electricityKw: 250 },
  "Chemical Plant II": { workers: 14, electricityKw: 400 },
  "Nuclear Reprocessing Plant": { workers: 30, electricityKw: 2000 },
  "Radioactive Waste Storage": { workers: 10, electricityKw: 120 },
  "Shredder": { workers: 1, electricityKw: 100 },
  "Enrichment Plant": { workers: 14, electricityKw: 4000 },
  "Crusher": { workers: 2, electricityKw: 300 },
  "Crusher (Large)": { workers: 6, electricityKw: 1000 },
  "Settling Tank": { workers: 6, electricityKw: 120 },
  "Mixer II": { workers: 4, electricityKw: 200 },
  "Coal Maker": { workers: 2, electricityKw: 0 },
  "Electrolyzer II": { workers: 3, electricityKw: 1100 },
  "Chicken Farm": { workers: 12, electricityKw: 0 },
  "Food Processor": { workers: 8, electricityKw: 100 },
  "Mill": { workers: 5, electricityKw: 120 },
  "Baking Unit": { workers: 8, electricityKw: 200 },
  "Assembly V": { workers: 0, electricityKw: 400 },
  "Silicon Reactor": { workers: 2, electricityKw: 80 },
  "Crystallizer": { workers: 8, electricityKw: 500 },
  "Microchip Machine II": { workers: 6, electricityKw: 500 },
  "Rubber Maker I": { workers: 6, electricityKw: 300 },
  "Waste Sorting Plant": { workers: 32, electricityKw: 300 },
  "Gold Furnace": { workers: 6, electricityKw: 800 },
  "Arc Furnace II": { workers: 14, electricityKw: 6000 },
  "Oxygen Furnace II": { workers: 6, electricityKw: 200 },
  "Cooled Caster II": { workers: 2, electricityKw: 0 },
  "Metal Caster II": { workers: 2, electricityKw: 0 },
  "Copper Electrolysis": { workers: 5, electricityKw: 400 },
  "Maintenance Depot (Basic)": { workers: 6, electricityKw: 100 },
  "Maintenance Depot": { workers: 12, electricityKw: 200 },
  "Maintenance II Depot": { workers: 16, electricityKw: 400 },
  "Maintenance III Depot": { workers: 20, electricityKw: 600 },
  "Cooling Tower (Large)": { workers: 0, electricityKw: 0 },
};
