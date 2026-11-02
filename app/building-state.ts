export interface BuildingDefinition {
  id: string
  name: string
  workers: number
  electricityKw: number
  computingTflops: number
  unityPerCycle: number
}

const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const isBuildingDefinitions = (value: unknown): value is BuildingDefinition[] => (
  Array.isArray(value)
  && value.every(definition => definition !== null && typeof definition === 'object'
    && typeof definition.id === 'string' && definition.id.length > 0
    && typeof definition.name === 'string' && definition.name.length > 0
    && amount(definition.workers) && Number.isInteger(definition.workers)
    && amount(definition.electricityKw) && amount(definition.computingTflops) && amount(definition.unityPerCycle))
  && new Set(value.map(definition => definition.id)).size === value.length
)
