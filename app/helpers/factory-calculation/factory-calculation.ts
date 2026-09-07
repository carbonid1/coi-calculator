import { type ActiveContract } from '../../db/contracts'
import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type ResourceId } from '../../db/resources'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { type ResourceFlow } from '../calculate/calculate'
import { calculateLinkedModules, type PooledLinkCalculationInput } from '../calculate-linked-modules/calculate-linked-modules'
import { calculateFactoryTotal } from '../factory-total/factory-total'
import { getRecipeInputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { typedEntries } from '../typed-entries/typed-entries'

export interface FactoryCalculationInput {
  contracts: ActiveContract[]
  contractsProfitMultiplier: number
  links: ModuleResourceLink[]
  modules: Module[]
  outputModifiers: RecipeModifierMultipliers
  recyclingEfficiencyPercent: number
  shipsFuelUseMultiplier: number
  externalSupplies?: Partial<Record<ResourceId, number>>
  externalDemands?: Partial<Record<ResourceId, number>>
}

export interface FactoryCalculation {
  factoryResult: ReturnType<typeof calculateFactoryTotal>
  linkedModulesResult: ReturnType<typeof calculateLinkedModules>
}

/**
 * Named links couple isolated ledgers to the pooled factory. Every pooled
 * endpoint is solved with the whole factory, preserving shared demand and
 * capacity. Pure and structured-clone safe for the calculation worker.
 */
export const calculateFactoryCalculation = ({
  contracts,
  contractsProfitMultiplier,
  links,
  modules,
  outputModifiers,
  recyclingEfficiencyPercent,
  shipsFuelUseMultiplier,
  externalSupplies,
  externalDemands,
}: FactoryCalculationInput): FactoryCalculation => {
  const modulesById = new Map(modules.map(module => [module.id, module]))
  const activeLinks = links.filter(link => (
    modulesById.get(link.sourceModuleId)?.liveArea
    && modulesById.get(link.targetModuleId)?.liveArea
  ))
  const pooledIds = new Set(modules.filter(module => (
    module.liveArea && module.includedInFactoryTotals !== false
  )).map(module => module.id))
  const moduleDrivingInputIds = new Map<string, Set<ResourceId>>()
  const planningSupplies = new Map<string, Partial<Record<ResourceId, number>>>()

  for (const link of activeLinks) {
    if (!pooledIds.has(link.targetModuleId)) continue
    if (link.mode === 'surplus-only') {
      const ids = moduleDrivingInputIds.get(link.targetModuleId) ?? new Set<ResourceId>()

      ids.add(link.resourceId)
      moduleDrivingInputIds.set(link.targetModuleId, ids)
    } else {
      const target = modulesById.get(link.targetModuleId)

      if (!target) continue
      const preset = target.presets.find(preset => preset.id === target.defaultPresetId) ?? null
      const { lines } = buildModuleLines(target, preset, outputModifiers)
      const supplies = planningSupplies.get(target.id) ?? {}

      // A demand probe is bounded by installed input capacity and discarded
      // before delivery. It reveals demand even when the source is still idle.
      supplies[link.resourceId] = lines.reduce((total, line) => total + line.recipe.inputs.reduce(
        (sum, input) => input.resourceId === link.resourceId
          ? sum + getRecipeInputQuantity(input, outputModifiers) * line.activeBuildings * line.speedLevel
          : sum, 0,
      ), preset?.fixedDemands?.[link.resourceId] ?? 0)
      planningSupplies.set(target.id, supplies)
    }
  }
  const factoryOptions = {
    contracts, externalSupplies, externalDemands, recyclingEfficiencyPercent,
    outputModifiers, shipsFuelUseMultiplier, contractsProfitMultiplier, moduleDrivingInputIds,
  }
  let factoryResult: FactoryCalculation['factoryResult'] | undefined
  let initialContractResults: FactoryCalculation['factoryResult']['contractResults'] | undefined
  const cache = new Map<string, FactoryCalculation['factoryResult']>()
  const calculatePooled = (input: PooledLinkCalculationInput) => {
    const moduleSuppliedResources = new Map([...input.moduleSupplies].map(([id, supplies]) => [id, { ...supplies }]))

    if (input.planning) {
      for (const [id, probes] of planningSupplies) {
        const supplies = moduleSuppliedResources.get(id) ?? {}

        for (const [resourceId, quantity] of typedEntries(probes)) {
          supplies[resourceId] = Math.max(supplies[resourceId] ?? 0, quantity)
        }
        moduleSuppliedResources.set(id, supplies)
      }
    }
    const key = JSON.stringify([
      input.boundaryDemands, input.boundarySupplies,
      [...input.moduleDemands], [...moduleSuppliedResources],
    ])
    let result = cache.get(key)

    if (!result) {
      result = calculateFactoryTotal(modules, {
        ...factoryOptions,
        boundaryDemands: input.boundaryDemands,
        boundarySupplies: input.boundarySupplies,
        moduleFixedDemands: input.moduleDemands,
        moduleSuppliedResources,
        initialContractResults,
      })
      cache.set(key, result)
    }
    initialContractResults = result.contractResults
    if (!input.planning) factoryResult = result
    return result.calculation
  }
  const linkedModulesResult = calculateLinkedModules({
    links: activeLinks, modules, outputModifiers, recyclingEfficiencyPercent,
    calculatePooled,
  })
  const resolvedFactory = factoryResult ?? calculateFactoryTotal(modules, {
    ...factoryOptions,
    boundaryDemands: linkedModulesResult.boundaryDemands,
    boundarySupplies: linkedModulesResult.boundarySupplies,
  })
  const internalTransfers = new Map<ResourceId, number>()

  for (const transfer of linkedModulesResult.transfers) {
    if (!pooledIds.has(transfer.sourceModuleId) || !pooledIds.has(transfer.targetModuleId)) continue
    internalTransfers.set(transfer.resourceId, (internalTransfers.get(transfer.resourceId) ?? 0) + transfer.quantity)
  }
  // Source reservations and receiving credits cancel in the factory ledger.
  // Remove both from reported totals so moving material adds no production.
  const withoutInternalTransfers = (flow: ResourceFlow): ResourceFlow => {
    const transferred = internalTransfers.get(flow.resourceId) ?? 0

    return transferred === 0 ? flow : {
      ...flow, produced: flow.produced - transferred, consumed: flow.consumed - transferred,
    }
  }

  return {
    linkedModulesResult,
    factoryResult: {
      ...resolvedFactory,
      flows: resolvedFactory.flows.map(withoutInternalTransfers),
      calculation: {
        ...resolvedFactory.calculation,
        allResourceFlows: resolvedFactory.calculation.allResourceFlows.map(withoutInternalTransfers),
        resourceFlows: resolvedFactory.calculation.resourceFlows.map(withoutInternalTransfers),
      },
    },
  }
}
