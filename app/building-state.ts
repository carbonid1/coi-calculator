export interface BuildingDefinition {
  id: string
  name: string
  workers: number
  electricityKw: number
  computingTflops: number
  unityPerCycle: number
  /** Raw native monthly upkeep; absent in older cached snapshots. */
  maintenance?: { productId: string | null; perMonth: number }
}

export interface MaintenancePlanningData {
  consumptionMultiplier: number
  idleMultiplier: number
}

const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const isMaintenancePlanningData = (value: unknown): value is MaintenancePlanningData => (
  value !== null && typeof value === 'object'
  && 'consumptionMultiplier' in value && amount(value.consumptionMultiplier)
  && 'idleMultiplier' in value && amount(value.idleMultiplier) && value.idleMultiplier <= 1
)

const isMaintenance = (value: unknown) => (
  value !== null && typeof value === 'object'
  && 'perMonth' in value && amount(value.perMonth) && 'productId' in value
  && (value.productId === null || value.productId === '__PHANTOM__VIRTUAL__' ? value.perMonth === 0
    : typeof value.productId === 'string'
      && ['Product_Virtual_MaintenanceT1', 'Product_Virtual_MaintenanceT2', 'Product_Virtual_MaintenanceT3'].includes(value.productId))
)

export const isBuildingDefinitions = (value: unknown): value is BuildingDefinition[] => (
  Array.isArray(value)
  && value.every(definition => definition !== null && typeof definition === 'object'
    && typeof definition.id === 'string' && definition.id.length > 0
    && typeof definition.name === 'string' && definition.name.length > 0
    && amount(definition.workers) && Number.isInteger(definition.workers)
    && amount(definition.electricityKw) && amount(definition.computingTflops) && amount(definition.unityPerCycle)
    && (definition.maintenance === undefined || isMaintenance(definition.maintenance)))
  && new Set(value.map(definition => definition.id)).size === value.length
)
