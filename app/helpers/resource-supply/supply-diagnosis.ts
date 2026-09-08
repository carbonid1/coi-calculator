import { type Module } from '../../db/modules/modules'
import { getFactoryResourceRequests, resourceSupplyRules } from '../../db/resource-supply'
import { resources, type ResourceId } from '../../db/resources'
import { type ResourceFlow } from '../calculate/calculate'
import { getCapacityPools, type PoolResult } from '../capacity-pools/capacity-pools'
import { type FactoryCalculation } from '../factory-calculation/factory-calculation'
import { getPresetResourceDemands } from '../preset-resource-demands/preset-resource-demands'
import { getRecipeDisplayName } from '../recipe-display/recipe-display'
import { isModuleInput } from '../recipe-input-scope/recipe-input-scope'

const EPSILON = 0.001

export interface SupplyTarget {
  resourceId: ResourceId
  moduleId?: string
}

export interface SupplyLimit {
  target: SupplyTarget
  kind: 'shortage' | 'exhausted' | 'blocked-increase'
  /** The rejected route's additional requirement, not a promise to close the selected deficit. */
  additionalQuantity?: number
}

export interface SupplyProducer {
  key: string
  moduleId: string
  moduleName: string
  recipeName: string
  building: string
  produced: number
  poolUtilization: number | null
  sharedCapacity: boolean
  status: 'paused' | 'capacity' | 'fixed' | 'byproduct' | 'inputs' | 'unexplained'
  mainProducts: ResourceId[]
  inputs: { target: SupplyTarget; quantity: number }[]
  limits: SupplyLimit[]
}

export interface SupplyUse {
  key: string
  name: string
  moduleName?: string
  quantity: number
}

export interface SupplyTrace {
  path: SupplyTarget[]
  kind: SupplyLimit['kind'] | 'capacity' | 'paused' | 'cycle' | 'continue'
  additionalQuantity?: number
}

export const supplyTargetKey = (target: SupplyTarget) => `${target.moduleId ?? 'factory'}:${target.resourceId}`

