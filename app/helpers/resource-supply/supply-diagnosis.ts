import { type Module } from '../../db/modules/modules'
import { reserveResourceCatalog } from '../../db/reserve-resources'
import { getFactoryResourceRequests, resourceSupplyRules } from '../../db/resource-supply'
import { resources, type ResourceId } from '../../db/resources'
import { type ResourceFlow } from '../calculate/calculate'
import { getCapacityPools, type PoolResult } from '../capacity-pools/capacity-pools'
import { type FactoryCalculation } from '../factory-calculation/factory-calculation'
import { getPresetResourceDemands } from '../preset-resource-demands/preset-resource-demands'
import { getRecipeDisplayName, getRecipePresentation, type RecipePresentation } from '../recipe-display/recipe-display'
import { isModuleInput } from '../recipe-input-scope/recipe-input-scope'
import { canPrioritizeProcessing } from '../resource-priorities/resource-priorities'
import { getRecipePriorityNotes, type RecipePriorityNote } from './recipe-priorities'

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
  recipe: RecipePresentation
  building: string
  capacityPoolKey: string
  produced: number
  poolUtilization: number | null
  sharedCapacity: boolean
  status: 'paused' | 'capacity' | 'fixed' | 'byproduct' | 'inputs' | 'unexplained'
  mainProducts: ResourceId[]
  inputs: { target: SupplyTarget; quantity: number }[]
  limits: SupplyLimit[]
  priorities: RecipePriorityNote[]
}

export interface SupplyUse {
  key: string
  name: string
  moduleName?: string
  moduleId?: string
  recipeName?: string
  recipe?: RecipePresentation
  inputTargets?: SupplyTarget[]
  quantity: number
  contractId?: string
  priorities?: RecipePriorityNote[]
}

