import { resolveDirectionalPlan } from "../helpers/resolve-layered-value/resolve-directional-plan";
import { resolveCurrentLayeredValue, type ResolvedValue } from "../helpers/resolve-layered-value/resolve-layered-value";

const edictLevelOrder = [0, 1, 2, 3, 4, 5] as const;
const cleanPanelsLevelOrder = [0, 1, 2, 3] as const;
const farmingBoostLevelOrder = [0, 1, 2, 3] as const;
const maintenanceReducerLevelOrder = [0, 1, 2, 3] as const;

export type EdictLevel = typeof edictLevelOrder[number];
export type CleanPanelsLevel = typeof cleanPanelsLevelOrder[number];
export type FarmingBoostLevel = typeof farmingBoostLevelOrder[number];
export type MaintenanceReducerLevel = typeof maintenanceReducerLevelOrder[number];

interface EdictLevelDefinition {
  level: EdictLevel;
  label: string;
  effect: string;
  unityCostPerCycle: number;
  unityProductionPerCycle?: number;
  unityProductionIncreasePercent?: number;
  unityProductionServiceId?: "householdGoods" | "householdAppliances" | "consumerElectronics";
  modeledEffects?: {
    foodConsumptionPercent?: number;
    recyclingEfficiencyIncreasePercent?: number;
    solarPowerIncreasePercent?: number;
    cropYieldIncreasePercent?: number;
    cropWaterDemandIncreasePercent?: number;
    waterDemandReductionPercent?: number;
    maintenanceDemandReductionPercent?: number;
    researchEfficiencyBonusPercent?: number;
  };
}

export type EdictId =
  | "growthPause"
  | "growthBoost"
  | "eviction"
  | "quarantine"
  | "foodSaver"
  | "healthBoost"
  | "plentyOfFood"
  | "moreHouseholdGoods"
  | "moreAirConditioners"
  | "moreConsumerElectronics"
  | "vehiclesFuelSaver"
  | "shipsFuelSaver"
  | "overloadedTrucks"
  | "maintenanceReducer"
  | "recyclingIncrease"
  | "farmingBoost"
  | "waterSaver"
  | "cleanPanels"
  | "researchEfficiency";

export interface EdictDefinition {
  id: EdictId;
  name: string;
  category: "population" | "industrial";
  levels: readonly EdictLevelDefinition[];
}

const level = (
  value: EdictLevel,
  label: string,
  effect: string,
  unityCostPerCycle: number,
  details?: Pick<EdictLevelDefinition, "unityProductionPerCycle" | "unityProductionIncreasePercent" | "unityProductionServiceId" | "modeledEffects">,
): EdictLevelDefinition => ({ level: value, label, effect, unityCostPerCycle, ...details });

const off = level(0, "0", "Inactive", 0);
const binaryOff = level(0, "Off", "Inactive", 0);

