export const researchCatalog = [
  {
    id: 'vehiclesPollution',
    name: 'Vehicles Pollution',
    propertyId: 'VehiclesPollutionMultiplier',
  },
  { id: 'shipsPollution', name: 'Ships Pollution', propertyId: 'ShipsPollutionMultiplier' },
  { id: 'trainsPollution', name: 'Trains Pollution', propertyId: 'TrainsPollutionMultiplier' },
  { id: 'cropYield', name: 'Crop Yield', propertyId: 'FarmYieldMultiplier' },
  { id: 'treeGrowthSpeed', name: 'Tree Growth Speed', propertyId: 'TreesGrowthSpeed' },
  { id: 'rainwaterYield', name: 'Rainwater Yield', propertyId: 'RainYieldMultiplier' },
  {
    id: 'settlementWaterUse',
    name: 'Settlement Water Use',
    propertyId: 'SettlementWaterConsumptionMultiplier',
  },
  { id: 'unityCapacity', name: 'Unity Capacity', propertyId: 'UnityCapacityMultiplier' },
  { id: 'housingCapacity', name: 'Housing Capacity', propertyId: 'HousingCapacityMultiplier' },
  { id: 'focusPoints', name: 'Focus Points', propertyId: 'FocusPointsMultiplier' },
  { id: 'vehicleLimit', name: 'Vehicle Limit', propertyId: 'VehicleLimitBonus' },
  {
    id: 'vehiclesFuelUse',
    name: 'Vehicles Fuel Use',
    propertyId: 'VehiclesFuelConsumptionMultiplier',
  },
  { id: 'shipsFuelUse', name: 'Ships Fuel Use', propertyId: 'ShipsFuelConsumptionMultiplier' },
  { id: 'trainsFuelUse', name: 'Trains Fuel Use', propertyId: 'TrainsFuelConsumptionMultiplier' },
  { id: 'rocketsCapacity', name: 'Rockets Capacity', propertyId: 'RocketsCapacityMultiplier' },
  {
    id: 'maintenanceOutput',
    name: 'Maintenance Output',
    propertyId: 'MaintenanceProductionMultiplier',
  },
  { id: 'worldMineOutput', name: 'World Mine Output', propertyId: 'WorldMinesEfficiency' },
  { id: 'solarPower', name: 'Solar Power', propertyId: 'SolarPowerMultiplier' },
] as const

export type InfiniteResearchId = (typeof researchCatalog)[number]['id']
