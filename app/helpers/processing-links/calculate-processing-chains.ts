import { type ResourceId } from '../../db/resources'
import { type ProductionLine, type RegularResult, type ResourceFlow } from '../calculate/calculate'
import { getRecipeInputQuantity, getRecipeOutputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { getModuleInputIds } from '../recipe-input-scope/recipe-input-scope'

const TOLERANCE = 1e-7
const key = (line: Pick<ProductionLine, 'moduleId' | 'recipe'>) => `${line.moduleId}:${line.recipe.id}`

/**
 * Reserve a linear route inside the ordinary material/capacity ledger. Each
 * attempt is a complete solve: supporting production and displaced alternatives
 * must settle before accepting extra processing. No synthetic supply is added.
 */
export const calculateProcessingChains = <T extends { regularResults: RegularResult[]; allResourceFlows: ResourceFlow[] }>(
  lines: ProductionLine[], solve: (lines: ProductionLine[]) => T, modifiers: RecipeModifierMultipliers,
): T => {
  const calculation = { result: solve(lines) }

  if (!lines.some(line => line.processingInput)) return calculation.result
  const byKey = new Map(lines.map(line => [key(line), line]))
  const next = new Map<string, ProductionLine>()
  const incoming = new Set<string>()

  for (const line of lines) {
    const link = line.processingInput
    const sourceKey = link ? `${line.moduleId}:${link.sourceRecipeId}` : ''
    const source = byKey.get(sourceKey)

    if (!link || !source || next.has(sourceKey) || source.recipe.group !== 'production'
      || line.recipe.group !== 'production' || sourceKey === key(line)
      || !source.recipe.outputs.some(output => output.resourceId === link.resourceId)
      || !line.recipe.inputs.some(input => input.resourceId === link.resourceId)) continue
    next.set(sourceKey, line)
    incoming.add(key(line))
  }

  const floors = new Map<string, NonNullable<ProductionLine['processingFloor']>>()
  const required = new Map<string, number>()
  const blockers = new Map<string, ResourceId | 'capacity'>()
  const roots = new Map<string, number>()
  const configured = () => lines.map(line => ({
    ...line,
    // A named route replaces broad local-surplus behavior for this input.
    // Keeping both policies would exclude the same draw from pooled demand
    // twice and leave ordinary consumers short of their reserved material.
    ...(line.processingInput && floors.has(key(line)) ? { recipe: {
      ...line.recipe,
      consumeSurplusInputIds: line.recipe.consumeSurplusInputIds?.filter(id => id !== line.processingInput?.resourceId),
      moduleInputIds: getModuleInputIds(line.recipe).filter(id => id !== line.processingInput?.resourceId),
      balanceInputScope: undefined,
      balanceInputIds: line.recipe.balanceBy === 'output'
        ? line.recipe.balanceInputIds?.filter(id => id !== line.processingInput?.resourceId) : line.recipe.balanceInputIds,
    } } : {}),
    processingSourceLimit: roots.get(key(line)),
    processingFloor: floors.get(key(line)),
    processingRequiredBuildings: required.get(key(line)),
    processingBlockedBy: blockers.get(key(line)),
  }))

  for (const root of lines.filter(line => next.has(key(line)) && !incoming.has(key(line)))) {
    const chain: ProductionLine[] = []
    const visited = new Set([key(root)])
    const traversal = { cursor: next.get(key(root)) }

    while (traversal.cursor && !visited.has(key(traversal.cursor))) {
      chain.push(traversal.cursor)
      visited.add(key(traversal.cursor))
      traversal.cursor = next.get(key(traversal.cursor))
    }
    if (traversal.cursor || !chain.length) continue
    const baseline = calculation.result
    const results = new Map(baseline.regularResults.map(result => [key(result), result]))
    const rootResult = results.get(key(root))
    const firstInput = chain[0]?.processingInput

    if (!firstInput) continue
    const available = rootResult?.actualOutputs.find(output => output.resourceId === firstInput.resourceId)?.quantity ?? 0
    const route = { quantity: available, maximum: 1 }
    const requests = chain.flatMap((line, index) => {
      const link = line.processingInput
      const input = line.recipe.inputs.find(input => input.resourceId === link?.resourceId)

      if (!link || !input) return []
      const perBuilding = getRecipeInputQuantity(input, modifiers) * line.speedLevel
      const buildings = perBuilding > 0 ? route.quantity / perBuilding : 0
      const ratio = line.activeBuildings > 0 ? buildings / line.activeBuildings : 0

      required.set(key(line), buildings)
      if (buildings > 0) route.maximum = Math.min(route.maximum, line.activeBuildings / buildings)
      const nextInput = chain[index + 1]?.processingInput
      const output = line.recipe.outputs.find(output => output.resourceId === nextInput?.resourceId)

      if (output) route.quantity = getRecipeOutputQuantity(line.recipe, output, modifiers) * line.speedLevel * buildings
      return [{ line, ratio, buildings, resourceId: link.resourceId }]
    })

    if (available <= TOLERANCE) continue

    // Shared pools include the root and any explicit fixed/target commitments.
    const poolRequests = new Map<string, { capacity: number; requested: number; committed: number }>()

    for (const { line, buildings } of requests) {
      if (!line.capacityPoolId) continue
      const pool = poolRequests.get(line.capacityPoolId) ?? {
        capacity: line.capacityPoolActiveBuildings ?? line.activeBuildings, requested: 0,
        committed: lines.filter(candidate => candidate.capacityPoolId === line.capacityPoolId
          && (candidate === root || candidate.operatingMode === 'fixed' || candidate.allocationRatio != null))
          .reduce((sum, candidate) => sum + candidate.activeBuildings * (results.get(key(candidate))?.supplyRatio ?? 0), 0),
      }

      const alreadyCommitted = line.operatingMode === 'fixed' || line.allocationRatio != null
        ? line.activeBuildings * (results.get(key(line))?.supplyRatio ?? 0) : 0

      pool.requested += Math.max(0, buildings - alreadyCommitted)
      poolRequests.set(line.capacityPoolId, pool)
    }
    for (const pool of poolRequests.values()) {
      if (pool.requested > 0) route.maximum = Math.min(route.maximum, Math.max(0, pool.capacity - pool.committed) / pool.requested)
    }
    route.maximum = Math.max(0, Math.min(1, route.maximum))
    // Lock the root at production justified before adding this route. A linked
    // input can never become a new reason to make titanium (or another root).
    roots.set(key(root), rootResult?.supplyRatio ?? 0)
    const attempt = (fraction: number) => {
      for (const { line, ratio, resourceId } of requests) floors.set(key(line), {
        ratio: ratio * fraction, resourceId,
      })
      return solve(configured())
    }
    const baselineFlows = new Map(baseline.allResourceFlows.map(flow => [flow.resourceId, flow]))
    const findBlocker = (candidate: T): ResourceId | 'capacity' | undefined => {
      const delivered = candidate.regularResults.find(result => key(result) === key(root))?.actualOutputs
        .find(output => output.resourceId === firstInput.resourceId)?.quantity ?? 0
      const promised = requests[0]
      const promisedQuantity = promised ? available * (floors.get(key(promised.line))?.ratio ?? 0) / (promised.ratio || 1) : 0

      if (delivered < promisedQuantity - TOLERANCE) return 'capacity'
      const shortage = candidate.allResourceFlows.find(flow => (
        flow.net < Math.min(0, baselineFlows.get(flow.resourceId)?.net ?? 0) - TOLERANCE
      ))

      if (shortage) return shortage.resourceId
      if (requests.some(({ line }) => {
        const actual = candidate.regularResults.find(result => key(result) === key(line))?.supplyRatio ?? 0

        return actual < (floors.get(key(line))?.ratio ?? 0) - TOLERANCE
      })) return 'capacity'
      return undefined
    }
    const evaluation: { candidate: T; blocker?: ResourceId | 'capacity' } = { candidate: attempt(route.maximum) }

    evaluation.blocker = findBlocker(evaluation.candidate)

    if (evaluation.blocker) {
      // Existing shortages have no spare supply to fund this route. For a
      // new shortage, interpolate its available share before refining. This
      // avoids twenty complete factory solves inside every dispatch probe.
      const bracket = { feasible: 0, infeasible: route.maximum, fraction: route.maximum }

      for (const pass = { iteration: 0 }; pass.iteration < 8; pass.iteration++) {
        const limits = evaluation.candidate.allResourceFlows.flatMap(flow => {
          const before = baselineFlows.get(flow.resourceId)?.net ?? 0

          if (flow.net >= Math.min(0, before) - TOLERANCE) return []
          return [bracket.fraction * Math.max(0, before) / (before - flow.net)]
        })
        const projected = limits.length > 0 ? Math.min(...limits) : (bracket.feasible + bracket.infeasible) / 2

        bracket.fraction = Math.max(bracket.feasible, Math.min(bracket.infeasible, projected))
        if (bracket.fraction < 1e-6) break
        const trial = attempt(bracket.fraction)

        if (findBlocker(trial)) { bracket.infeasible = bracket.fraction; evaluation.candidate = trial }
        else { bracket.feasible = bracket.fraction; break }
      }
      route.maximum = bracket.feasible < 1e-6 ? 0 : bracket.feasible
      evaluation.candidate = attempt(route.maximum)
    } else if (route.maximum < 1 - TOLERANCE) evaluation.blocker = 'capacity'

    if (evaluation.blocker) for (const { line } of requests) blockers.set(key(line), evaluation.blocker)
    // Attach the final requirement/blocker to the accepted results without an
    // extra full solve, including paused consumers and zero-throughput routes.
    for (const regular of evaluation.candidate.regularResults) {
      regular.processingRequiredBuildings = required.get(key(regular))
      regular.processingBlockedBy = blockers.get(key(regular))
    }
    calculation.result = evaluation.candidate
  }
  return calculation.result
}
