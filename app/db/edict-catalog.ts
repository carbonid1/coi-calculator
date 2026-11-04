export const edictCatalog = [
  { id: 'growthPause', name: 'Growth Pause', category: 'population', effectIds: [] },
  {
    id: 'growthBoost',
    name: 'Growth Boost',
    category: 'population',
    effectIds: ['PopulationGrowth'],
  },
  { id: 'eviction', name: 'Eviction', category: 'population', effectIds: ['PopulationEviction'] },
  {
    id: 'quarantine',
    name: 'Quarantine',
    category: 'population',
    effectIds: ['DiseaseReduction', 'WorkersWithheld'],
  },
  {
    id: 'foodSaver',
    name: 'Food Saver',
    category: 'population',
    effectIds: ['FoodConsumptionMultiplier'],
  },
  {
    id: 'healthBoost',
    name: 'Health Boost',
    category: 'population',
    effectIds: ['BaseHealthDiffEdicts'],
  },
  {
    id: 'plentyOfFood',
    name: 'Plenty of Food',
    category: 'population',
    effectIds: ['FoodConsumptionMultiplier'],
  },
  {
    id: 'moreHouseholdGoods',
    name: 'More Household Goods',
    category: 'population',
    effectIds: ['HouseholdGoodsConsumptionMultiplier', 'HouseholdGoodsUnityMultiplier'],
  },
  {
    id: 'moreAirConditioners',
    name: 'More Household Appliances',
    category: 'population',
    effectIds: ['HouseholdAppliancesConsumptionMultiplier', 'HouseholdAppliancesUnityMultiplier'],
  },
  {
    id: 'moreConsumerElectronics',
    name: 'More Consumer Electronics',
    category: 'population',
    effectIds: ['ConsumerElectronicsConsumptionMultiplier', 'ConsumerElectronicsUnityMultiplier'],
  },
  {
    id: 'vehiclesFuelSaver',
    name: 'Vehicles Fuel Saver',
    category: 'industrial',
    effectIds: ['VehiclesFuelConsumptionMultiplier'],
  },
  {
    id: 'shipsFuelSaver',
    name: 'Ships Fuel Saver',
    category: 'industrial',
    effectIds: ['ShipsFuelConsumptionMultiplier'],
  },
  {
    id: 'overloadedTrucks',
    name: 'Overloaded Trucks',
    category: 'industrial',
    effectIds: ['TrucksCapacityMultiplier', 'TrucksMaintenanceMultiplier'],
  },
  {
    id: 'maintenanceReducer',
    name: 'Maintenance Reducer',
    category: 'industrial',
    effectIds: ['MaintenanceConsumptionMultiplier'],
  },
  {
    id: 'recyclingIncrease',
    name: 'Recycling Increase',
    category: 'industrial',
    effectIds: ['RecyclingRatioDiff'],
  },
  {
    id: 'farmingBoost',
    name: 'Farming Boost',
    category: 'industrial',
    effectIds: ['FarmYieldMultiplier', 'FarmWaterConsumptionMultiplier'],
  },
  {
    id: 'waterSaver',
    name: 'Water Saver',
    category: 'industrial',
    effectIds: ['SettlementWaterConsumptionMultiplier', 'FarmWaterConsumptionMultiplier'],
  },
  {
    id: 'cleanPanels',
    name: 'Clean Panels',
    category: 'industrial',
    effectIds: ['SolarPowerMultiplier'],
  },
  {
    id: 'researchEfficiency',
    name: 'Research Efficiency',
    category: 'industrial',
    effectIds: ['ResearchEfficiencyMultiplier'],
  },
] as const

export type EdictId = (typeof edictCatalog)[number]['id']
