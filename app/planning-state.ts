import { edictCatalog, type EdictId } from './db/edict-catalog'
import { researchCatalog, type InfiniteResearchId } from './db/research-catalog'
import { type FactoryDefinitions, isFactoryDefinitions } from './factory-definitions'

export interface PlanningEffect {
  id: string
  percent: number
}
export interface ResearchDefinition {
  id: InfiniteResearchId
  description: string
  spaceResearchLevel: number
  costs: number[]
  effects: PlanningEffect[]
}
export interface NativeEdictDefinition {
  id: EdictId
  level: number
  description: string
  unityCost: number
  effects: PlanningEffect[]
}
export interface NativeHousingDefinition {
  prototypeId: string
  capacity: number
  unityStorage: number
  needs: PlanningEffect[]
  unityTiers: { percent: number; needs: string[] }[]
}
export interface SettlementDefinitions {
  waterPerPop: number
  wasteWaterPerPop: number
  electricityKwPerPop: number
  goodsPerPop: number
  medicalPerHundredPops: number
  baseWastePerPop: number
  foods: { productId: string; categoryId: string; perHundredPops: number }[]
  biomassPerProduct: { productId: string; quantity: number }[]
}
export interface ComputingDefinitions {
  rackCapacity: number
  computingPerRack: number
  coolantInProductId: string
  coolantOutProductId: string
  coolantInPerRack: number
  coolantOutPerRack: number
  chillerInputs: { productId: string; quantity: number }[]
  chillerOutputs: { productId: string; quantity: number }[]
}
export interface PlanningDefinitions {
  factory: FactoryDefinitions
  computing: ComputingDefinitions
  unityBaseCapacity: number
  settlement: SettlementDefinitions
  research: ResearchDefinition[]
  edicts: NativeEdictDefinition[]
  solar: { prototypeId: string; productionKw: number; outputKw: number }[]
  housing: NativeHousingDefinition[]
  statue: { fuelProductId: string; fuelPerCycle: number; reductionsByCount: number[] }
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const integer = (v: unknown): v is number => amount(v) && Number.isSafeInteger(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const effects = (v: unknown): v is PlanningEffect[] =>
  Array.isArray(v) &&
  v.length <= 100 &&
  v.every(
    e => record(e) && text(e.id) && typeof e.percent === 'number' && Number.isFinite(e.percent),
  ) &&
  new Set(v.map(e => e.id)).size === v.length
const researchId = (v: unknown): v is InfiniteResearchId => researchCatalog.some(r => r.id === v)
const edictId = (v: unknown): v is EdictId => edictCatalog.some(e => e.id === v)
const research = (v: unknown): v is ResearchDefinition =>
  record(v) &&
  researchId(v.id) &&
  typeof v.description === 'string' &&
  Array.isArray(v.costs) &&
  v.costs.length > 1 &&
  v.costs.length <= 10001 &&
  v.costs[0] === 0 &&
  v.costs.every((n, i, a) => integer(n) && (i === 0 || n >= a[i - 1])) &&
  integer(v.spaceResearchLevel) &&
  v.spaceResearchLevel < v.costs.length &&
  effects(v.effects)
const edict = (v: unknown): v is NativeEdictDefinition =>
  record(v) &&
  edictId(v.id) &&
  integer(v.level) &&
  v.level > 0 &&
  v.level <= 5 &&
  typeof v.description === 'string' &&
  typeof v.unityCost === 'number' &&
  Number.isFinite(v.unityCost) &&
  effects(v.effects)
const housing = (v: unknown): v is NativeHousingDefinition =>
  record(v) &&
  text(v.prototypeId) &&
  integer(v.capacity) &&
  v.capacity > 0 &&
  amount(v.unityStorage) &&
  effects(v.needs) &&
  Array.isArray(v.unityTiers) &&
  v.unityTiers.length <= 100 &&
  v.unityTiers.every(
    t =>
      record(t) &&
      amount(t.percent) &&
      Array.isArray(t.needs) &&
      t.needs.length > 0 &&
      t.needs.every(text),
  )

export const isPlanningDefinitions = (value: unknown): value is PlanningDefinitions => {
  if (
    !record(value) ||
    !isFactoryDefinitions(value.factory) ||
    !amount(value.unityBaseCapacity) ||
    !record(value.settlement) ||
    !record(value.computing) ||
    !Array.isArray(value.research) ||
    !Array.isArray(value.edicts) ||
    !Array.isArray(value.solar) ||
    !Array.isArray(value.housing) ||
    !record(value.statue)
  )
    return false
  const computing = value.computing
  const products = (values: unknown) =>
    Array.isArray(values) &&
    values.length > 0 &&
    values.length <= 100 &&
    values.every(p => record(p) && text(p.productId) && amount(p.quantity)) &&
    new Set(values.map(p => p.productId)).size === values.length

  if (
    !integer(computing.rackCapacity) ||
    computing.rackCapacity <= 0 ||
    !amount(computing.computingPerRack) ||
    computing.computingPerRack <= 0 ||
    !text(computing.coolantInProductId) ||
    !text(computing.coolantOutProductId) ||
    !amount(computing.coolantInPerRack) ||
    !amount(computing.coolantOutPerRack) ||
    !products(computing.chillerInputs) ||
    !products(computing.chillerOutputs)
  )
    return false
  const settlement = value.settlement

  if (
    ![
      'waterPerPop',
      'wasteWaterPerPop',
      'electricityKwPerPop',
      'goodsPerPop',
      'medicalPerHundredPops',
      'baseWastePerPop',
    ].every(key => amount(settlement[key])) ||
    !Array.isArray(settlement.foods) ||
    settlement.foods.length === 0 ||
    settlement.foods.length > 100 ||
    !settlement.foods.every(
      f => record(f) && text(f.productId) && text(f.categoryId) && amount(f.perHundredPops),
    ) ||
    new Set(settlement.foods.map(f => f.productId)).size !== settlement.foods.length ||
    !Array.isArray(settlement.biomassPerProduct) ||
    settlement.biomassPerProduct.length > 10000 ||
    !settlement.biomassPerProduct.every(
      p => record(p) && text(p.productId) && amount(p.quantity),
    ) ||
    new Set(settlement.biomassPerProduct.map(p => p.productId)).size !==
      settlement.biomassPerProduct.length
  )
    return false
  const data = {
    research: value.research,
    edicts: value.edicts,
    housing: value.housing,
    solar: value.solar,
    statue: value.statue,
  }

  const researchDefinitions = data.research.filter(research)
  const crop = researchDefinitions.find(r => r.id === 'cropYield')

  if (!crop?.effects.some(e => e.id === 'FarmWaterConsumptionMultiplier')) return false

  if (
    researchDefinitions.length !== data.research.length ||
    !data.edicts.every(edict) ||
    !data.housing.every(housing)
  )
    return false
  if (
    researchDefinitions.length !== researchCatalog.length ||
    !researchCatalog.every(
      r =>
        researchDefinitions.filter(d => d.id === r.id && d.effects.some(e => e.id === r.propertyId))
          .length === 1,
    )
  )
    return false
  if (
    data.edicts.some(
      d =>
        !edictCatalog
          .find(e => e.id === d.id)
          ?.effectIds.every(id => d.effects.some(effect => effect.id === id)),
    )
  )
    return false
  if (
    data.edicts.length > 100 ||
    !edictCatalog.every(e => {
      const levels = data.edicts
        .filter(d => d.id === e.id)
        .map(d => d.level)
        .toSorted((a, b) => a - b)

      return levels.length > 0 && levels.every((level, i) => level === i + 1)
    })
  )
    return false
  if (
    data.solar.length !== 2 ||
    !data.solar.every(
      s => record(s) && text(s.prototypeId) && amount(s.productionKw) && amount(s.outputKw),
    ) ||
    !['SolarPanel', 'SolarPanelMono'].every(
      id => data.solar.filter(s => s.prototypeId === id).length === 1,
    )
  )
    return false
  if (
    data.housing.length !== 4 ||
    !['Housing', 'HousingT2', 'HousingT3', 'HousingT4'].every(
      id => data.housing.filter(h => h.prototypeId === id).length === 1,
    )
  )
    return false
  return (
    text(data.statue.fuelProductId) &&
    amount(data.statue.fuelPerCycle) &&
    Array.isArray(data.statue.reductionsByCount) &&
    data.statue.reductionsByCount.length > 1 &&
    data.statue.reductionsByCount.length <= 257 &&
    data.statue.reductionsByCount[0] === 0 &&
    data.statue.reductionsByCount.every(
      (n, i, a) => amount(n) && n <= 100 && (i === 0 || n >= a[i - 1]),
    )
  )
}

export const getResearchDefinition = (definitions: PlanningDefinitions, id: InfiniteResearchId) => {
  const research = definitions.research.find(r => r.id === id)

  if (!research) throw new Error(`Research definition unavailable for ${id}`)
  return research
}

export const getResearchBonus = (
  definitions: PlanningDefinitions,
  id: InfiniteResearchId,
  level: number,
  propertyId?: string,
) => {
  const research = getResearchDefinition(definitions, id)
  const effectId = propertyId ?? researchCatalog.find(r => r.id === id)?.propertyId
  const effect = research.effects.find(e => e.id === effectId)

  if (!effect) throw new Error(`Research effect unavailable for ${id}`)
  const normalizedLevel = Math.min(research.costs.length - 1, Math.max(0, Math.trunc(level)))

  return {
    level: normalizedLevel,
    bonusPercent: normalizedLevel * effect.percent,
    multiplier: 1 + (normalizedLevel * effect.percent) / 100,
  }
}

/** Edict prototypes contain tier increments; the game keeps all lower tiers active. */
export const getEdictEffects = (definitions: PlanningDefinitions, id: EdictId, level: number) => {
  const totals: { unityCost: number; effects: Record<string, number> } = {
    unityCost: 0,
    effects: {},
  }

  for (const tier of definitions.edicts.filter(e => e.id === id && e.level <= level)) {
    totals.unityCost += tier.unityCost
    for (const effect of tier.effects)
      totals.effects[effect.id] = (totals.effects[effect.id] ?? 0) + effect.percent
  }
  return totals
}
