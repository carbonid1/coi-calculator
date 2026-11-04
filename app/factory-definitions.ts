import { factoryRecipeBindings } from './db/recipe-bindings'
import { type SyncedContractState } from './game-state'

export interface NativeFactoryRecipe {
  buildingId: string
  recipeId: string
  durationSeconds: number
  electricityMultiplier: number
  electricityOutputMw: number
  recyclesInputs: boolean
  storageCapacity: number
  inputs: { productId: string; quantity: number }[]
  outputs: { productId: string; quantity: number }[]
}
export interface FactoryDefinitions {
  rainwaterPerDay: number
  recipes: NativeFactoryRecipe[]
  contracts: SyncedContractState['established']
  labSpacePoints: { buildingId: string; perCycle: number }[]
  populationResearch: { numerator: number; rounding: number; denominator: number }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const integer = (v: unknown): v is number => amount(v) && Number.isSafeInteger(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const products = (values: unknown) =>
  Array.isArray(values) &&
  values.length <= 100 &&
  values.every(p => record(p) && text(p.productId) && amount(p.quantity))
const product = (value: unknown) => record(value) && text(value.productId) && text(value.name)

export const isFactoryDefinitions = (value: unknown): value is FactoryDefinitions => {
  if (
    !record(value) ||
    !amount(value.rainwaterPerDay) ||
    !Array.isArray(value.recipes) ||
    value.recipes.length === 0 ||
    value.recipes.length > 10000 ||
    !value.recipes.every(
      r =>
        record(r) &&
        text(r.buildingId) &&
        text(r.recipeId) &&
        amount(r.durationSeconds) &&
        r.durationSeconds > 0 &&
        amount(r.electricityMultiplier) &&
        amount(r.electricityOutputMw) &&
        typeof r.recyclesInputs === 'boolean' &&
        integer(r.storageCapacity) &&
        products(r.inputs) &&
        products(r.outputs),
    ) ||
    new Set(value.recipes.map(r => r.buildingId + ':' + r.recipeId)).size !== value.recipes.length
  )
    return false
  const recipeIds = new Set(value.recipes.map(r => r.buildingId + ':' + r.recipeId))

  if (
    !Object.values(factoryRecipeBindings).every(binding =>
      recipeIds.has(binding.buildingId + ':' + binding.recipeId),
    )
  )
    return false
  if (
    !Array.isArray(value.contracts) ||
    value.contracts.length > 10000 ||
    !value.contracts.every(
      c =>
        record(c) &&
        text(c.gameId) &&
        product(c.exportedProduct) &&
        product(c.importedProduct) &&
        integer(c.exportedQuantity) &&
        c.exportedQuantity > 0 &&
        integer(c.importedQuantity) &&
        c.importedQuantity > 0 &&
        amount(c.unityPerCycle) &&
        amount(c.unityPer100Imported) &&
        amount(c.unityToEstablish) &&
        integer(c.minimumReputation),
    ) ||
    new Set(value.contracts.map(c => c.gameId)).size !== value.contracts.length
  )
    return false
  const labs = value.labSpacePoints

  return (
    Array.isArray(labs) &&
    labs.length > 0 &&
    labs.length <= 100 &&
    labs.every(l => record(l) && text(l.buildingId) && amount(l.perCycle)) &&
    new Set(labs.map(l => l.buildingId)).size === labs.length &&
    ['ResearchLab4', 'ResearchLab5'].every(id => labs.some(l => l.buildingId === id)) &&
    record(value.populationResearch) &&
    integer(value.populationResearch.numerator) &&
    integer(value.populationResearch.rounding) &&
    integer(value.populationResearch.denominator) &&
    value.populationResearch.denominator > 0
  )
}

const indexes = new WeakMap<FactoryDefinitions, Map<string, NativeFactoryRecipe>>()

export const getFactoryRecipe = (
  definitions: FactoryDefinitions,
  buildingId: string,
  recipeId: string,
) => {
  const index =
    indexes.get(definitions) ??
    new Map(definitions.recipes.map(r => [r.buildingId + ':' + r.recipeId, r]))

  indexes.set(definitions, index)
  const recipe = index.get(buildingId + ':' + recipeId)

  if (!recipe) throw new Error('Recipe definition unavailable for ' + buildingId + ':' + recipeId)
  return recipe
}

export const getLabSpacePoints = (definitions: FactoryDefinitions, buildingId: string) => {
  const lab = definitions.labSpacePoints.find(l => l.buildingId === buildingId)

  if (!lab) throw new Error('Research Lab definition unavailable for ' + buildingId)
  return lab.perCycle
}