/** Read the settled allocation and its rejected routes; never re-run or alter dispatch. */
export const createSupplyInspector = (modules: readonly Module[], calculation: FactoryCalculation) => {
  const { factoryResult, linkedModulesResult } = calculation
  const factory = factoryResult.calculation
  const modulesById = new Map(modules.map(module => [module.id, module]))
  const context = (moduleId?: string) => {
    const result = moduleId ? linkedModulesResult.moduleResults.get(moduleId) ?? factory : factory
    const lines: PoolResult[] = [...result.regularResults, ...result.sourceResults, ...result.sinkResults]

    return {
      lines: moduleId ? lines.filter(line => line.moduleId === moduleId) : lines,
      blockedRoutes: result.blockedRoutes,
    }
  }
  const flowCache = new Map<string, ResourceFlow>()
  const getFlow = (target: SupplyTarget): ResourceFlow => {
    const key = supplyTargetKey(target)
    const cached = flowCache.get(key)

    if (cached) return cached
    const { resourceId, moduleId } = target
    let produced = 0
    let consumed = 0

    if (!moduleId) {
      const flow = factory.allResourceFlows.find(flow => flow.resourceId === resourceId)

      produced = flow?.produced ?? 0
      consumed = flow?.consumed ?? 0
    } else {
      for (const line of context(moduleId).lines) {
        produced += line.actualOutputs.find(output => output.resourceId === resourceId)?.quantity ?? 0
        consumed += line.actualInputs.find(input => input.resourceId === resourceId)?.quantity ?? 0
      }
      const area = modulesById.get(moduleId)
      const preset = area?.defaultPresetId
        ? area.presets.find(preset => preset.id === area.defaultPresetId) ?? area.presets[0]
        : undefined
      const demands = area?.liveArea && area.includedInFactoryTotals !== false
        ? preset?.fixedDemands : getPresetResourceDemands(preset)

      produced += Math.max(0, getFactoryResourceRequests(preset?.requestedImports)[resourceId] ?? 0)
      consumed += demands?.[resourceId] ?? 0
      for (const transfer of linkedModulesResult.transfers) {
        if (transfer.resourceId !== resourceId) continue
        if (transfer.targetModuleId === moduleId) produced += transfer.quantity
        if (transfer.sourceModuleId === moduleId) {
          consumed += transfer.mode === 'produce-to-demand' ? transfer.requestedQuantity : transfer.quantity
        }
      }
    }
    const flow = { resourceId, name: resources[resourceId].name, produced, consumed, net: produced - consumed }

    flowCache.set(key, flow)
    return flow
  }
  const inputTarget = (line: PoolResult, resourceId: ResourceId): SupplyTarget => ({
    resourceId,
    ...(modulesById.get(line.moduleId)?.includedInFactoryTotals === false
      || isModuleInput(line.recipe, resourceId) || resourceSupplyRules[resourceId] === 'connections'
      ? { moduleId: line.moduleId } : {}),
  })
  const producerCache = new Map<string, SupplyProducer[]>()
  const getProducers = (target: SupplyTarget): SupplyProducer[] => {
    const key = supplyTargetKey(target)
    const cached = producerCache.get(key)

    if (cached) return cached
    const { lines, blockedRoutes } = context(target.moduleId)
    const pools = getCapacityPools(target.resourceId, lines, 'outputs')
    const producers = lines.filter(line => (
      (line.activeBuildings > 0 || line.builtBuildings > 0)
      && line.recipe.outputs.some(output => output.resourceId === target.resourceId && output.quantity > 0)
    )).map((line): SupplyProducer => {
      const { recipe } = line
      const pool = pools.find(pool => pool.members.includes(line))
      const mainProducts = recipe.balanceOutputIds?.filter(id => id !== target.resourceId) ?? []
      const limits: SupplyLimit[] = []
      const blocked = blockedRoutes.find(route => route.moduleId === line.moduleId && route.recipe.id === recipe.id)
      const blockers = blocked?.blockingResources ?? (blocked?.blockedBy ? [blocked.blockedBy] : [])

      for (const blocker of blockers) {
        if (blocker.deficitIncrease <= EPSILON) continue
        limits.push({ target: inputTarget(line, blocker.resourceId),
          kind: 'blocked-increase', additionalQuantity: blocker.deficitIncrease })
      }
      const drivingInputs = new Set([
        ...(recipe.balanceInputIds ?? (recipe.balanceBy === 'input' ? recipe.inputs.map(input => input.resourceId) : [])),
        ...(recipe.consumeSurplusInputIds ?? []),
      ])

      for (const input of recipe.inputs) {
        // A rejected increase proves the feedstock could support expansion;
        // its final zero balance may include lower-priority cleanup routes.
        if (blockers.length > 0) break
        if (input.resourceId === target.resourceId || input.quantity <= 0) continue
        if (limits.some(limit => limit.target.resourceId === input.resourceId)) continue
        // Input-driven recovery only stops for its driving feedstock, unless
        // an actual rejected expansion above identifies a supporting reagent.
        if (recipe.balanceBy === 'input' && !drivingInputs.has(input.resourceId)) continue
        const next = inputTarget(line, input.resourceId)
        const flow = getFlow(next)

        if (flow.net < -EPSILON) limits.push({ target: next, kind: 'shortage' })
        else if (drivingInputs.has(input.resourceId) && flow.net <= EPSILON) {
          limits.push({ target: next, kind: 'exhausted' })
        }
      }
      let status: SupplyProducer['status'] = 'unexplained'

      if (line.activeBuildings === 0) status = 'paused'
      else if (mainProducts.length > 0 && !recipe.balanceOutputIds?.includes(target.resourceId)) status = 'byproduct'
      else if (pool?.atCapacity) status = 'capacity'
      else if ('operatingMode' in line && line.operatingMode === 'fixed') status = 'fixed'
      else if (limits.length > 0) status = 'inputs'

      return {
        key: `${line.moduleId}:${recipe.id}`, moduleId: line.moduleId,
        moduleName: modulesById.get(line.moduleId)?.name ?? line.moduleId,
        recipeName: getRecipeDisplayName(recipe), building: recipe.building,
        produced: line.actualOutputs.find(output => output.resourceId === target.resourceId)?.quantity ?? 0,
        poolUtilization: pool && pool.capacity > 0 ? pool.used / pool.capacity : null,
        sharedCapacity: (pool?.members.length ?? 0) > 1,
        status, mainProducts,
        inputs: line.actualInputs.map(input => ({ target: inputTarget(line, input.resourceId), quantity: input.quantity })),
        limits: status === 'inputs' ? limits : [],
      }
    })

    producerCache.set(key, producers)
    return producers
  }
  const getUses = (target: SupplyTarget): SupplyUse[] => {
    const uses = context(target.moduleId).lines.flatMap(line => {
      const quantity = line.actualInputs.find(input => input.resourceId === target.resourceId)?.quantity ?? 0

      return quantity > EPSILON ? [{
        key: `${line.moduleId}:${line.recipe.id}`, name: getRecipeDisplayName(line.recipe),
        moduleName: modulesById.get(line.moduleId)?.name ?? line.moduleId, quantity,
      }] : []
    })

    if (!target.moduleId) {
      for (const exchange of factoryResult.contractFlows) {
        if (exchange.resourceId !== target.resourceId || exchange.kind === 'import' || exchange.quantity <= EPSILON) continue
        uses.push({ key: `${exchange.routeId}:${exchange.kind}`, name: exchange.contractName,
          moduleName: exchange.kind === 'fuel' ? 'Ship fuel' : 'Contract export', quantity: exchange.quantity })
      }
    }
    const remaining = getFlow(target).consumed - uses.reduce((sum, use) => sum + use.quantity, 0)

    if (remaining > EPSILON) uses.push({ key: 'other', name: 'Other demand', moduleName: '', quantity: remaining })
    return uses.toSorted((a, b) => b.quantity - a.quantity)
  }
  const trace = (limit: SupplyLimit, path: SupplyTarget[] = []): SupplyTrace[] => {
    const nextPath = [...path, limit.target]

    if (path.some(target => supplyTargetKey(target) === supplyTargetKey(limit.target))) return [{ path: nextPath, kind: 'cycle' }]
    if (limit.kind !== 'exhausted') return [{ path: nextPath, kind: limit.kind, additionalQuantity: limit.additionalQuantity }]
    if (nextPath.length >= 4) return [{ path: nextPath, kind: 'continue' }]
    const producers = getProducers(limit.target)

    // Byproducts and demand-driven alternatives cannot be diagnosed from a
    // different supplier's feedstock. Stop here and let the user inspect each route.
    if (producers.some(producer => ['byproduct', 'fixed', 'unexplained'].includes(producer.status))) {
      return [{ path: nextPath, kind: 'exhausted' }]
    }

    const deliveries: SupplyLimit[] = linkedModulesResult.transfers.filter(transfer => (
      transfer.targetModuleId === limit.target.moduleId && transfer.resourceId === limit.target.resourceId
      && (transfer.quantity > EPSILON || transfer.requestedQuantity > EPSILON)
    )).map(transfer => ({
      target: { resourceId: transfer.resourceId, moduleId: transfer.sourceModuleId }, kind: 'exhausted',
    }))
    const upstream = [...producers.flatMap(producer => producer.limits), ...deliveries]

    if (upstream.length === 0) {
      let kind: SupplyTrace['kind'] = 'exhausted'

      if (producers.length > 0 && producers.every(producer => producer.status === 'paused')) kind = 'paused'
      else if (producers.length > 0 && producers.every(producer => producer.status === 'capacity')) kind = 'capacity'
      return [{ path: nextPath, kind }]
    }
    return upstream.flatMap(next => trace(next, nextPath))
  }

  return { getFlow, getProducers, getUses, trace }
}

export type SupplyInspector = ReturnType<typeof createSupplyInspector>
