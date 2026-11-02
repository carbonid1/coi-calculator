import { type BuildingDefinition } from '../building-state'
import { activeHousingType, housingTypes } from "./housing";
import { settlementConfig } from "./settlement";
import { calculateSpaceStationLevel, defaultSpaceStationLevel } from "./space-station";

export interface BuildingData {
  prototypeId?: string;
  workers: number;
  electricityKw: number;
  /** Omit automatic pause advice for this building. */
  suppressPauseAttention?: boolean;
  /** Full-load computing demand. Capacity providers leave this at zero. */
  computingTflops?: number;
  /** Recurring Unity demand while the building is operating. */
  unityPerCycle?: number;
}

const syntheticBuildings: Record<string, BuildingData> = {
  [activeHousingType.name]: { workers: 0, electricityKw: activeHousingType.populationCapacity * settlementConfig.electricityKwPerPop * activeHousingType.serviceDemandMultipliers.electricity },
  [housingTypes.housingII.name]: { workers: 0, electricityKw: housingTypes.housingII.populationCapacity * settlementConfig.electricityKwPerPop * housingTypes.housingII.serviceDemandMultipliers.electricity },
  'Space Station I': { workers: calculateSpaceStationLevel(1).crew, electricityKw: 0 },
  'Space Station II': { workers: calculateSpaceStationLevel(2).crew, electricityKw: 0 },
  'Space Station III': { workers: calculateSpaceStationLevel(3).crew, electricityKw: 0 },
  'Space Station IV': { workers: defaultSpaceStationLevel.crew, electricityKw: 0 },
  'Space Station Orbital Research': { workers: 0, electricityKw: 0, suppressPauseAttention: true },
  Vehicles: { workers: 1, electricityKw: 0 },
  'Terrain Dump': { workers: 0, electricityKw: 0 },
  'Eligible Storage': { workers: 0, electricityKw: 0 },
}

/** Stable bindings for calculator labels that differ from prototype names. */
export const buildingPrototypeAliases: Readonly<Record<string, string>> = {
  'Seawater Pump': 'OceanWaterPumpT1',
  'Seawater Pump (Tall)': 'OceanWaterPumpLarge',
  'Groundwater Pump': 'LandWaterPump',
  'Research Lab IV': 'ResearchLab5',
  'Basic Rack': 'BasicServerRack',
  'Power Generator II': 'PowerGeneratorT2',
  'Rubber Maker I': 'VacuumDistillationTower',
  'Clinic I': 'Hospital',
}
const normalize = (name: string) => name.trim().toLocaleLowerCase('en-US')
const quietBuildings = new Set([
  'Super-Pressure Turbine', 'High-Pressure Turbine II', 'Low-Pressure Turbine II',
  'Power Generator II', 'Liquid Dump', 'Smoke stack (large)', 'Cooling Tower (Large)',
].map(normalize))
const catalogCache = new WeakMap<readonly BuildingDefinition[], {
  byId: Map<string, BuildingDefinition>
  byName: Map<string, BuildingDefinition | undefined>
}>()

const getCatalog = (definitions: readonly BuildingDefinition[]) => {
  const cached = catalogCache.get(definitions)

  if (cached) return cached
  const byId = new Map(definitions.map(definition => [definition.id, definition]))
  const byName = new Map<string, BuildingDefinition | undefined>()

  for (const definition of definitions) {
    const name = normalize(definition.name)

    byName.set(name, byName.has(name) ? undefined : definition)
  }
  const catalog = { byId, byName }

  catalogCache.set(definitions, catalog)
  return catalog
}

export const getBuildingData = (
  name: string,
  definitions?: readonly BuildingDefinition[],
  prototypeId?: string,
): BuildingData | undefined => {
  const synthetic = syntheticBuildings[name]

  if (synthetic) return synthetic
  if (!definitions) return undefined
  const catalog = getCatalog(definitions)
  const id = prototypeId ?? buildingPrototypeAliases[name]
  const definition = id ? catalog.byId.get(id) : catalog.byName.get(normalize(name))

  return definition ? { ...definition, prototypeId: definition.id, suppressPauseAttention: quietBuildings.has(normalize(name)) } : undefined
}

export const getRecipeBuildingData = (recipe: { building: string; buildingData?: BuildingData }) => (
  recipe.buildingData ?? getBuildingData(recipe.building)
)
