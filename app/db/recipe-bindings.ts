export interface FactoryRecipeBinding {
  buildingId: string
  recipeId: string
  storage?: boolean
}

/** Identity and calculator policy only; rates come from the native catalog. */
export const factoryRecipeBindings: Readonly<Record<string, FactoryRecipeBinding>> = {
  'seawater-pump': {
    buildingId: 'OceanWaterPumpT1',
    recipeId: 'OceanWaterPumping2x',
  },
  'seawater-pump-tall': {
    buildingId: 'OceanWaterPumpLarge',
    recipeId: 'OceanWaterPumping2xT2',
  },
  'groundwater-pump': {
    buildingId: 'LandWaterPump',
    recipeId: 'LandWaterPumping',
  },
  'groundwater-pump-factory-reserve': {
    buildingId: 'LandWaterPump',
    recipeId: 'LandWaterPumping',
  },
  fbr: {
    buildingId: 'FastBreederReactor',
    recipeId: 'Product_CoreFuel:enrichment:1',
  },
  'fbr-0x': {
    buildingId: 'FastBreederReactor',
    recipeId: 'Product_CoreFuel:enrichment:0',
  },
  'fbr-3x': {
    buildingId: 'FastBreederReactor',
    recipeId: 'Product_CoreFuel:enrichment:2',
  },
  'turbine-super': {
    buildingId: 'TurbineSuperPress',
    recipeId: 'TurbineSuperPress',
  },
  'turbine-high': {
    buildingId: 'TurbineHighPressT2',
    recipeId: 'TurbineHighPressT2',
  },
  'turbine-low': {
    buildingId: 'TurbineLowPressT2',
    recipeId: 'TurbineLowPressT2',
  },
  'housing-wastewater-treatment': {
    buildingId: 'WaterTreatmentPlant',
    recipeId: 'WaterTreatmentT2',
  },
  'housing-anaerobic-digester': {
    buildingId: 'AnaerobicDigester',
    recipeId: 'SludgeDigestion',
  },
  'housing-mixer-ii-biomass-compost': {
    buildingId: 'IndustrialMixerT2',
    recipeId: 'BiomassCompost',
  },
  'chemical-plant-ii-cooking-oil-diesel': {
    buildingId: 'ChemicalPlant2',
    recipeId: 'EthanolCookingOilReforming',
  },
  'cracking-unit-fuel-gas-diesel': {
    buildingId: 'HydroCrackerT1',
    recipeId: 'FuelGasReforming',
  },
  'electrolyzer-ii-chlorine': {
    buildingId: 'ElectrolyzerT2',
    recipeId: 'BrineElectrolysis',
  },
  'evaporation-pond-heated-salt-brine': {
    buildingId: 'EvaporationPondHeated',
    recipeId: 'SaltMakingFromBrine',
  },
  'nuclear-reprocessing': {
    buildingId: 'NuclearReprocessingPlant',
    recipeId: 'CoreFuelReprocessing',
  },
  'enrichment-plant': {
    buildingId: 'UraniumEnrichmentPlant',
    recipeId: 'BlanketFuelReprocessing',
  },
  'research-lab-iv': {
    buildingId: 'ResearchLab5',
    recipeId: 'RecipeForUiData:1',
  },
  'assembly-v-office-supplies': {
    buildingId: 'AssemblyRoboticT2',
    recipeId: 'OfficeSuppliesAssembly',
  },
  'assembly-v-station-parts': {
    buildingId: 'AssemblyRoboticT2',
    recipeId: 'StationPartsAssembly',
  },
  'maintenance-i-basic': {
    buildingId: 'MaintenanceDepotT0',
    recipeId: 'MaintenanceT0Recipe',
  },
  'maintenance-i': {
    buildingId: 'MaintenanceDepotT1',
    recipeId: 'MaintenanceT1Recipe',
  },
  'maintenance-i-recycling': {
    buildingId: 'MaintenanceDepotT1',
    recipeId: 'MaintenanceT1Recycling',
  },
  'maintenance-ii': {
    buildingId: 'MaintenanceDepotT2',
    recipeId: 'MaintenanceT2Recipe',
  },
  'maintenance-ii-recycling': {
    buildingId: 'MaintenanceDepotT2',
    recipeId: 'MaintenanceT2Recycling',
  },
  'maintenance-iii': {
    buildingId: 'MaintenanceDepotT3',
    recipeId: 'MaintenanceT3Recipe',
  },
  'maintenance-iii-recycling': {
    buildingId: 'MaintenanceDepotT3',
    recipeId: 'MaintenanceT3Recycling',
  },
  'chemical-plant-yellowcake': {
    buildingId: 'ChemicalPlant2',
    recipeId: 'BlanketFuelFromYellowcake',
  },
  'radioactive-waste-storage': {
    buildingId: 'NuclearWasteStorage',
    recipeId: 'RecipeForUiData:0',
    storage: true,
  },
  'shredder-retired-waste': {
    buildingId: 'Shredder',
    recipeId: 'ShreddingRetiredWaste',
  },
  crusher: {
    buildingId: 'Crusher',
    recipeId: 'UraniumCrushing',
  },
  'hydrogen-reformer-super': {
    buildingId: 'HydrogenReformer',
    recipeId: 'HydrogenProductionFromSteamSp',
  },
  'thermal-desalinator-depleted': {
    buildingId: 'ThermalDesalinator',
    recipeId: 'DesalinationFromDepleted',
  },
  'thermal-desalinator-low': {
    buildingId: 'ThermalDesalinator',
    recipeId: 'DesalinationFromLP',
  },
  'thermal-desalinator-super': {
    buildingId: 'ThermalDesalinator',
    recipeId: 'DesalinationFromSP',
  },
  'cooling-tower-large-depleted': {
    buildingId: 'CoolingTowerT2',
    recipeId: 'SteamDepletedCondensationT2',
  },
  'cooling-tower-large-low': {
    buildingId: 'CoolingTowerT2',
    recipeId: 'SteamLpCondensationT2',
  },
  'cooling-tower-large-super': {
    buildingId: 'CoolingTowerT2',
    recipeId: 'SteamSpCondensationT2',
  },
  'nuclear-liquid-dump-water': {
    buildingId: 'WasteDump',
    recipeId: 'OceanWaterDumping',
  },
  'nuclear-liquid-dump-brine': {
    buildingId: 'WasteDump',
    recipeId: 'BrineDumping',
  },
  'nuclear-smoke-stack-large-oxygen': {
    buildingId: 'SmokeStackLarge',
    recipeId: 'SmokeStackOxygen',
  },
}
