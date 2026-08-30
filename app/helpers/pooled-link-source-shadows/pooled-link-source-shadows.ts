import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { type ResourceId } from '../../db/resources'
import {
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from '../calculate/calculate'
import {
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from '../modifiers/recipe-output'

type ProductionResult = RegularResult | PassiveResult

export interface PooledLinkSourceShadows {
  modules: Module[]
  sourceModuleIds: ReadonlySet<string>
}

interface CreatePooledLinkSourceShadowsOptions {
  calculation: {
    regularResults: RegularResult[]
    sourceResults: PassiveResult[]
    sinkResults: PassiveResult[]
  }
  lines: readonly ProductionLine[]
  links: readonly ModuleResourceLink[]
  modules: readonly Module[]
  outputModifiers?: RecipeModifierMultipliers
}

const getModuleResourceFlow = (
  moduleId: string,
  resourceId: ResourceId,
  results: readonly ProductionResult[],
) => results.reduce((flow, result) => {
  if (result.moduleId !== moduleId) return flow

  return {
    consumed: flow.consumed + result.actualInputs.reduce((total, input) => (
      input.resourceId === resourceId ? total + input.quantity : total
    ), 0),
    produced: flow.produced + result.actualOutputs.reduce((total, output) => (
      output.resourceId === resourceId ? total + output.quantity : total
    ), 0),
  }
}, { consumed: 0, produced: 0 })

const resultKey = (moduleId: string, recipeId: string) => `${moduleId}:${recipeId}`

const canStartForLinkedDemand = (line: ProductionLine, resourceId: ResourceId) => {
  if (!line.recipe.outputs.some(output => output.resourceId === resourceId)) return false

  if (line.recipe.group === 'source') {
    return line.recipe.sourceMode === 'module-demand-capped'
  }

  return line.operatingMode === 'balanced'
    && line.allocationRatio == null
    && line.recipe.balanceBy === 'output'
    && (
      line.recipe.balanceOutputIds == null
      || line.recipe.balanceOutputIds.includes(resourceId)
    )
}

const getAdditionalOutputCapacity = (
  sourceModuleId: string,
  resourceId: ResourceId,
  lines: readonly ProductionLine[],
  results: readonly ProductionResult[],
  outputModifiers: RecipeModifierMultipliers,
) => {
  const resultsByLine = new Map(results.map(result => [
    resultKey(result.moduleId, result.recipe.id),
    result,
  ]))
  const sourceLines = lines.filter(line => line.moduleId === sourceModuleId)
  const remainingByPool = new Map<string, number>()

  for (const line of sourceLines) {
    if (!line.capacityPoolId) continue

    const active = line.capacityPoolActiveBuildings ?? line.activeBuildings
    const result = resultsByLine.get(resultKey(line.moduleId, line.recipe.id))
    const used = line.activeBuildings * (result?.supplyRatio ?? 0)
    const current = remainingByPool.get(line.capacityPoolId) ?? active

    remainingByPool.set(line.capacityPoolId, Math.max(0, current - used))
  }

  let additionalCapacity = 0
  const eligibleLines = sourceLines
    .filter(line => canStartForLinkedDemand(line, resourceId))
    .toSorted((left, right) => (
      (left.recipe.sharedCapacity?.priority ?? 0)
      - (right.recipe.sharedCapacity?.priority ?? 0)
    ))

  for (const line of eligibleLines) {
    const output = line.recipe.outputs.find(candidate => candidate.resourceId === resourceId)

    if (!output) continue

    const result = resultsByLine.get(resultKey(line.moduleId, line.recipe.id))
    const unusedLineBuildings = Math.max(
      0,
      line.activeBuildings * (1 - (result?.supplyRatio ?? 0)),
    )
    const availableBuildings = line.capacityPoolId
      ? Math.min(unusedLineBuildings, remainingByPool.get(line.capacityPoolId) ?? 0)
      : unusedLineBuildings

    additionalCapacity += getRecipeOutputQuantity(
      line.recipe,
      output,
      outputModifiers,
    ) * availableBuildings * line.speedLevel

    if (line.capacityPoolId) {
      remainingByPool.set(
        line.capacityPoolId,
        Math.max(0, (remainingByPool.get(line.capacityPoolId) ?? 0) - availableBuildings),
      )
    }
  }

  return additionalCapacity
}

export const hasPooledLinkSourceConnections = (
  links: readonly ModuleResourceLink[],
  modules: readonly Module[],
) => {
  const modulesById = new Map(modules.map(moduleDefinition => [
    moduleDefinition.id,
    moduleDefinition,
  ]))

  return links.some(link => {
    const source = modulesById.get(link.sourceModuleId)
    const target = modulesById.get(link.targetModuleId)

    return Boolean(
      source?.liveArea
      && source.includedInFactoryTotals !== false
      && target?.liveArea
      && target.includedInFactoryTotals === false,
    )
  })
}

/**
 * Replaces a factory-pooled live source with a boundary-only capacity shadow.
 * The real module remains in Factory Total; the shadow exposes only output
 * already available there plus spare capacity that an explicit demand link may
 * start. No unlinked pooled resource can cross this boundary.
 */
export const createPooledLinkSourceShadows = ({
  calculation,
  lines,
  links,
  modules,
  outputModifiers = {},
}: CreatePooledLinkSourceShadowsOptions): PooledLinkSourceShadows => {
  const isolatedModuleIds = new Set(modules.filter(moduleDefinition => (
    moduleDefinition.liveArea && moduleDefinition.includedInFactoryTotals === false
  )).map(moduleDefinition => moduleDefinition.id))
  const pooledSourceIds = new Set(links.flatMap(link => {
    const source = modules.find(moduleDefinition => moduleDefinition.id === link.sourceModuleId)

    return source?.liveArea
      && source.includedInFactoryTotals !== false
      && isolatedModuleIds.has(link.targetModuleId)
      ? [source.id]
      : []
  }))
  const results: ProductionResult[] = [
    ...calculation.regularResults,
    ...calculation.sourceResults,
    ...calculation.sinkResults,
  ]
  const shadows = modules.flatMap(source => {
    if (!pooledSourceIds.has(source.id) || !source.liveArea) return []

    const sourceLinks = links.filter(link => link.sourceModuleId === source.id)
    const linkedResourceIds = [...new Set(sourceLinks.map(link => link.resourceId))]
    const recipes: Recipe[] = []
    const builtBuildings: Record<string, number> = {}
    const activeBuildings: Record<string, number> = {}
    const fixed: string[] = []

    for (const resourceId of linkedResourceIds) {
      const matchingLinks = sourceLinks.filter(link => link.resourceId === resourceId)
      const flow = getModuleResourceFlow(source.id, resourceId, results)
      const available = Math.max(0, flow.produced - flow.consumed)
      const canProduceToDemand = matchingLinks.some(link => link.mode === 'produce-to-demand')
      const capacity = canProduceToDemand
        ? available + getAdditionalOutputCapacity(
            source.id,
            resourceId,
            lines,
            results,
            outputModifiers,
          )
        : available
      const recipeId = `pooled-link-source:${source.id}:${resourceId}`

      recipes.push({
        id: recipeId,
        name: `${source.name} ${resourceId} link capacity`,
        building: source.name,
        group: canProduceToDemand ? 'source' : 'production',
        sourceMode: canProduceToDemand ? 'module-demand-capped' : undefined,
        inputs: [],
        outputs: [{ resourceId, quantity: capacity }],
      })
      builtBuildings[recipeId] = 1
      activeBuildings[recipeId] = 1
      if (!canProduceToDemand) fixed.push(recipeId)
    }

    // A pooled module can also be the target of another private link. Preserve
    // enough of its local byproduct-consumption behavior for link planning to
    // discover the inbound supporting demand without duplicating the module's
    // factory production. Steel #1, for example, needs linked Sea Water before
    // its desalinator can consume locally produced Steam (Low).
    const inboundResourceIds = new Set(
      links
        .filter(link => (
          link.targetModuleId === source.id
          && link.mode === 'produce-to-demand'
        ))
        .map(link => link.resourceId),
    )
    const surplusSourceRecipeIds = new Set<ResourceId>()

    for (const line of lines) {
      if (line.moduleId !== source.id) continue

      const surplusInputIds = line.recipe.consumeSurplusInputIds ?? []
      const consumesInboundResource = line.recipe.inputs.some(input => (
        inboundResourceIds.has(input.resourceId)
      ))

      if (!consumesInboundResource || surplusInputIds.length === 0) continue

      const result = results.find(candidate => (
        candidate.moduleId === line.moduleId
        && candidate.recipe.id === line.recipe.id
      ))
      const remainingBuildings = Math.max(
        0,
        line.activeBuildings * (1 - (result?.supplyRatio ?? 0)),
      )

      if (remainingBuildings <= 0) continue

      for (const resourceId of surplusInputIds) {
        if (surplusSourceRecipeIds.has(resourceId)) continue

        const flow = getModuleResourceFlow(source.id, resourceId, results)
        const available = Math.max(0, flow.produced - flow.consumed)

        if (available <= 0) continue

        const recipeId = `pooled-link-target:${source.id}:${resourceId}:available`

        recipes.push({
          id: recipeId,
          name: `${source.name} local ${resourceId}`,
          building: source.name,
          group: 'source',
          inputs: [],
          outputs: [{ resourceId, quantity: available }],
        })
        builtBuildings[recipeId] = 1
        activeBuildings[recipeId] = 1
        surplusSourceRecipeIds.add(resourceId)
      }

      const usableSurplusInputIds = surplusInputIds.filter(resourceId => (
        surplusSourceRecipeIds.has(resourceId)
      ))

      if (usableSurplusInputIds.length === 0) continue

      const recipeId = `pooled-link-target:${source.id}:${line.recipe.id}`
      const planningInputIds = new Set([
        ...inboundResourceIds,
        ...usableSurplusInputIds,
      ])

      recipes.push({
        id: recipeId,
        name: `${source.name} linked input planning`,
        building: line.recipe.building,
        group: 'production',
        balanceBy: 'input',
        balanceInputIds: usableSurplusInputIds,
        balanceInputScope: 'module',
        inputs: line.recipe.inputs.filter(input => planningInputIds.has(input.resourceId)),
        outputs: [],
      })
      builtBuildings[recipeId] = remainingBuildings
      activeBuildings[recipeId] = remainingBuildings
    }

    return [{
      id: source.id,
      name: source.name,
      description: '',
      includedInFactoryTotals: false,
      builtBuildings,
      recipes,
      presets: [{
        id: 'linked-capacity',
        name: 'Linked capacity',
        description: '',
        activeBuildings,
        fixed,
      }],
      defaultPresetId: 'linked-capacity',
      liveArea: source.liveArea,
    } satisfies Module]
  })

  return { modules: shadows, sourceModuleIds: pooledSourceIds }
}
