import { type ResourceId } from '../../db/resources'
import { type ProductionLine, type RegularResult, type ResourceFlow } from '../calculate/calculate'
import { getRecipeInputQuantity, getRecipeOutputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { getModuleInputIds } from '../recipe-input-scope/recipe-input-scope'

const TOLERANCE = 1e-7
const key = (line: Pick<ProductionLine, 'moduleId' | 'recipe'>) => `${line.moduleId}:${line.recipe.id}`

type Balance = Pick<ResourceFlow, 'resourceId' | 'net' | 'produced' | 'consumed'>
interface ChainSolve {
  result: { regularResults: RegularResult[]; allResourceFlows: ResourceFlow[] }
  restrictedModuleBalances: ReadonlyMap<string, Balance>
}

/**
 * Reserve a linear route inside the ordinary material/capacity ledger. Each
 * attempt is a complete solve: supporting production and displaced alternatives
 * must settle before accepting extra processing. No synthetic supply is added.
 */
export const calculateProcessingChains = <T extends ChainSolve>(
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
    allocationLimit: roots.get(key(line)) ?? line.allocationLimit,
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
    const results = new Map(baseline.result.regularResults.map(result => [key(result), result]))
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
    const baselineFlows = new Map(baseline.result.allResourceFlows.map(flow => [flow.resourceId, flow]))
    const supportingInputs = new Set(requests.flatMap(({ line, resourceId }) =>
      line.recipe.inputs.filter(input => input.resourceId !== resourceId).map(input => input.resourceId),
    ))
    const findShortage = (flow: Balance, before: Balance | undefined) => {
      const allowedNet = Math.min(0, before?.net ?? 0)

      if (flow.net >= allowedNet - TOLERANCE) return undefined
      const previousNet = before?.net ?? 0

      // Indirect shortages can include displaced production elsewhere in the
      // factory. Use its settled slack instead of treating that output as a
      // supporting producer that the route can call on.
      if (!supportingInputs.has(flow.resourceId)) return {
        resourceId: flow.resourceId,
        share: Math.max(0, previousNet) / (previousNet - flow.net),
      }
      const baselineConsumption = before?.consumed ?? 0
      const extraConsumption = flow.consumed - baselineConsumption
      const available = flow.produced - baselineConsumption - allowedNet

      return {
        resourceId: flow.resourceId,
        share: extraConsumption > 0 ? Math.max(0, available) / extraConsumption : undefined,
      }
    }
    const findBlocker = (candidate: T): { resourceId: ResourceId | 'capacity'; share?: number } | undefined => {
      const delivered = candidate.result.regularResults.find(result => key(result) === key(root))?.actualOutputs
        .find(output => output.resourceId === firstInput.resourceId)?.quantity ?? 0
      const promised = requests[0]
      const promisedQuantity = promised ? available * (floors.get(key(promised.line))?.ratio ?? 0) / (promised.ratio || 1) : 0

      if (delivered < promisedQuantity - TOLERANCE) return { resourceId: 'capacity' }
      for (const flow of candidate.result.allResourceFlows) {
        const shortage = findShortage(flow, baselineFlows.get(flow.resourceId))

        if (shortage) return shortage
      }
      for (const [scope, flow] of candidate.restrictedModuleBalances) {
        const shortage = findShortage(flow, baseline.restrictedModuleBalances.get(scope))

        if (shortage) return shortage
      }
      if (requests.some(({ line }) => {
        const actual = candidate.result.regularResults.find(result => key(result) === key(line))?.supplyRatio ?? 0

        return actual < (floors.get(key(line))?.ratio ?? 0) - TOLERANCE
      })) return { resourceId: 'capacity' }
      return undefined
    }
    const full = route.maximum > TOLERANCE ? attempt(route.maximum) : baseline
    const blocker = route.maximum > TOLERANCE ? findBlocker(full) : { resourceId: 'capacity' as const }
    const accepted = { fraction: blocker ? 0 : route.maximum, calculation: blocker ? baseline : full }
    const rejected = { fraction: route.maximum, blocker }
    // A demand-driven input can have zero initial flow and spare capacity.
    // Estimate its limit from the production that the full attempt unlocked.
    const resolution = 1e-5

    for (const probe = { count: 0 }; probe.count < 8 && rejected.blocker && rejected.fraction - accepted.fraction > resolution; probe.count++) {
      const projected = rejected.fraction * (rejected.blocker.share ?? 1)

      if (projected <= resolution && accepted.fraction === 0) break
      const hasEstimate = projected > accepted.fraction + resolution && projected < rejected.fraction
      const fraction = hasEstimate ? projected : (accepted.fraction + rejected.fraction) / 2
      const trial = attempt(fraction)
      const shortage = findBlocker(trial)

      if (shortage) {
        rejected.fraction = fraction
        rejected.blocker = shortage
      } else {
        accepted.fraction = fraction
        accepted.calculation = trial
        if (hasEstimate) break
      }
    }
    const reason = rejected.blocker?.resourceId ?? (route.maximum < 1 - TOLERANCE ? 'capacity' : undefined)
    const settled = accepted.fraction === 0 ? attempt(0) : accepted.calculation

    for (const { line, ratio, resourceId } of requests) {
      floors.set(key(line), { ratio: ratio * accepted.fraction, resourceId })
      if (reason) blockers.set(key(line), reason)
    }
    // Attach the requirement and blocker even when the linked allocation is zero.
    for (const regular of settled.result.regularResults) {
      regular.processingRequiredBuildings = required.get(key(regular))
      regular.processingBlockedBy = blockers.get(key(regular))
    }
    calculation.result = settled
  }
  return calculation.result
}
