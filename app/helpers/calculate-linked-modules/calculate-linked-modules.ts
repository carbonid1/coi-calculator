import {
  type ModuleResourceLink,
  type ModuleResourceTransfer,
} from '../../db/module-resource-links'
import { type Module, type Preset } from '../../db/modules/modules'
import { getLinkedOnlyLiveModuleInputIds } from '../../db/resource-disposition'
import { type ResourceId } from '../../db/resources'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import {
  calculateNet,
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from '../calculate/calculate'
import {
  type RecipeModifierMultipliers,
} from '../modifiers/recipe-output'
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

export interface LinkedModuleResult extends ModuleResult {
  lines: ProductionLine[]
}

export interface LinkedModulesCalculation {
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
  let consumed = 0
  let produced = 0
  const results: readonly (RegularResult | PassiveResult)[] = [
    ...calculation.regularResults,
    ...calculation.sourceResults,
    ...calculation.sinkResults,
  ]

  for (const result of results) {
    if (result.moduleId !== moduleId) continue

    for (const input of result.actualInputs) {
      if (input.resourceId === resourceId) consumed += input.quantity
    }
    for (const output of result.actualOutputs) {
      if (output.resourceId === resourceId) produced += output.quantity
    }
  }

  return { consumed, produced }
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

  return Math.max(0, flow.produced + supplied - flow.consumed - fixedDemand)
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

/**
 * Calculates synced live modules in local ledgers, applies exclusive private
 * transfers, and exposes only every unlinked residual to the global factory.
 */
export const calculateLinkedModules = ({
  links,
  modules,
  outputModifiers = {},
  recyclingEfficiencyPercent,
}: CalculateLinkedModulesOptions): LinkedModulesCalculation => {
  const liveModules = modules.filter(moduleDefinition => (
    moduleDefinition.liveArea && moduleDefinition.includedInFactoryTotals === false
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
        .filter(link => link.mode === 'surplus-only')
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
  ) => new Map(liveModules.map(moduleDefinition => {
    const preset = getPreset(moduleDefinition)
    const suppliedResources: Partial<Record<ResourceId, number>> = {
      ...preset?.requestedImports,
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
      if (link.mode !== 'produce-to-demand') continue

      addQuantity(
        outgoingDemands,
        link.resourceId,
        demandRequests.get(link.id) ?? 0,
      )
    }

    const demands = getPresetResourceDemands(preset)
    const requestedImportIds = new Set(
      typedEntries(preset?.requestedImports ?? {})
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
    const moduleDemands = new Map([
      [moduleDefinition.id, outgoingDemands],
    ])
    const cacheKey = getRunCacheKey(
      planning,
      suppliedResources,
      outgoingDemands,
    )
    const moduleCache = runCache.get(moduleDefinition.id) ?? new Map()
    const cached = moduleCache.get(cacheKey)

    if (cached) return [moduleDefinition.id, cached] as const

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
      new Map(),
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

    return [moduleDefinition.id, run] as const
  }))

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
              - (run.preset?.requestedImports?.[first.resourceId] ?? 0),
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
        const quantity = Math.min(
          remainingSource.get(sourceKey) ?? 0,
          remainingTarget.get(targetKey) ?? 0,
        )

        allocated.set(link.id, quantity)
        remainingSource.set(sourceKey, (remainingSource.get(sourceKey) ?? 0) - quantity)
        remainingTarget.set(targetKey, (remainingTarget.get(targetKey) ?? 0) - quantity)
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
        ? (run.preset?.requestedExports?.[first.resourceId] ?? 0)
        : 0
      const available = remainingSource.get(sourceKey) ?? 0

      remainingSource.set(sourceKey, available - Math.min(available, requested))
    }

    allocateMode('surplus-only')

    return allocated
  }

  let demandRequests = new Map<string, number>(
    activeLinks
      .filter(link => link.mode === 'produce-to-demand')
      .map(link => [link.id, 0] as const),
  )
  let transferQuantities = new Map<string, number>(
    activeLinks.map(link => [link.id, 0]),
  )
  let targetRequirements = new Map<string, number>()

  for (let iteration = 0; iteration < MAX_LINK_ITERATIONS; iteration += 1) {
    const sourceRuns = runModules(transferQuantities, demandRequests, true)
    const sourceAvailability = getSourceAvailability(sourceRuns)
    const probeTransfers = getProbeTransfers(sourceAvailability, demandRequests)
    const targetRuns = runModules(probeTransfers, demandRequests, true)
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

    const requestsConverged = quantitiesAreEqual(demandRequests, nextDemandRequests)
    const transfersConverged = quantitiesAreEqual(
      transferQuantities,
      nextTransferQuantities,
    )

    demandRequests = nextDemandRequests
    transferQuantities = nextTransferQuantities
    targetRequirements = nextTargetRequirements

    if (requestsConverged && transfersConverged) break
  }

  const planningRuns = runModules(transferQuantities, demandRequests, true)
  const planningAvailability = getSourceAvailability(planningRuns)
  const planningProbes = getProbeTransfers(planningAvailability, demandRequests)
  const targetPlanningRuns = runModules(planningProbes, demandRequests, true)

  targetRequirements = getTargetRequirements(targetPlanningRuns)
  transferQuantities = allocateTransfers(
    planningRuns,
    planningAvailability,
    targetRequirements,
  )

  const finalDemandRequests = new Map(
    activeLinks
      .filter(link => link.mode === 'produce-to-demand')
      .map(link => [link.id, transferQuantities.get(link.id) ?? 0] as const),
  )

  for (const [targetKey, matchingLinks] of linksByTargetResource) {
    const delivered = matchingLinks.reduce(
      (total, link) => total + (transferQuantities.get(link.id) ?? 0),
      0,
    )
    const shortfall = Math.max(0, (targetRequirements.get(targetKey) ?? 0) - delivered)
    const lastDemandLink = matchingLinks.findLast(link => link.mode === 'produce-to-demand')

    if (lastDemandLink && shortfall > LINK_TOLERANCE) {
      finalDemandRequests.set(
        lastDemandLink.id,
        (finalDemandRequests.get(lastDemandLink.id) ?? 0) + shortfall,
      )
    }
  }

  demandRequests = finalDemandRequests

  const finalRuns = runModules(transferQuantities, demandRequests, false)
  const transfers = activeLinks.map<ModuleResourceTransfer>(link => ({
    ...link,
    quantity: transferQuantities.get(link.id) ?? 0,
    requestedQuantity: link.mode === 'produce-to-demand'
      ? (demandRequests.get(link.id) ?? 0)
      : (transferQuantities.get(link.id) ?? 0),
  }))
  const moduleResults = new Map<string, LinkedModuleResult>()
  const boundaryDemands: Partial<Record<ResourceId, number>> = {}
  const boundarySupplies: Partial<Record<ResourceId, number>> = {}
  const privateEndpoints = new Set(activeLinks.flatMap(link => [
    `${link.sourceModuleId}:${link.resourceId}`,
    `${link.targetModuleId}:${link.resourceId}`,
  ]))

  for (const moduleDefinition of liveModules) {
    const run = finalRuns.get(moduleDefinition.id)

    if (!run) continue

    const inboundSupplies: Partial<Record<ResourceId, number>> = {
      ...run.preset?.requestedImports,
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

    const resourceIds = getFlowResourceIds(moduleDefinition.id, run.calculation)

    for (const [resourceId] of typedEntries<ResourceId, number>(
      run.preset?.fixedDemands ?? {},
    )) {
      resourceIds.add(resourceId)
    }
    for (const [resourceId] of typedEntries<ResourceId, number>(
      run.preset?.requestedImports ?? {},
    )) {
      resourceIds.add(resourceId)
    }
    for (const transfer of transfers) {
      if (
        transfer.sourceModuleId === moduleDefinition.id
        || transfer.targetModuleId === moduleDefinition.id
      ) {
        resourceIds.add(transfer.resourceId)
      }
    }

    for (const resourceId of resourceIds) {
      const requestedImport = Math.max(
        0,
        run.preset?.requestedImports?.[resourceId] ?? 0,
      )

      if (requestedImport > LINK_TOLERANCE) {
        addQuantity(boundaryDemands, resourceId, requestedImport)
        continue
      }

      if (privateEndpoints.has(`${moduleDefinition.id}:${resourceId}`)) {
        const available = getLocalAvailable(moduleDefinition.id, run, resourceId)
        const demandTriggeredTransfers = transfers.reduce((total, transfer) => (
          transfer.sourceModuleId === moduleDefinition.id
          && transfer.resourceId === resourceId
          && transfer.mode === 'produce-to-demand'
            ? total + transfer.quantity
            : total
        ), 0)
        const requestedExport = run.preset?.requestedExports?.[resourceId] ?? 0
        const achievedExport = Math.min(
          requestedExport,
          Math.max(0, available - demandTriggeredTransfers),
        )

        if (achievedExport > LINK_TOLERANCE) {
          addQuantity(boundarySupplies, resourceId, achievedExport)
        }
        continue
      }

      if (getLinkedOnlyLiveModuleInputIds([resourceId]).length > 0) continue

      const flow = getResultFlow(moduleDefinition.id, run.calculation, resourceId)
      let net = flow.produced
        - flow.consumed
        - (run.preset?.fixedDemands?.[resourceId] ?? 0)

      for (const transfer of transfers) {
        if (transfer.resourceId !== resourceId) continue
        if (transfer.targetModuleId === moduleDefinition.id) net += transfer.quantity
        if (transfer.sourceModuleId === moduleDefinition.id) net -= transfer.quantity
      }

      if (net > LINK_TOLERANCE) addQuantity(boundarySupplies, resourceId, net)
      if (net < -LINK_TOLERANCE) addQuantity(boundaryDemands, resourceId, -net)
    }
  }

  return { boundaryDemands, boundarySupplies, moduleResults, transfers }
}
