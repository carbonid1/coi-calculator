export type OfficeTierId = 'officeI' | 'officeII' | 'officeIII';
export type OfficeBoostStep = 0 | 1 | 2;

export const officeCatalog = [
  { id: 'officeI', name: 'Office I', prototypeId: 'OfficeBuildingT1' },
  { id: 'officeII', name: 'Office II', prototypeId: 'OfficeBuildingT2' },
  { id: 'officeIII', name: 'Office III', prototypeId: 'OfficeBuildingT3' },
] as const;

// Stable product bindings and presentation only; rates and limits come from Bridge.
export const focusCatalog = [
  { id: 'trucksCapacity', name: 'Trucks Capacity', effectLabel: 'capacity', propertyId: 'TrucksCapacityMultiplier', modeledInCalculator: false },
  { id: 'trainsCapacity', name: 'Trains Capacity', effectLabel: 'capacity', propertyId: 'TrainsCapacityMultiplier', modeledInCalculator: false },
  { id: 'researchEfficiency', name: 'Research Efficiency', effectLabel: 'efficiency', propertyId: 'ResearchEfficiencyMultiplier', modeledInCalculator: true },
  { id: 'maintenanceProduction', name: 'Maintenance Production', effectLabel: 'production', propertyId: 'MaintenanceProductionMultiplier', modeledInCalculator: true },
  { id: 'cropYield', name: 'Crop Yield', effectLabel: 'yield', propertyId: 'FarmYieldMultiplier', modeledInCalculator: true },
  { id: 'recyclingEfficiency', name: 'Recycling Efficiency', effectLabel: 'efficiency', propertyId: 'RecyclingRatioDiff', modeledInCalculator: true },
  { id: 'foodConsumption', name: 'Food Consumption', effectLabel: 'consumption', propertyId: 'FoodConsumptionMultiplier', modeledInCalculator: true },
  { id: 'settlementConsumption', name: 'Goods & Services Consumption', effectLabel: 'consumption', propertyId: 'SettlementConsumptionMultiplier', modeledInCalculator: true },
  { id: 'unityProduction', name: 'Settlement Unity', effectLabel: 'Unity', propertyId: 'UnityProductionMultiplier', modeledInCalculator: true },
  { id: 'contractsProfitability', name: 'Contracts Profitability', effectLabel: 'profitability', propertyId: 'ContractsProfitMultiplier', modeledInCalculator: true },
  { id: 'contractsUnityCost', name: 'Contracts Unity Cost', effectLabel: 'Unity cost', propertyId: 'ContractsUnityCostMultiplier', modeledInCalculator: true },
  { id: 'worldMinesEfficiency', name: 'World Mines & Rigs', effectLabel: 'efficiency', propertyId: 'WorldMinesEfficiency', modeledInCalculator: false },
] as const;

export type FocusEffectId = typeof focusCatalog[number]['id'];

export const mapFocusValues = <Value>(map: (id: FocusEffectId) => Value): Record<FocusEffectId, Value> => ({
  trucksCapacity: map('trucksCapacity'), trainsCapacity: map('trainsCapacity'),
  researchEfficiency: map('researchEfficiency'), maintenanceProduction: map('maintenanceProduction'),
  cropYield: map('cropYield'), recyclingEfficiency: map('recyclingEfficiency'),
  foodConsumption: map('foodConsumption'), settlementConsumption: map('settlementConsumption'),
  unityProduction: map('unityProduction'), contractsProfitability: map('contractsProfitability'),
  contractsUnityCost: map('contractsUnityCost'), worldMinesEfficiency: map('worldMinesEfficiency'),
});
