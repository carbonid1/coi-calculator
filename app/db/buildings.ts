interface BuildingData {
  workers: number;
  electricityKw: number;
}

export const buildings: Record<string, BuildingData> = {
  "Seawater Pump": { workers: 1, electricityKw: 100 },
  "Fast Breeder Reactor": { workers: 200, electricityKw: 0 },
  "Super-Pressure Turbine": { workers: 1, electricityKw: 0 },
  "High-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Low-Pressure Turbine II": { workers: 2, electricityKw: 0 },
  "Hydrogen Reformer": { workers: 12, electricityKw: 250 },
  "Thermal Desalinator": { workers: 4, electricityKw: 400 },
  "Chemical Plant": { workers: 8, electricityKw: 250 },
  "Chemical Plant II": { workers: 14, electricityKw: 400 },
  "Nuclear Reprocessing Plant": { workers: 30, electricityKw: 2000 },
  "Enrichment Plant": { workers: 14, electricityKw: 4000 },
  "Crusher": { workers: 2, electricityKw: 300 },
  "Settling Tank": { workers: 6, electricityKw: 120 },
  "Cooling Tower (Large)": { workers: 0, electricityKw: 0 },
};
