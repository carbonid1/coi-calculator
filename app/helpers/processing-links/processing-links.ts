import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { type ResourceId } from '../../db/resources'

export interface ProcessingEndpoint {
  moduleId: string
  buildingId: string
  recipeId: string
  poolId?: string
}

export interface ProcessingLink {
  id: string
  source: ProcessingEndpoint
  target: ProcessingEndpoint
  resourceId: ResourceId
}

export interface ResolvedProcessingLink {
  id: string
  sourceRecipeId: string
  targetRecipeId: string
  resourceId: ResourceId
}

export const getProcessingEndpoint = (moduleId: string, recipe: Recipe): ProcessingEndpoint => ({
  moduleId,
  buildingId: recipe.gameBuildingId ?? recipe.building,
  recipeId: recipe.gameRecipeId ?? recipe.id,
  ...(recipe.sharedCapacity ? { poolId: recipe.sharedCapacity.id } : {}),
})

const endpointKey = (endpoint: ProcessingEndpoint) => JSON.stringify([
  endpoint.moduleId, endpoint.buildingId, endpoint.recipeId, endpoint.poolId ?? null,
])

const resolveProcessingEndpoint = (endpoint: ProcessingEndpoint, modules: readonly Module[]) => {
  const owner = modules.find(module => module.id === endpoint.moduleId)
  const matches = owner?.recipes?.filter(recipe => (
    endpointKey(getProcessingEndpoint(owner.id, recipe)) === endpointKey(endpoint)
  )) ?? []

  return matches.length === 1 ? matches[0] : undefined
}

/** One incoming/outgoing edge per recipe group, with no cycles or cross-area routes. */
export const canAddProcessingLink = (links: readonly ProcessingLink[], link: ProcessingLink) => {
  const source = endpointKey(link.source)
  const target = endpointKey(link.target)

  if (source === target || link.source.moduleId !== link.target.moduleId
    || links.some(existing => existing.id === link.id
      || endpointKey(existing.source) === source || endpointKey(existing.target) === target)) return false

  const visited = new Set([source])
  const next = new Map(links.map(existing => [endpointKey(existing.source), endpointKey(existing.target)]))

  const traversal: { cursor?: string } = { cursor: target }

  while (traversal.cursor) {
    if (visited.has(traversal.cursor)) return false
    visited.add(traversal.cursor)
    traversal.cursor = next.get(traversal.cursor)
  }
  return true
}

export const resolveProcessingLinks = (links: readonly ProcessingLink[], modules: readonly Module[]) => {
  const valid: ProcessingLink[] = []
  const resolved: ResolvedProcessingLink[] = []

  for (const link of links) {
    if (!canAddProcessingLink(valid, link)) continue
    valid.push(link)
    const source = resolveProcessingEndpoint(link.source, modules)
    const target = resolveProcessingEndpoint(link.target, modules)

    if (!source || !target || source.group !== 'production' || target.group !== 'production'
      || !source.outputs.some(output => output.resourceId === link.resourceId)
      || !target.inputs.some(input => input.resourceId === link.resourceId)) continue
    resolved.push({ id: link.id, sourceRecipeId: source.id, targetRecipeId: target.id, resourceId: link.resourceId })
  }
  // A broken upstream edge must not silently turn its former consumer into a
  // new root. Keep the entire connected chain inactive until it is repaired.
  const resolvedIds = new Set(resolved.map(link => link.id))
  const unavailable = new Set(valid.filter(link => !resolvedIds.has(link.id)).flatMap(link => [endpointKey(link.source), endpointKey(link.target)]))

  for (const pass = { iteration: 0 }; pass.iteration < valid.length; pass.iteration++) {
    for (const link of valid) {
      if (!unavailable.has(endpointKey(link.source)) && !unavailable.has(endpointKey(link.target))) continue
      unavailable.add(endpointKey(link.source))
      unavailable.add(endpointKey(link.target))
    }
  }
  return resolved.filter(link => {
    const definition = valid.find(candidate => candidate.id === link.id)

    return definition && !unavailable.has(endpointKey(definition.source))
  })
}
