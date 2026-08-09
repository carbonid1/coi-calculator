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
  "Solar Panel": { workers: 0, electricityKw: 0 },
  "Solar Panel (Mono)": { workers: 0, electricityKw: 0 },
  "Hydrogen Reformer": { workers: 12, electricityKw: 250 },
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
  "Maintenance Depot (Basic)": { workers: 6, electricityKw: 100 },
  "Maintenance Depot": { workers: 12, electricityKw: 200 },
  "Maintenance II Depot": { workers: 16, electricityKw: 400 },
  "Maintenance III Depot": { workers: 20, electricityKw: 600 },
  "Cooling Tower (Large)": { workers: 0, electricityKw: 0 },
};
