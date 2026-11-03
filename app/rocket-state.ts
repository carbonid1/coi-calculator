import { resolveSyncedResourceId } from './helpers/synced-resources/synced-resources'

export interface RocketProduct {
  productId: string
  name: string
  quantity: number
}

export interface RocketIiDefinition {
  /** Effective capacities, including the save's current research. */
  cargoCapacity: number
  crewCapacity: number
  capacityBonusPercent: number
  buildCycles: number
  crewRotationCycles: number
  buildInputs: RocketProduct[]
  launchInputs: RocketProduct[]
  compositePanelInputs: RocketProduct[]
  compositePanelOutput: number
}

const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const positive = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
)
const product = (value: unknown): value is RocketProduct => record(value)
  && typeof value.productId === 'string' && value.productId.length > 0
  && typeof value.name === 'string' && positive(value.quantity)
  && resolveSyncedResourceId({ productId: value.productId, name: value.name }) !== undefined
const products = (value: unknown): value is RocketProduct[] => Array.isArray(value)
  && value.length > 0 && value.every(product)
  && new Set(value.map(entry => resolveSyncedResourceId(entry))).size === value.length

export const isRocketIiDefinition = (value: unknown): value is RocketIiDefinition => record(value)
  && positive(value.cargoCapacity) && Number.isSafeInteger(value.cargoCapacity)
  && positive(value.crewCapacity) && Number.isSafeInteger(value.crewCapacity)
  && typeof value.capacityBonusPercent === 'number' && Number.isFinite(value.capacityBonusPercent)
  && value.capacityBonusPercent >= 0
  && positive(value.buildCycles) && positive(value.crewRotationCycles)
  && products(value.buildInputs) && products(value.launchInputs)
  && products(value.compositePanelInputs) && positive(value.compositePanelOutput)
