import { type ActiveContract } from '../../db/contracts'
import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type ResourceId } from '../../db/resources'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { type ResourceFlow } from '../calculate/calculate'
import { calculateLinkedModules, type PooledLinkCalculationInput } from '../calculate-linked-modules/calculate-linked-modules'
import { calculateFactoryTotal, type FactoryTotalOptions } from '../factory-total/factory-total'
import { getRecipeInputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { typedEntries } from '../typed-entries/typed-entries'
import { calculateWorldMines, type WorldMineResult } from '../world-mines/calculate-world-mines'
import { getBalancedWorldResources, limitWorldMineDeliveries, type WorldMinePlanning } from '../world-mines/world-mine-planning'

export interface FactoryCalculationInput {
  contracts: ActiveContract[]
  contractsProfitMultiplier: number
  links: ModuleResourceLink[]
  modules: Module[]
  outputModifiers: RecipeModifierMultipliers
  recyclingEfficiencyPercent: number
  externalSupplies?: Partial<Record<ResourceId, number>>
  externalDemands?: Partial<Record<ResourceId, number>>
  worldMinePlanning?: WorldMinePlanning
  powerPlanning?: {
    measuredDemandMw: number
    bufferPercent: number
    /** Current configuration derived from the same snapshot, without future overrides. */
    baseline?: FactoryCalculationInput
  }
}

export interface PowerProjection {
  measuredDemandMw: number
  plannedDeltaMw: number
  demandMw: number
  bufferPercent: number
  bufferMw: number
  capacityTargetMw: number
}

export interface FactoryCalculation {
  factoryResult: ReturnType<typeof calculateFactoryTotal>
  linkedModulesResult: ReturnType<typeof calculateLinkedModules>
  worldMines?: WorldMineResult
  powerProjection?: PowerProjection
}

type ModeledFactoryInput = FactoryCalculationInput & Pick<FactoryTotalOptions, 'electricityDemandAdjustmentMw' | 'electricityDemandOverrideMw'>

/**
 * Named links couple isolated ledgers to the pooled factory. Every pooled
 * endpoint is solved with the whole factory, preserving shared demand and
 * capacity. Pure and structured-clone safe for the calculation worker.
 */
const calculateLinkedFactory = ({
  contracts,
  contractsProfitMultiplier,
  links,
  modules,
  outputModifiers,
  recyclingEfficiencyPercent,
  externalSupplies,
  externalDemands,
  electricityDemandAdjustmentMw,
  electricityDemandOverrideMw,
}: ModeledFactoryInput): FactoryCalculation => {
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
    outputModifiers, contractsProfitMultiplier, moduleDrivingInputIds,
    electricityDemandAdjustmentMw, electricityDemandOverrideMw,
  }
  const progress: { factoryResult?: FactoryCalculation['factoryResult']; initialContractResults?: FactoryCalculation['factoryResult']['contractResults'] } = {}
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
    const result = cache.get(key) ?? calculateFactoryTotal(modules, {
      ...factoryOptions,
      boundaryDemands: input.boundaryDemands,
      boundarySupplies: input.boundarySupplies,
      moduleFixedDemands: input.moduleDemands,
      moduleSuppliedResources,
      initialContractResults: progress.initialContractResults,
    })

    cache.set(key, result)
    progress.initialContractResults = result.contractResults
    if (!input.planning) progress.factoryResult = result
    return result.calculation
  }
  const linkedModulesResult = calculateLinkedModules({
    links: activeLinks, modules, outputModifiers, recyclingEfficiencyPercent,
    calculatePooled,
  })
  const resolvedFactory = progress.factoryResult ?? calculateFactoryTotal(modules, {
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

const calculateModeledFactory = (input: ModeledFactoryInput): FactoryCalculation => {
  if (!input.worldMinePlanning) return calculateLinkedFactory(input)
  const full = calculateWorldMines(input.worldMinePlanning.world)
  const balanced = getBalancedWorldResources(input.worldMinePlanning).filter(id => (full.supplies[id] ?? 0) > 0)
  const run = (worldMines: WorldMineResult) => {
    const externalSupplies = { ...input.externalSupplies }, externalDemands = { ...worldMines.fuelDemands }

    for (const [id, quantity] of typedEntries(worldMines.supplies)) externalSupplies[id] = (externalSupplies[id] ?? 0) + quantity
    for (const [id, quantity] of typedEntries(input.externalDemands ?? {})) externalDemands[id] = (externalDemands[id] ?? 0) + quantity
    return { ...calculateLinkedFactory({ ...input, externalSupplies, externalDemands }), worldMines }
  }
  const allocation = { result: run(full), iteration: 0 }

  // A full-capacity first pass reveals downstream demand, including chains that would otherwise stay idle.
  // Reconcile fuel and contracts in the same worker, never during rendering or game simulation.
  while (balanced.length > 0 && allocation.iteration++ < 8) {
    const targets: Partial<Record<ResourceId, number>> = {}

    for (const id of balanced) {
      const flow = allocation.result.factoryResult.flows.find(flow => flow.resourceId === id)
      const reserve = allocation.result.factoryResult.calculation.sourceResults.reduce((sum, source) => sum + (
        source.recipe.sourceMode === 'demand' ? source.actualOutputs.reduce((total, output) => total + (output.resourceId === id ? output.quantity : 0), 0) : 0
      ), 0)

      targets[id] = Math.min(full.supplies[id] ?? 0, Math.max(0,
        (flow?.consumed ?? 0) - (flow?.produced ?? 0) + (allocation.result.worldMines.supplies[id] ?? 0) + reserve))
    }
    const next = limitWorldMineDeliveries(full, targets)

    if (balanced.every(id => Math.abs((next.supplies[id] ?? 0) - (allocation.result.worldMines.supplies[id] ?? 0)) < 0.001)) break
    allocation.result = run(next)
  }
  return allocation.result
}

// The baseline changes with the game snapshot, not with each edit to a future
// plan. Keep only a few numeric results in the worker, rather than full solves.
const baselinePowerCache = new Map<string, number>()

const getBaselineModeledDemand = (baseline: FactoryCalculationInput) => {
  const key = JSON.stringify(baseline)
  const demandMw = baselinePowerCache.get(key) ?? calculateModeledFactory(baseline).factoryResult.modeledElectricityDemandMw

  baselinePowerCache.set(key, demandMw)
  const oldest = baselinePowerCache.keys().next().value

  if (baselinePowerCache.size > 3 && oldest !== undefined) baselinePowerCache.delete(oldest)
  return demandMw
}

export const calculateFactoryCalculation = (input: FactoryCalculationInput): FactoryCalculation => {
  const planning = input.powerPlanning

  if (!planning) return calculateModeledFactory(input)
  const { measuredDemandMw, bufferPercent, baseline } = planning
  const baselineModeledMw = baseline ? getBaselineModeledDemand(baseline) : 0
  const result = calculateModeledFactory({ ...input, ...(baseline
    ? { electricityDemandAdjustmentMw: measuredDemandMw - baselineModeledMw }
    : { electricityDemandOverrideMw: measuredDemandMw }) })
  const demandMw = result.factoryResult.electricityDemandMw
  const bufferMw = demandMw * bufferPercent / 100

  return { ...result, powerProjection: {
    measuredDemandMw, plannedDeltaMw: demandMw - measuredDemandMw,
    demandMw, bufferPercent, bufferMw, capacityTargetMw: demandMw + bufferMw,
  } }
}