/** Captain of Industry v0.8.7 edict values. Tier values are cumulative. */
export const edictCatalog: readonly EdictDefinition[] = [
  { id: "growthPause", name: "Growth Pause", category: "population", levels: [binaryOff, level(1, "On", "Population growth paused", 0)] },
  { id: "growthBoost", name: "Growth Boost", category: "population", levels: [off, level(1, "I", "+0.4% population growth", 1), level(2, "II", "+0.6% population growth", 2), level(3, "III", "+0.8% population growth", 3)] },
  { id: "eviction", name: "Eviction", category: "population", levels: [binaryOff, level(1, "On", "4% of population leaves per cycle", 2)] },
  { id: "quarantine", name: "Quarantine", category: "population", levels: [binaryOff, level(1, "On", "-40% disease impact · -20% workforce", 1)] },
  { id: "foodSaver", name: "Food Saver", category: "population", levels: [off, level(1, "I", "-20% food consumption", 1, { modeledEffects: { foodConsumptionPercent: -20 } }), level(2, "II", "-30% food consumption", 2, { modeledEffects: { foodConsumptionPercent: -30 } })] },
  { id: "healthBoost", name: "Health Boost", category: "population", levels: [off, level(1, "I", "+10 health", 1), level(2, "II", "+20 health", 2)] },
  { id: "plentyOfFood", name: "Plenty of Food", category: "population", levels: [off, level(1, "I", "+20% food consumption · +1 Unity", 0, { unityProductionPerCycle: 1, modeledEffects: { foodConsumptionPercent: 20 } }), level(2, "II", "+40% food consumption · +2 Unity", 0, { unityProductionPerCycle: 2, modeledEffects: { foodConsumptionPercent: 40 } })] },
  { id: "moreHouseholdGoods", name: "More Household Goods", category: "population", levels: [off, level(1, "I", "+20% consumption · +15% service Unity", 0, { unityProductionIncreasePercent: 15, unityProductionServiceId: "householdGoods" }), level(2, "II", "+40% consumption · +30% service Unity", 0, { unityProductionIncreasePercent: 30, unityProductionServiceId: "householdGoods" }), level(3, "III", "+70% consumption · +45% service Unity", 0, { unityProductionIncreasePercent: 45, unityProductionServiceId: "householdGoods" })] },
  { id: "moreAirConditioners", name: "More Household Appliances", category: "population", levels: [off, level(1, "I", "+20% consumption · +15% service Unity", 0, { unityProductionIncreasePercent: 15, unityProductionServiceId: "householdAppliances" }), level(2, "II", "+40% consumption · +30% service Unity", 0, { unityProductionIncreasePercent: 30, unityProductionServiceId: "householdAppliances" }), level(3, "III", "+70% consumption · +45% service Unity", 0, { unityProductionIncreasePercent: 45, unityProductionServiceId: "householdAppliances" })] },
  { id: "moreConsumerElectronics", name: "More Consumer Electronics", category: "population", levels: [off, level(1, "I", "+20% consumption · +15% service Unity", 0, { unityProductionIncreasePercent: 15, unityProductionServiceId: "consumerElectronics" }), level(2, "II", "+40% consumption · +30% service Unity", 0, { unityProductionIncreasePercent: 30, unityProductionServiceId: "consumerElectronics" }), level(3, "III", "+70% consumption · +45% service Unity", 0, { unityProductionIncreasePercent: 45, unityProductionServiceId: "consumerElectronics" })] },
  { id: "vehiclesFuelSaver", name: "Vehicles Fuel Saver", category: "industrial", levels: [off, level(1, "I", "-15% vehicle fuel consumption", 1), level(2, "II", "-25% vehicle fuel consumption", 3)] },
  { id: "shipsFuelSaver", name: "Ships Fuel Saver", category: "industrial", levels: [off, level(1, "I", "-10% cargo ship fuel consumption", 1)] },
  { id: "overloadedTrucks", name: "Overloaded Trucks", category: "industrial", levels: [off, level(1, "I", "+15% capacity · +20% maintenance", 0.5), level(2, "II", "+30% capacity · +40% maintenance", 1.5)] },
  { id: "maintenanceReducer", name: "Maintenance Reducer", category: "industrial", levels: [off, level(1, "I", "-15% maintenance demand", 1, { modeledEffects: { maintenanceDemandReductionPercent: 15 } }), level(2, "II", "-25% maintenance demand", 2, { modeledEffects: { maintenanceDemandReductionPercent: 25 } }), level(3, "III", "-30% maintenance demand", 3, { modeledEffects: { maintenanceDemandReductionPercent: 30 } })] },
  { id: "recyclingIncrease", name: "Recycling Increase", category: "industrial", levels: [off, level(1, "I", "+12% recycling efficiency", 1, { modeledEffects: { recyclingEfficiencyIncreasePercent: 12 } }), level(2, "II", "+22% recycling efficiency", 2, { modeledEffects: { recyclingEfficiencyIncreasePercent: 22 } }), level(3, "III", "+30% recycling efficiency", 3.5, { modeledEffects: { recyclingEfficiencyIncreasePercent: 30 } }), level(4, "IV", "+35% recycling efficiency", 5, { modeledEffects: { recyclingEfficiencyIncreasePercent: 35 } }), level(5, "V", "+40% recycling efficiency", 7, { modeledEffects: { recyclingEfficiencyIncreasePercent: 40 } })] },
  { id: "farmingBoost", name: "Farming Boost", category: "industrial", levels: [off, level(1, "I", "+15% crop yield and water demand", 1, { modeledEffects: { cropYieldIncreasePercent: 15, cropWaterDemandIncreasePercent: 15 } }), level(2, "II", "+27% crop yield and water demand", 2, { modeledEffects: { cropYieldIncreasePercent: 27, cropWaterDemandIncreasePercent: 27 } }), level(3, "III", "+35% crop yield and water demand", 3, { modeledEffects: { cropYieldIncreasePercent: 35, cropWaterDemandIncreasePercent: 35 } })] },
  { id: "waterSaver", name: "Water Saver", category: "industrial", levels: [off, level(1, "I", "-15% settlement and farm water demand", 1, { modeledEffects: { waterDemandReductionPercent: 15 } }), level(2, "II", "-27% settlement and farm water demand", 2, { modeledEffects: { waterDemandReductionPercent: 27 } }), level(3, "III", "-35% settlement and farm water demand", 3, { modeledEffects: { waterDemandReductionPercent: 35 } })] },
  { id: "cleanPanels", name: "Clean Panels", category: "industrial", levels: [off, level(1, "I", "+5% solar power", 0.5, { modeledEffects: { solarPowerIncreasePercent: 5 } }), level(2, "II", "+15% solar power", 1.5, { modeledEffects: { solarPowerIncreasePercent: 15 } }), level(3, "III", "+30% solar power", 2.5, { modeledEffects: { solarPowerIncreasePercent: 30 } })] },
  { id: "researchEfficiency", name: "Research Efficiency", category: "industrial", levels: [off, level(1, "I", "+15% research efficiency", 1, { modeledEffects: { researchEfficiencyBonusPercent: 15 } }), level(2, "II", "+25% research efficiency", 2, { modeledEffects: { researchEfficiencyBonusPercent: 25 } }), level(3, "III", "+35% research efficiency", 3, { modeledEffects: { researchEfficiencyBonusPercent: 35 } }), level(4, "IV", "+45% research efficiency", 4, { modeledEffects: { researchEfficiencyBonusPercent: 45 } }), level(5, "V", "+60% research efficiency", 6, { modeledEffects: { researchEfficiencyBonusPercent: 60 } })] },
];

