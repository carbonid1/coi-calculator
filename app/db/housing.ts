import { type PlanningDefinitions } from '../planning-state'

export interface HousingType {
  id: 'housing' | 'housing-ii' | 'housing-iii' | 'housing-iv'
  name: string
  populationCapacity: number
  unityStorage: number
  serviceDemandMultipliers: {
    electricity: number
    water: number
    wasteWater: number
    householdGoods: number
    householdAppliances: number
    luxuryGoods: number
  }
  unityBonusTiers: readonly {
    multiplier: number
    requirements: readonly string[]
  }[]
}

export const housingCatalog = {
  housing: { id: 'housing', name: 'Housing', prototypeId: 'Housing' },
  housingII: { id: 'housing-ii', name: 'Housing II', prototypeId: 'HousingT2' },
  housingIII: { id: 'housing-iii', name: 'Housing III', prototypeId: 'HousingT3' },
  housingIV: { id: 'housing-iv', name: 'Housing IV', prototypeId: 'HousingT4' },
} as const

export const getHousingTypes = (definitions: PlanningDefinitions) => {
  const resolve = (identity: (typeof housingCatalog)[keyof typeof housingCatalog]): HousingType => {
    const native = definitions.housing.find(h => h.prototypeId === identity.prototypeId)

    if (!native) throw new Error('Housing definition unavailable for ' + identity.prototypeId)
    const demand = (id: string) => 1 + (native.needs.find(n => n.id === id)?.percent ?? 0) / 100

    return {
      ...identity,
      populationCapacity: native.capacity,
      unityStorage: native.unityStorage,
      serviceDemandMultipliers: {
        electricity: demand('PowerNeed'),
        water: demand('WaterNeed'),
        wasteWater: demand('WaterNeed'),
        householdGoods: demand('HouseholdGoodsNeed'),
        householdAppliances: demand('HouseholdAppliancesNeed'),
        luxuryGoods: demand('LuxuryGoodsNeed'),
      },
      unityBonusTiers: native.unityTiers
        .map(t => ({ multiplier: 1 + t.percent / 100, requirements: t.needs }))
        .toSorted((a, b) => a.multiplier - b.multiplier),
    }
  }

  return {
    housing: resolve(housingCatalog.housing),
    housingII: resolve(housingCatalog.housingII),
    housingIII: resolve(housingCatalog.housingIII),
    housingIV: resolve(housingCatalog.housingIV),
  }
}

export const activeHousingServices = {
  householdGoods: true,
  householdAppliances: false,
  consumerElectronics: false,
} as const
export const calculatePopulationCapacity = (
  housing: HousingType,
  buildingCount: number,
  capacityMultiplier = 1,
) =>
  Math.round(housing.populationCapacity * capacityMultiplier) *
  Math.max(0, Math.trunc(buildingCount))
