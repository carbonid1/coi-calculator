import { type ActiveContract } from '../../db/contracts'
import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type ResourceId } from '../../db/resources'
import { calculateLinkedModules } from '../calculate-linked-modules/calculate-linked-modules'
import { calculateFactoryTotal } from '../factory-total/factory-total'
import { type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import {
  createPooledLinkSourceShadows,
  hasPooledLinkSourceConnections,
} from '../pooled-link-source-shadows/pooled-link-source-shadows'

export interface FactoryCalculationInput {
  contracts: ActiveContract[]
  contractsProfitMultiplier: number
  links: ModuleResourceLink[]
  modules: Module[]
  outputModifiers: RecipeModifierMultipliers
  recyclingEfficiencyPercent: number
  shipsFuelUseMultiplier: number
}

export interface FactoryCalculation {
  factoryResult: ReturnType<typeof calculateFactoryTotal>
  linkedModulesResult: ReturnType<typeof calculateLinkedModules>
}

/**
 * Solves the whole factory: isolated live modules first, then the pooled
 * factory total, with pooled link sources shadowed when a private link feeds
 * a factory-pooled module. Pure and structured-clone safe on both ends, so it
 * can run inside a Web Worker.
 */
export const calculateFactoryCalculation = ({
  contracts,
  contractsProfitMultiplier,
  links,
  modules,
  outputModifiers,
  recyclingEfficiencyPercent,
  shipsFuelUseMultiplier,
}: FactoryCalculationInput): FactoryCalculation => {
  const calculateFactory = (
    linkedResult: ReturnType<typeof calculateLinkedModules>,
    moduleFixedDemands: ReadonlyMap<
      string,
      Partial<Record<ResourceId, number>>
    > = new Map(),
    moduleSuppliedResources: ReadonlyMap<
      string,
      Partial<Record<ResourceId, number>>
    > = new Map(),
  ) => calculateFactoryTotal(
    modules,
    {
      boundaryDemands: linkedResult.boundaryDemands,
      boundarySupplies: linkedResult.boundarySupplies,
      contracts,
      recyclingEfficiencyPercent,
      outputModifiers,
      shipsFuelUseMultiplier,
      contractsProfitMultiplier,
      moduleFixedDemands,
      moduleSuppliedResources,
    },
  )
  const baseLinkedModulesResult = calculateLinkedModules({
    links,
    modules,
    outputModifiers,
    recyclingEfficiencyPercent,
  })

  if (!hasPooledLinkSourceConnections(links, modules)) {
    return {
      linkedModulesResult: baseLinkedModulesResult,
      factoryResult: calculateFactory(baseLinkedModulesResult),
    }
  }

  const baseFactoryResult = calculateFactory(baseLinkedModulesResult)
  const pooledLinkSources = createPooledLinkSourceShadows({
    calculation: baseFactoryResult.calculation,
    lines: baseFactoryResult.allLines,
    links,
    modules,
    outputModifiers,
  })
  const rawLinkedModulesResult = calculateLinkedModules({
    links,
    modules: [
      ...modules.filter(moduleDefinition => (
        !pooledLinkSources.sourceModuleIds.has(moduleDefinition.id)
      )),
      ...pooledLinkSources.modules,
    ],
    outputModifiers,
    recyclingEfficiencyPercent,
  })
  const resolvedLinkedModulesResult = {
    ...rawLinkedModulesResult,
    moduleResults: new Map(
      [...rawLinkedModulesResult.moduleResults].filter(([moduleId]) => (
        !pooledLinkSources.sourceModuleIds.has(moduleId)
      )),
    ),
  }
  const linkedDemandsByPooledSource = new Map<
    string,
    Partial<Record<ResourceId, number>>
  >()
  const linkedSuppliesByPooledTarget = new Map<
    string,
    Partial<Record<ResourceId, number>>
  >()

  for (const transfer of resolvedLinkedModulesResult.transfers) {
    if (pooledLinkSources.sourceModuleIds.has(transfer.sourceModuleId)) {
      const demands = linkedDemandsByPooledSource.get(transfer.sourceModuleId) ?? {}

      demands[transfer.resourceId] = (demands[transfer.resourceId] ?? 0) + transfer.quantity
      linkedDemandsByPooledSource.set(transfer.sourceModuleId, demands)
    }
    if (pooledLinkSources.sourceModuleIds.has(transfer.targetModuleId)) {
      const supplies = linkedSuppliesByPooledTarget.get(transfer.targetModuleId) ?? {}

      supplies[transfer.resourceId] = (supplies[transfer.resourceId] ?? 0)
        + transfer.quantity
      linkedSuppliesByPooledTarget.set(transfer.targetModuleId, supplies)
    }
  }

  return {
    linkedModulesResult: resolvedLinkedModulesResult,
    factoryResult: calculateFactory(
      resolvedLinkedModulesResult,
      linkedDemandsByPooledSource,
      linkedSuppliesByPooledTarget,
    ),
  }
}
