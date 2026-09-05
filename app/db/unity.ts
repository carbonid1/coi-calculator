import { type EdictId, type EdictLevel, edictCatalog } from './edicts'
import { type HousingType } from './housing'

const baseUnityStorage = 20

export interface UnityBreakdownItem {
  id: string
  name: string
  amount: number
}

export interface UnityBudget {
  generationPerCycle: number | null
  consumptionPerCycle: number
  netPerCycle: number | null
  storageCapacity: number
  generation: UnityBreakdownItem[]
  consumption: UnityBreakdownItem[]
}

interface ContractUnityInput {
  id: string
  name: string
  importedPerCycle: number
  fixedUnityPerCycle: number
  unityPer100Imported: number
}

/** Observed settlement income with the current plan's recurring costs. */
export const calculateUnityBudget = ({
  housing,
  housingCount,
  additionalHousing = [],
  unityCapacityMultiplier,
  settlementUnity,
  edictLevels,
  contracts,
  contractsUnityCostPercent = 0,
  buildingConsumption = [],
  buildingGeneration = [],
}: {
  housing: HousingType
  housingCount: number
  additionalHousing?: { housing: HousingType; housingCount: number }[]
  unityCapacityMultiplier: number
  settlementUnity: readonly UnityBreakdownItem[] | null
  edictLevels: Record<EdictId, EdictLevel>
  contracts: ContractUnityInput[]
  contractsUnityCostPercent?: number
  buildingConsumption?: UnityBreakdownItem[]
  buildingGeneration?: UnityBreakdownItem[]
}): UnityBudget => {
  const edictGeneration = edictCatalog.reduce((total, edict) => {
    const active = edict.levels.find(candidate => candidate.level === edictLevels[edict.id])

    return total + (active?.unityProductionPerCycle ?? 0)
  }, 0)
  const edictConsumption = edictCatalog.reduce((total, edict) => {
    const active = edict.levels.find(candidate => candidate.level === edictLevels[edict.id])

    return total + (active?.unityCostPerCycle ?? 0)
  }, 0)
  // Synced amounts already include housing tiers, coverage, variety and modifiers.
  const generation = [
    ...(settlementUnity ?? []).filter(item => item.amount > 0),
    ...(edictGeneration > 0
      ? [{ id: 'production-edicts', name: 'Edicts', amount: edictGeneration }]
      : []),
    ...buildingGeneration.filter(item => item.amount > 0),
  ]
  const consumption = [
    ...(settlementUnity ?? []).filter(item => item.amount < 0)
      .map(item => ({ ...item, amount: -item.amount })),
    ...(edictConsumption > 0
      ? [{ id: 'edicts', name: 'Edicts', amount: edictConsumption }]
      : []),
    ...contracts.map(contract => ({
      id: `contract-${contract.id}`,
      name: contract.name,
      amount: (contract.fixedUnityPerCycle + contract.unityPer100Imported * contract.importedPerCycle / 100)
        * (1 + Math.min(0, contractsUnityCostPercent) / 100),
    })).filter(item => item.amount > 0),
    ...buildingConsumption.filter(item => item.amount > 0),
  ]
  const generationPerCycle = settlementUnity === null
    ? null
    : generation.reduce((total, item) => total + item.amount, 0)
  const consumptionPerCycle = consumption.reduce((total, item) => total + item.amount, 0)
  const housingGroups = [{ housing, housingCount }, ...additionalHousing]

  return {
    generationPerCycle,
    consumptionPerCycle,
    netPerCycle: generationPerCycle === null ? null : generationPerCycle - consumptionPerCycle,
    storageCapacity: (baseUnityStorage + housingGroups.reduce((total, group) => (
      total + group.housing.unityStorage * Math.max(0, Math.trunc(group.housingCount))
    ), 0)) * unityCapacityMultiplier,
    generation,
    consumption,
  }
}
