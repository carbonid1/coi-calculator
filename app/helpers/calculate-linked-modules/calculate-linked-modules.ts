import {
  type ModuleResourceLink,
  type ModuleResourceTransfer,
} from '../../db/module-resource-links'
import { type Module, type Preset } from '../../db/modules/modules'
import { getFactoryResourceRequests, resourceSupplyRules } from '../../db/resource-supply'
import { type ResourceId } from '../../db/resources'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../building-stats/building-stats'
import {
  calculateNet,
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from '../calculate/calculate'
import {
  type RecipeModifierMultipliers,
} from '../modifiers/recipe-output'
import {
  calculateModuleResourceBoundary,
  resolveModuleResourceBoundary,
  type ModuleResourceBoundary,
} from '../module-resource-boundary/module-resource-boundary'
import { extractModuleResult, type ModuleResult } from '../module-result/module-result'
import { getPresetResourceDemands } from '../preset-resource-demands/preset-resource-demands'
import { typedEntries } from '../typed-entries/typed-entries'

const MAX_LINK_ITERATIONS = 32
const LINK_TOLERANCE = 0.000001

type Calculation = ReturnType<typeof calculateNet>

interface ModuleRun {
  calculation: Calculation
  lines: ProductionLine[]
  preset: Preset | null
  suppliedResources: Partial<Record<ResourceId, number>>
  outgoingDemands: Partial<Record<ResourceId, number>>
}

interface LinkedModuleResult extends ModuleResult {
  lines: ProductionLine[]
}

export interface LinkedModulesCalculation {
  boundaries: ModuleResourceBoundary[]
  boundaryDemands: Partial<Record<ResourceId, number>>
  boundarySupplies: Partial<Record<ResourceId, number>>
  moduleResults: ReadonlyMap<string, LinkedModuleResult>
  transfers: ModuleResourceTransfer[]
}

export interface CalculateLinkedModulesOptions {
  links: readonly ModuleResourceLink[]
  modules: readonly Module[]
  outputModifiers?: RecipeModifierMultipliers
  recyclingEfficiencyPercent: number
  /** Pooled endpoints must be solved together with the rest of the factory. */
  calculatePooled?: (input: PooledLinkCalculationInput) => Calculation
}

export interface PooledLinkCalculationInput {
  boundaryDemands: Partial<Record<ResourceId, number>>
  boundarySupplies: Partial<Record<ResourceId, number>>
  moduleDemands: ReadonlyMap<string, Partial<Record<ResourceId, number>>>
  moduleSupplies: ReadonlyMap<string, Partial<Record<ResourceId, number>>>
  planning: boolean
}

const addQuantity = (
  quantities: Partial<Record<ResourceId, number>>,
  resourceId: ResourceId,
  quantity: number,
) => {
  quantities[resourceId] = (quantities[resourceId] ?? 0) + quantity
}

const getPreset = (moduleDefinition: Module) => (
  moduleDefinition.defaultPresetId
    ? moduleDefinition.presets.find(preset => preset.id === moduleDefinition.defaultPresetId)
      ?? moduleDefinition.presets[0]
      ?? null
    : null
)

const getResultFlow = (
  moduleId: string,
  calculation: Calculation,
  resourceId: ResourceId,
) => {
  const totals = {
    consumed: 0,
    produced: 0,
  }
  const results: readonly (RegularResult | PassiveResult)[] = [
    ...calculation.regularResults,
    ...calculation.sourceResults,
    ...calculation.sinkResults,
  ]

  for (const result of results) {
    if (result.moduleId !== moduleId) continue

    for (const input of result.actualInputs) {
      if (input.resourceId === resourceId) totals.consumed += input.quantity
    }
    for (const output of result.actualOutputs) {
      if (output.resourceId === resourceId) totals.produced += output.quantity
    }
  }

  return { consumed: totals.consumed, produced: totals.produced }
}

const getFlowResourceIds = (moduleId: string, calculation: Calculation) => new Set(
  [
    ...calculation.regularResults,
    ...calculation.sourceResults,
    ...calculation.sinkResults,
  ].flatMap(result => (
    result.moduleId === moduleId
      ? [
          ...result.actualInputs.map(input => input.resourceId),
          ...result.actualOutputs.map(output => output.resourceId),
        ]
      : []
  )),
)

const getLocalExternalNeed = (
  moduleId: string,
  run: ModuleRun,
  resourceId: ResourceId,
) => {
  const flow = getResultFlow(moduleId, run.calculation, resourceId)
  const fixedDemand = run.preset?.fixedDemands?.[resourceId] ?? 0
  const outgoingDemand = run.outgoingDemands[resourceId] ?? 0

  return Math.max(
    0,
    flow.consumed + fixedDemand + outgoingDemand - flow.produced,
  )
}

const getLocalAvailable = (
  moduleId: string,
  run: ModuleRun,
  resourceId: ResourceId,
) => {
  const flow = getResultFlow(moduleId, run.calculation, resourceId)
  const fixedDemand = run.preset?.fixedDemands?.[resourceId] ?? 0
  const supplied = run.suppliedResources[resourceId] ?? 0
  const recoverable = resourceSupplyRules[resourceId] === 'connections'
    ? run.calculation.sinkResults.reduce((sum, result) => sum + result.actualInputs.reduce((total, input) => (
        result.moduleId === moduleId && input.resourceId === resourceId ? total + input.quantity : total
      ), 0), 0)
    : 0

  return Math.max(0, flow.produced + supplied - flow.consumed - fixedDemand + recoverable)
}

const quantitiesAreEqual = (
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
) => {
  const ids = new Set([...left.keys(), ...right.keys()])

  return [...ids].every(id => (
    Math.abs((left.get(id) ?? 0) - (right.get(id) ?? 0)) <= LINK_TOLERANCE
  ))
}

const getRunBoundaries = (
  moduleId: string,
  run: ModuleRun,
  links: readonly ModuleResourceLink[],
  quantities: ReadonlyMap<string, number>,
  outputModifiers: RecipeModifierMultipliers,
): ModuleResourceBoundary[] => {
  const resourceIds = getFlowResourceIds(moduleId, run.calculation)
  const electricityDemandMw = calculateBuildingStats(run.lines, run.calculation, outputModifiers).electricityKw / 1000

  if (electricityDemandMw > 0) resourceIds.add('electricity')

  for (const [resourceId] of typedEntries(run.preset?.fixedDemands ?? {})) resourceIds.add(resourceId)
  for (const [resourceId] of typedEntries(run.preset?.requestedImports ?? {})) resourceIds.add(resourceId)
  const moduleLinks = links.filter(link => link.sourceModuleId === moduleId || link.targetModuleId === moduleId)

  for (const link of moduleLinks) resourceIds.add(link.resourceId)

  return [...resourceIds].map(resourceId => {
    const rule = resolveModuleResourceBoundary(moduleId, resourceId, links, run.preset)
    const flow = getResultFlow(moduleId, run.calculation, resourceId)
    const transfers2 = {
      received: 0,
      sent: 0,
      demandTriggeredSent: 0,
    }

    for (const link of moduleLinks) {
      if (link.resourceId !== resourceId) continue
      const quantity = quantities.get(link.id) ?? 0

      if (link.targetModuleId === moduleId) transfers2.received += quantity
      if (link.sourceModuleId === moduleId) {
        transfers2.sent += quantity
        if (link.mode === 'produce-to-demand') transfers2.demandTriggeredSent += quantity
      }
    }
    return {
      moduleId, resourceId, rule,
      ...calculateModuleResourceBoundary(rule, {
        produced: flow.produced,
        consumed: flow.consumed + (resourceId === 'electricity' ? electricityDemandMw : 0),
        fixedDemand: run.preset?.fixedDemands?.[resourceId] ?? 0,
        received: transfers2.received, sent: transfers2.sent, demandTriggeredSent: transfers2.demandTriggeredSent,
      }),
    }
  })
}

/**
 * Calculates synced live modules in local ledgers, applies exclusive private
 * transfers, and exposes only every unlinked residual to the global factory.
 */
export const calculateLinkedModules = ({
  links,
  modules,
  outputModifiers = {},
  recyclingEfficiencyPercent,
  calculatePooled,
}: CalculateLinkedModulesOptions): LinkedModulesCalculation => {
  const liveModules = modules.filter(moduleDefinition => (
    moduleDefinition.liveArea && (
      moduleDefinition.includedInFactoryTotals === false
      || (calculatePooled && links.some(link => (
        link.sourceModuleId === moduleDefinition.id || link.targetModuleId === moduleDefinition.id
      )))
    )
  ))
  const liveModuleIds = new Set(liveModules.map(moduleDefinition => moduleDefinition.id))
  const activeLinks = links.filter(link => (
    liveModuleIds.has(link.sourceModuleId)
    && liveModuleIds.has(link.targetModuleId)
  ))
  const sourceResourceKey = (link: ModuleResourceLink) => (
    `${link.sourceModuleId}:${link.resourceId}`
  )
  const targetResourceKey = (link: ModuleResourceLink) => (
    `${link.targetModuleId}:${link.resourceId}`
  )
  const linksByTarget = new Map<string, ModuleResourceLink[]>()
  const linksBySource = new Map<string, ModuleResourceLink[]>()
  const linksBySourceResource = new Map<string, ModuleResourceLink[]>()
  const linksByTargetResource = new Map<string, ModuleResourceLink[]>()

  for (const link of activeLinks) {
    linksByTarget.set(link.targetModuleId, [
      ...(linksByTarget.get(link.targetModuleId) ?? []),
      link,
    ])
    linksBySource.set(link.sourceModuleId, [
      ...(linksBySource.get(link.sourceModuleId) ?? []),
      link,
    ])
    linksBySourceResource.set(sourceResourceKey(link), [
      ...(linksBySourceResource.get(sourceResourceKey(link)) ?? []),
      link,
    ])
    linksByTargetResource.set(targetResourceKey(link), [
      ...(linksByTargetResource.get(targetResourceKey(link)) ?? []),
      link,
    ])
  }

  const baseLines = new Map(liveModules.map(moduleDefinition => {
    const preset = getPreset(moduleDefinition)
    const drivingInputIds = new Set(
      (linksByTarget.get(moduleDefinition.id) ?? [])
        .filter(link => link.mode === 'surplus-only' && !link.exportAllSurplus)
        .map(link => link.resourceId),
    )
    const lines = buildModuleLines(moduleDefinition, preset, outputModifiers).lines.map(line => {
      const lineDrivingIds = line.recipe.inputs
        .map(input => input.resourceId)
        .filter(resourceId => drivingInputIds.has(resourceId))
      const combinedDrivingIds = [...new Set([
        ...(line.drivingInputIds ?? []),
        ...lineDrivingIds,
      ])]

      return combinedDrivingIds.length > 0
        ? { ...line, drivingInputIds: combinedDrivingIds }
        : line
    })

    return [moduleDefinition.id, lines] as const
  }))
  const runCache = new Map<string, Map<string, ModuleRun>>()
  const getRunCacheKey = (
    planning: boolean,
    suppliedResources: Partial<Record<ResourceId, number>>,
    outgoingDemands: Partial<Record<ResourceId, number>>,
  ) => JSON.stringify([
    planning,
    typedEntries(suppliedResources)
      .filter(([, quantity]) => quantity !== 0)
      .toSorted(([left], [right]) => left.localeCompare(right)),
    typedEntries(outgoingDemands)
      .filter(([, quantity]) => quantity !== 0)
      .toSorted(([left], [right]) => left.localeCompare(right)),
  ])

  const runModules = (
    transferQuantities: ReadonlyMap<string, number>,
    demandRequests: ReadonlyMap<string, number>,
    planning: boolean,
  ) => {
    const pooledRequests = new Map<string, Omit<ModuleRun, 'calculation'>>()
    const runs = new Map<string, ModuleRun>()

    for (const moduleDefinition of liveModules) {
      const preset = getPreset(moduleDefinition)
      const suppliedResources: Partial<Record<ResourceId, number>> = {
        ...getFactoryResourceRequests(preset?.requestedImports),
      }
      const outgoingDemands: Partial<Record<ResourceId, number>> = {}
      const nonConstrainingInputs = new Set<ResourceId>()

      for (const link of linksByTarget.get(moduleDefinition.id) ?? []) {
        addQuantity(
          suppliedResources,
          link.resourceId,
          transferQuantities.get(link.id) ?? 0,
        )
        if (planning && link.mode === 'produce-to-demand') {
          nonConstrainingInputs.add(link.resourceId)
        }
      }
      for (const link of linksBySource.get(moduleDefinition.id) ?? []) {
        if (moduleDefinition.includedInFactoryTotals === false
          && link.mode !== 'produce-to-demand' && resourceSupplyRules[link.resourceId] !== 'connections') continue

        addQuantity(
          outgoingDemands,
          link.resourceId,
          (link.mode === 'produce-to-demand' ? demandRequests : transferQuantities).get(link.id) ?? 0,
        )
      }

      const demands = getPresetResourceDemands(preset)
      const requestedImportIds = new Set(
        typedEntries(getFactoryResourceRequests(preset?.requestedImports))
          .filter(([, quantity]) => quantity > 0)
          .map(([resourceId]) => resourceId),
      )
      const plannedSupportingResourceIds = new Set(
        (baseLines.get(moduleDefinition.id) ?? []).flatMap(line => (
          line.recipe.inputs.some(input => requestedImportIds.has(input.resourceId))
            ? line.recipe.inputs
                .map(input => input.resourceId)
                .filter(resourceId => !requestedImportIds.has(resourceId))
            : []
        )),
      )
      const localDemands = { ...outgoingDemands }

      for (const [resourceId, quantity] of typedEntries(demands)) {
        if (resourceSupplyRules[resourceId] !== 'connections') continue

        addQuantity(localDemands, resourceId, quantity)
        delete demands[resourceId]
      }
      const moduleDemands = new Map([[moduleDefinition.id, localDemands]])

      if (moduleDefinition.includedInFactoryTotals !== false) {
        pooledRequests.set(moduleDefinition.id, {
          lines: baseLines.get(moduleDefinition.id) ?? [],
          outgoingDemands, preset, suppliedResources,
        })
        continue
      }
      const cacheKey = getRunCacheKey(
        planning,
        suppliedResources,
        outgoingDemands,
      )
      const moduleCache = runCache.get(moduleDefinition.id) ?? new Map()
      const cached = moduleCache.get(cacheKey)

      if (cached) {
        runs.set(moduleDefinition.id, cached)
        continue
      }

      const calculation = calculateNet(
        baseLines.get(moduleDefinition.id) ?? [],
        suppliedResources,
        recyclingEfficiencyPercent,
        outputModifiers,
        demands,
        nonConstrainingInputs,
        new Map([[moduleDefinition.id, new Set([
            ...(planning ? nonConstrainingInputs : []),
            ...plannedSupportingResourceIds,
          ])]]),
        moduleDemands,
        new Map([[moduleDefinition.id, suppliedResources]]),
      )

      const run: ModuleRun = {
        calculation,
        lines: baseLines.get(moduleDefinition.id) ?? [],
        outgoingDemands,
        preset,
        suppliedResources,
      }

      moduleCache.set(cacheKey, run)
      runCache.set(moduleDefinition.id, moduleCache)

      runs.set(moduleDefinition.id, run)
    }

    if (calculatePooled && pooledRequests.size > 0) {
      const boundaryDemands: Partial<Record<ResourceId, number>> = {}
      const boundarySupplies: Partial<Record<ResourceId, number>> = {}

      for (const [moduleId, run] of runs) {
        for (const boundary of getRunBoundaries(moduleId, run, activeLinks, transferQuantities, outputModifiers)) {
          addQuantity(boundaryDemands, boundary.resourceId, boundary.factoryDemand)
          addQuantity(boundarySupplies, boundary.resourceId, boundary.factorySupply)
        }
      }
      const moduleSupplies = new Map<string, Partial<Record<ResourceId, number>>>()
      const moduleDemands = new Map<string, Partial<Record<ResourceId, number>>>()

      for (const [moduleId, request] of pooledRequests) {
        // Preset imports are already applied by Factory Total. Only credit deliveries here.
        const supplies: Partial<Record<ResourceId, number>> = {}

        for (const link of linksByTarget.get(moduleId) ?? []) {
          addQuantity(supplies, link.resourceId, transferQuantities.get(link.id) ?? 0)
        }
        moduleSupplies.set(moduleId, supplies)
        moduleDemands.set(moduleId, request.outgoingDemands)
      }
      const calculation = calculatePooled({
        boundaryDemands, boundarySupplies, moduleDemands, moduleSupplies, planning,
      })

      for (const [moduleId, request] of pooledRequests) {
        runs.set(moduleId, { ...request, calculation })
      }
    }
    return runs
  }

  const getSourceAvailability = (runs: ReadonlyMap<string, ModuleRun>) => (
    new Map([...linksBySourceResource].map(([key, matchingLinks]) => {
      const first = matchingLinks[0]
      const run = first ? runs.get(first.sourceModuleId) : undefined
      const available = first && run
        ? getLocalAvailable(first.sourceModuleId, run, first.resourceId)
        : 0

      return [key, available] as const
    }))
  )

  const getProbeTransfers = (
    sourceAvailability: ReadonlyMap<string, number>,
    demandRequests: ReadonlyMap<string, number>,
  ) => new Map(activeLinks.map(link => {
    const available = sourceAvailability.get(sourceResourceKey(link)) ?? 0
    const quantity = link.mode === 'produce-to-demand'
      ? Math.min(available, demandRequests.get(link.id) ?? 0)
      : available

    return [link.id, quantity] as const
  }))

  const getTargetRequirements = (runs: ReadonlyMap<string, ModuleRun>) => (
    new Map([...linksByTargetResource].map(([key, matchingLinks]) => {
      const first = matchingLinks[0]
      const run = first ? runs.get(first.targetModuleId) : undefined
      const required = first && run
        ? Math.max(
            0,
            getLocalExternalNeed(first.targetModuleId, run, first.resourceId)
              - (getFactoryResourceRequests(run.preset?.requestedImports)[first.resourceId] ?? 0),
          )
        : 0

      return [key, required] as const
    }))
  )

  const allocateTransfers = (
    runs: ReadonlyMap<string, ModuleRun>,
    sourceAvailability: ReadonlyMap<string, number>,
    targetRequirements: ReadonlyMap<string, number>,
  ) => {
    const allocated = new Map<string, number>(
      activeLinks.map(link => [link.id, 0]),
    )
    const remainingSource = new Map(sourceAvailability)
    const remainingTarget = new Map(targetRequirements)
    const allocateMode = (mode: ModuleResourceLink['mode']) => {
      for (const link of activeLinks) {
        if (link.mode !== mode) continue

        const sourceKey = sourceResourceKey(link)
        const targetKey = targetResourceKey(link)
        const available = remainingSource.get(sourceKey) ?? 0
        const required = remainingTarget.get(targetKey) ?? 0
        const quantity = mode === 'surplus-only' && link.exportAllSurplus
          ? available : Math.min(available, required)

        allocated.set(link.id, quantity)
        remainingSource.set(sourceKey, available - quantity)
        remainingTarget.set(targetKey, Math.max(0, required - quantity))
      }
    }

    // Explicit demand-triggered routes retain priority over optional exports.
    allocateMode('produce-to-demand')

    // Preserve the module's requested global export before routing residual
    // production through surplus-only links.
    for (const [sourceKey, matchingLinks] of linksBySourceResource) {
      const first = matchingLinks[0]
      const run = first ? runs.get(first.sourceModuleId) : undefined
      const requested = first && run
        ? (getFactoryResourceRequests(run.preset?.requestedExports)[first.resourceId] ?? 0)
        : 0
      const available = remainingSource.get(sourceKey) ?? 0

      remainingSource.set(sourceKey, available - Math.min(available, requested))
    }

    allocateMode('surplus-only')

    return allocated
  }

  const allocation = {
    demandRequests: new Map<string, number>(
      activeLinks
        .filter(link => link.mode === 'produce-to-demand')
        .map(link => [link.id, 0] as const),
    ),
    transferQuantities: new Map<string, number>(
      activeLinks.map(link => [link.id, 0]),
    ),
    targetRequirements: new Map<string, number>(),
  }

  for (const pass = { iteration: 0 }; pass.iteration < MAX_LINK_ITERATIONS; pass.iteration += 1) {
    const sourceRuns = runModules(allocation.transferQuantities, allocation.demandRequests, true)
    const sourceAvailability = getSourceAvailability(sourceRuns)
    const probeTransfers = getProbeTransfers(sourceAvailability, allocation.demandRequests)
    const targetRuns = runModules(probeTransfers, allocation.demandRequests, true)
    const nextTargetRequirements = getTargetRequirements(targetRuns)
    const nextDemandRequests = new Map(
      activeLinks
        .filter(link => link.mode === 'produce-to-demand')
        .map(link => [
          link.id,
          nextTargetRequirements.get(targetResourceKey(link)) ?? 0,
        ] as const),
    )
    const nextTransferQuantities = allocateTransfers(
      sourceRuns,
      sourceAvailability,
      nextTargetRequirements,
    )

    const requestsConverged = quantitiesAreEqual(allocation.demandRequests, nextDemandRequests)
    const transfersConverged = quantitiesAreEqual(
      allocation.transferQuantities,
      nextTransferQuantities,
    )

    allocation.demandRequests = nextDemandRequests
    allocation.transferQuantities = nextTransferQuantities
    allocation.targetRequirements = nextTargetRequirements

    if (requestsConverged && transfersConverged) break
  }

  const planningRuns = runModules(allocation.transferQuantities, allocation.demandRequests, true)
  const planningAvailability = getSourceAvailability(planningRuns)
  const planningProbes = getProbeTransfers(planningAvailability, allocation.demandRequests)
  const targetPlanningRuns = runModules(planningProbes, allocation.demandRequests, true)

  allocation.targetRequirements = getTargetRequirements(targetPlanningRuns)
  allocation.transferQuantities = allocateTransfers(
    planningRuns,
    planningAvailability,
    allocation.targetRequirements,
  )

  const finalDemandRequests = new Map(
    activeLinks
      .filter(link => link.mode === 'produce-to-demand')
      .map(link => [link.id, allocation.transferQuantities.get(link.id) ?? 0] as const),
  )

  for (const [targetKey, matchingLinks] of linksByTargetResource) {
    const delivered = matchingLinks.reduce(
      (total, link) => total + (allocation.transferQuantities.get(link.id) ?? 0),
      0,
    )
    const shortfall = Math.max(0, (allocation.targetRequirements.get(targetKey) ?? 0) - delivered)
    const lastDemandLink = matchingLinks.findLast(link => link.mode === 'produce-to-demand')

    if (lastDemandLink && shortfall > LINK_TOLERANCE) {
      finalDemandRequests.set(
        lastDemandLink.id,
        (finalDemandRequests.get(lastDemandLink.id) ?? 0) + shortfall,
      )
    }
  }

  allocation.demandRequests = finalDemandRequests

  const finalRuns = runModules(allocation.transferQuantities, allocation.demandRequests, false)
  const transfers = activeLinks.map<ModuleResourceTransfer>(link => ({
    ...link,
    quantity: allocation.transferQuantities.get(link.id) ?? 0,
    requestedQuantity: link.mode === 'produce-to-demand'
      ? (allocation.demandRequests.get(link.id) ?? 0)
      : (allocation.transferQuantities.get(link.id) ?? 0),
  }))
  const moduleResults = new Map<string, LinkedModuleResult>()
  const boundaries: ModuleResourceBoundary[] = []
  const boundaryDemands: Partial<Record<ResourceId, number>> = {}
  const boundarySupplies: Partial<Record<ResourceId, number>> = {}

  for (const moduleDefinition of liveModules) {
    if (moduleDefinition.includedInFactoryTotals !== false) continue
    const run = finalRuns.get(moduleDefinition.id)

    if (!run) continue

    const inboundSupplies: Partial<Record<ResourceId, number>> = {
      ...getFactoryResourceRequests(run.preset?.requestedImports),
    }
    const displayDemands = getPresetResourceDemands(run.preset)

    for (const transfer of transfers) {
      if (transfer.targetModuleId === moduleDefinition.id) {
        addQuantity(inboundSupplies, transfer.resourceId, transfer.quantity)
      }
      if (transfer.sourceModuleId === moduleDefinition.id) {
        addQuantity(
          displayDemands,
          transfer.resourceId,
          transfer.mode === 'produce-to-demand'
            ? transfer.requestedQuantity
            : transfer.quantity,
        )
      }
    }

    moduleResults.set(moduleDefinition.id, {
      ...extractModuleResult(
        moduleDefinition.id,
        run.calculation,
        displayDemands,
        inboundSupplies,
      ),
      lines: run.lines,
    })

    for (const boundary of getRunBoundaries(moduleDefinition.id, run, activeLinks, allocation.transferQuantities, outputModifiers)) {
      const { resourceId } = boundary

      boundaries.push(boundary)
      if (boundary.factorySupply > LINK_TOLERANCE) {
        addQuantity(boundarySupplies, resourceId, boundary.factorySupply)
      }
      if (boundary.factoryDemand > LINK_TOLERANCE) {
        addQuantity(boundaryDemands, resourceId, boundary.factoryDemand)
      }
    }
  }

  return { boundaries, boundaryDemands, boundarySupplies, moduleResults, transfers }
}
