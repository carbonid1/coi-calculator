export type ProductKind = 'countable' | 'fluid' | 'loose' | 'molten' | 'virtual'

export interface GameProduct {
  id: string
  name: string
  kind: ProductKind
  isUnlocked: boolean
}

export interface ProductInventory {
  quantity: number
  stored: number
  storageCapacity: number
}

export interface NativeProducts {
  gameId: string
  sessionId: string
  catalog: GameProduct[]
  inventory: Record<string, ProductInventory>
}

const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const quantity = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const kind = (value: unknown): value is ProductKind => (
  value === 'countable' || value === 'fluid' || value === 'loose' || value === 'molten' || value === 'virtual'
)
const product = (value: unknown): value is GameProduct => record(value)
  && identifier(value.id) && identifier(value.name) && kind(value.kind) && typeof value.isUnlocked === 'boolean'
const inventory = (value: unknown): value is ProductInventory => record(value)
  && quantity(value.quantity) && quantity(value.stored) && quantity(value.storageCapacity)

export const isGameIdentity = (value: unknown): value is Record<string, unknown> & { gameId: string; sessionId: string } => record(value)
  && typeof value.gameId === 'string' && /^-?\d+$/.test(value.gameId)
  && typeof value.sessionId === 'string' && /^-?\d+$/.test(value.sessionId)

export const isNativeProducts = (value: unknown): value is NativeProducts => {
  if (!isGameIdentity(value) || !record(value) || !Array.isArray(value.catalog) || !value.catalog.every(product)
    || !record(value.inventory) || !Object.values(value.inventory).every(inventory)) return false
  const ids = new Set(value.catalog.map(entry => entry.id))

  return ids.size === value.catalog.length && Object.keys(value.inventory).every(id => ids.has(id))
}

/** Native amounts are island totals, never a substitute for eligible reserve storage. */
export const normalizeNativeProducts = (
  catalog: unknown,
  stocks: unknown,
  identity: { gameId: string; sessionId: string },
): NativeProducts | null => {
  if (!record(catalog) || !record(stocks) || !Array.isArray(catalog.unknownIds)
    || catalog.unknownIds.length > 0 || !Array.isArray(stocks.unknownIds) || stocks.unknownIds.length > 0) return null
  const result = { gameId: identity.gameId, sessionId: identity.sessionId, catalog: catalog.products, inventory: stocks.products }

  return isNativeProducts(result) ? result : null
}