export const getEdict = (id: EdictId): EdictDefinition => {
  const edict = edictCatalog.find((candidate) => candidate.id === id);

  if (!edict) throw new Error(`Unknown edict: ${id}`);

  return edict;
};

export const mapEdictValues = <T>(getValue: (id: EdictId) => T) => ({
  growthPause: getValue("growthPause"),
  growthBoost: getValue("growthBoost"),
  eviction: getValue("eviction"),
  quarantine: getValue("quarantine"),
  foodSaver: getValue("foodSaver"),
  healthBoost: getValue("healthBoost"),
  plentyOfFood: getValue("plentyOfFood"),
  moreHouseholdGoods: getValue("moreHouseholdGoods"),
  moreAirConditioners: getValue("moreAirConditioners"),
  moreConsumerElectronics: getValue("moreConsumerElectronics"),
  vehiclesFuelSaver: getValue("vehiclesFuelSaver"),
  shipsFuelSaver: getValue("shipsFuelSaver"),
  overloadedTrucks: getValue("overloadedTrucks"),
  maintenanceReducer: getValue("maintenanceReducer"),
  recyclingIncrease: getValue("recyclingIncrease"),
  farmingBoost: getValue("farmingBoost"),
  waterSaver: getValue("waterSaver"),
  cleanPanels: getValue("cleanPanels"),
  researchEfficiency: getValue("researchEfficiency"),
});

export const defaultEdictLevels: Record<EdictId, EdictLevel> = {
  growthPause: 0,
  growthBoost: 0,
  eviction: 0,
  quarantine: 0,
  foodSaver: 0,
  healthBoost: 0,
  plentyOfFood: 2,
  moreHouseholdGoods: 0,
  moreAirConditioners: 0,
  moreConsumerElectronics: 0,
  vehiclesFuelSaver: 0,
  shipsFuelSaver: 0,
  overloadedTrucks: 0,
  maintenanceReducer: 3,
  recyclingIncrease: 5,
  farmingBoost: 1,
  waterSaver: 0,
  cleanPanels: 0,
  researchEfficiency: 5,
};

/** Inactive state used until the exporter has supplied save-owned edicts. */
const inactiveEdictLevels: Record<EdictId, EdictLevel> = {
  growthPause: 0,
  growthBoost: 0,
  eviction: 0,
  quarantine: 0,
  foodSaver: 0,
  healthBoost: 0,
  plentyOfFood: 0,
  moreHouseholdGoods: 0,
  moreAirConditioners: 0,
  moreConsumerElectronics: 0,
  vehiclesFuelSaver: 0,
  shipsFuelSaver: 0,
  overloadedTrucks: 0,
  maintenanceReducer: 0,
  recyclingIncrease: 0,
  farmingBoost: 0,
  waterSaver: 0,
  cleanPanels: 0,
  researchEfficiency: 0,
};

/** Future policy levels applied until the current synced value reaches them. */
export const plannedEdictLevels: Partial<Record<EdictId, EdictLevel>> = {
  recyclingIncrease: 5,
};