export interface ModuleSupply {
  moduleId: string
  moduleName: string
  name: string
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
  const getPreset = (area: Module | undefined) => area?.defaultPresetId
    ? area.presets.find(preset => preset.id === area.defaultPresetId) ?? area.presets[0]
    : undefined
  const getModuleDemands = (area: Module | undefined) => {
    const preset = getPreset(area)

    return area?.liveArea && area.includedInFactoryTotals !== false
      ? preset?.fixedDemands : getPresetResourceDemands(preset)
  }
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
      const preset = getPreset(area)
      const demands = getModuleDemands(area)

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
  const priorityNotes = (line: PoolResult, lines: PoolResult[], target: SupplyTarget, side: 'inputs' | 'outputs') => {
    const peers = lines.filter(peer => (peer.activeBuildings > 0 || peer.builtBuildings > 0)
      && peer.recipe[side].some(item => item.resourceId === target.resourceId && item.quantity > 0)
      && (side === 'outputs' || supplyTargetKey(inputTarget(peer, target.resourceId)) === supplyTargetKey(inputTarget(line, target.resourceId))))
    const localFirst = side === 'inputs' && canPrioritizeProcessing(line.recipe, target.resourceId)
      && getPreset(modulesById.get(line.moduleId))?.resourceProcessingPriorities?.[target.resourceId] === 'local-first'

    return getRecipePriorityNotes(line, peers, target.resourceId, side, localFirst)
  }
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
        recipeName: getRecipeDisplayName(recipe),
        recipe: getRecipePresentation(recipe, { inputs: line.actualInputs, outputs: line.actualOutputs }),
        building: recipe.building,
        capacityPoolKey: line.capacityPoolId ?? `${line.moduleId}:${recipe.id}`,
        produced: line.actualOutputs.find(output => output.resourceId === target.resourceId)?.quantity ?? 0,
        poolUtilization: pool && pool.capacity > 0 ? pool.used / pool.capacity : null,
        sharedCapacity: (pool?.members.length ?? 0) > 1,
        status, mainProducts,
        inputs: recipe.inputs.map(input => ({ target: inputTarget(line, input.resourceId),
          quantity: line.actualInputs.find(actual => actual.resourceId === input.resourceId)?.quantity ?? 0 })),
        limits: status === 'inputs' ? limits : [],
        priorities: priorityNotes(line, lines, target, 'outputs'),
      }
    })

    producerCache.set(key, producers)
    return producers
  }
  const getUses = (target: SupplyTarget, includeInactive = false): SupplyUse[] => {
    const { lines } = context(target.moduleId)
    const uses: SupplyUse[] = lines.flatMap(line => {
      const quantity = line.actualInputs.find(input => input.resourceId === target.resourceId)?.quantity ?? 0
      const output = line.recipe.outputs.length === 1 ? line.recipe.outputs[0] : undefined

      const visible = quantity > EPSILON || (includeInactive && (line.activeBuildings > 0 || line.builtBuildings > 0)
        && line.recipe.inputs.some(input => input.resourceId === target.resourceId && input.quantity > 0))

      return visible ? [{
        key: `${line.moduleId}:${line.recipe.id}`, name: output ? resources[output.resourceId].name : getRecipeDisplayName(line.recipe),
        moduleId: line.moduleId, recipeName: getRecipeDisplayName(line.recipe),
        recipe: getRecipePresentation(line.recipe, { inputs: line.actualInputs, outputs: line.actualOutputs }),
        inputTargets: line.recipe.inputs.map(input => inputTarget(line, input.resourceId)),
        moduleName: modulesById.get(line.moduleId)?.name ?? line.moduleId, quantity,
        priorities: priorityNotes(line, lines, target, 'inputs'),
      }] : []
    })

    for (const area of modules) {
      if (target.moduleId ? area.id !== target.moduleId : area.includedInFactoryTotals === false) continue
      const fixed = Math.max(0, getPreset(area)?.fixedDemands?.[target.resourceId] ?? 0)
      const exported = (getModuleDemands(area)?.[target.resourceId] ?? 0) - fixed

      for (const demand of [
        { key: 'fixed', name: 'Demand outside recipes', quantity: fixed },
        { key: 'exports', name: 'Planned exports', quantity: exported },
      ]) {
        if (demand.quantity > EPSILON) uses.push({ ...demand, key: `${area.id}:${demand.key}`, moduleId: area.id, moduleName: area.name })
      }
    }
    if (target.moduleId) {
      for (const transfer of linkedModulesResult.transfers) {
        if (transfer.sourceModuleId !== target.moduleId || transfer.resourceId !== target.resourceId) continue
        const requested = transfer.mode === 'produce-to-demand'
        const quantity = requested ? transfer.requestedQuantity : transfer.quantity

        if (quantity > EPSILON) uses.push({ key: `delivery:${transfer.id}`, name: requested ? 'Requested delivery' : 'Delivery',
          moduleId: transfer.targetModuleId, moduleName: transfer.targetModuleName, quantity })
      }
    }
    if (!target.moduleId) {
      for (const boundary of linkedModulesResult.boundaries) {
        if (boundary.resourceId !== target.resourceId || boundary.factoryDemand <= EPSILON
          || modulesById.get(boundary.moduleId)?.includedInFactoryTotals !== false) continue
        uses.push({ key: `boundary:${boundary.moduleId}`, name: 'Factory supply', moduleId: boundary.moduleId,
          moduleName: modulesById.get(boundary.moduleId)?.name ?? boundary.moduleId, quantity: boundary.factoryDemand })
      }
      for (const exchange of factoryResult.contractFlows) {
        if (exchange.resourceId !== target.resourceId || exchange.kind === 'import' || exchange.quantity <= EPSILON) continue
        const key = `contract:${exchange.contractId}:${exchange.kind}`
        const existing = uses.find(use => use.key === key)

        if (existing) existing.quantity += exchange.quantity
        else uses.push({ key, name: exchange.contractName, contractId: exchange.contractId,
          moduleName: exchange.kind === 'fuel' ? 'Ship fuel' : 'Contract export', quantity: exchange.quantity })
      }
    }
    const remaining = getFlow(target).consumed - uses.reduce((sum, use) => sum + use.quantity, 0)

    if (remaining > EPSILON) uses.push({ key: 'other', name: 'Other demand', moduleName: '', quantity: remaining })
    return uses.toSorted((a, b) => b.quantity - a.quantity)
  }
  const getModuleSupplies = (target: SupplyTarget): ModuleSupply[] => {
    const supplies: ModuleSupply[] = []

    for (const line of context(target.moduleId).lines) {
      if (!reserveResourceCatalog.some(reserve => reserve.recipeId === line.recipe.id)) continue
      const quantity = line.actualOutputs.find(output => output.resourceId === target.resourceId)?.quantity ?? 0

      if (quantity > EPSILON) supplies.push({ moduleId: line.moduleId,
        moduleName: modulesById.get(line.moduleId)?.name ?? line.moduleId, name: 'From storage', quantity })
    }
    for (const area of modules) {
      if (target.moduleId ? area.id !== target.moduleId : area.includedInFactoryTotals === false) continue
      const imported = getFactoryResourceRequests(getPreset(area)?.requestedImports)[target.resourceId] ?? 0

      if (imported > EPSILON) supplies.push({ moduleId: area.id, moduleName: area.name, name: 'Planned imports', quantity: imported })
    }
    if (!target.moduleId) {
      for (const boundary of linkedModulesResult.boundaries) {
        if (boundary.resourceId !== target.resourceId || boundary.factorySupply <= EPSILON
          || modulesById.get(boundary.moduleId)?.includedInFactoryTotals !== false) continue
        supplies.push({ moduleId: boundary.moduleId, moduleName: modulesById.get(boundary.moduleId)?.name ?? boundary.moduleId,
          name: 'Available to factory', quantity: boundary.factorySupply })
      }
    }
    return supplies
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

  return { getFlow, getProducers, getUses, getModuleSupplies, trace }
}

export type SupplyInspector = ReturnType<typeof createSupplyInspector>