export const resolveEdictLevel = (
  id: EdictId,
  synced?: EdictLevel,
): ResolvedValue<EdictLevel> => {
  const layers = {
    default: inactiveEdictLevels[id],
    synced,
  };
  const target = plannedEdictLevels[id];

  if (target === undefined) return resolveCurrentLayeredValue(layers);

  const resolved = resolveDirectionalPlan(layers, {
    direction: "at-least",
    target,
  });
  const value = edictLevelOrder.find((level) => level === resolved.value) ?? layers.default;

  return { source: resolved.source, value };
};

const getLevel = (id: EdictId, value: EdictLevel): EdictLevelDefinition => {
  const edict = getEdict(id);
  const definition = edict.levels.find((candidate) => candidate.level === value)
    ?? edict.levels.at(0);

  if (!definition) throw new Error(`Edict has no levels: ${id}`);

  return definition;
};

export const normalizeCleanPanelsLevel = (value: EdictLevel): CleanPanelsLevel => (
  cleanPanelsLevelOrder.find((candidate) => candidate === value) ?? 0
);

export const normalizeFarmingBoostLevel = (value: EdictLevel): FarmingBoostLevel => (
  farmingBoostLevelOrder.find((candidate) => candidate === value) ?? 0
);

export const normalizeMaintenanceReducerLevel = (value: EdictLevel): MaintenanceReducerLevel => (
  maintenanceReducerLevelOrder.find((candidate) => candidate === value) ?? 0
);

const withRecyclingEffect = (value: EdictLevel) => {
  const definition = getLevel("recyclingIncrease", value);

  return {
    ...definition,
    efficiencyIncreasePercent: definition.modeledEffects?.recyclingEfficiencyIncreasePercent ?? 0,
  };
};

const withSolarEffect = (value: CleanPanelsLevel) => {
  const definition = getLevel("cleanPanels", value);

  return {
    ...definition,
    powerIncreasePercent: definition.modeledEffects?.solarPowerIncreasePercent ?? 0,
  };
};

const withFarmingEffect = (value: FarmingBoostLevel) => {
  const definition = getLevel("farmingBoost", value);

  return {
    ...definition,
    yieldIncreasePercent: definition.modeledEffects?.cropYieldIncreasePercent ?? 0,
    waterDemandIncreasePercent: definition.modeledEffects?.cropWaterDemandIncreasePercent ?? 0,
  };
};

const withMaintenanceEffect = (value: MaintenanceReducerLevel) => {
  const definition = getLevel("maintenanceReducer", value);

  return {
    ...definition,
    maintenanceReductionPercent: definition.modeledEffects?.maintenanceDemandReductionPercent ?? 0,
  };
};

// Compatibility exports for the calculation helpers that apply modeled effects.
export const recyclingIncreaseEdict = {
  id: "recyclingIncrease",
  name: getEdict("recyclingIncrease").name,
  levels: {
    0: withRecyclingEffect(0),
    1: withRecyclingEffect(1),
    2: withRecyclingEffect(2),
    3: withRecyclingEffect(3),
    4: withRecyclingEffect(4),
    5: withRecyclingEffect(5),
  },
};

export const cleanPanelsEdict = {
  id: "cleanPanels",
  name: getEdict("cleanPanels").name,
  levels: {
    0: withSolarEffect(0),
    1: withSolarEffect(1),
    2: withSolarEffect(2),
    3: withSolarEffect(3),
  },
};

export const farmingBoostEdict = {
  id: "farmingBoost",
  name: getEdict("farmingBoost").name,
  levels: {
    0: withFarmingEffect(0),
    1: withFarmingEffect(1),
    2: withFarmingEffect(2),
    3: withFarmingEffect(3),
  },
};

export const maintenanceReducerEdict = {
  id: "maintenanceReducer",
  name: getEdict("maintenanceReducer").name,
  levels: {
    0: withMaintenanceEffect(0),
    1: withMaintenanceEffect(1),
    2: withMaintenanceEffect(2),
    3: withMaintenanceEffect(3),
  },
};

export const defaultActiveEdicts = {
  recyclingIncrease: 4,
  cleanPanels: 0,
  farmingBoost: 1,
  maintenanceReducer: 3,
} as const satisfies {
  recyclingIncrease: EdictLevel;
  cleanPanels: CleanPanelsLevel;
  farmingBoost: FarmingBoostLevel;
  maintenanceReducer: MaintenanceReducerLevel;
};
