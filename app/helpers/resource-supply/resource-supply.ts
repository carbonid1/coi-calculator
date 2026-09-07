import { type ModuleResourceTransfer } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { resourceSupplyRules } from '../../db/resource-supply'
import { resources, type ResourceId } from '../../db/resources'
import { type FactoryCalculation } from '../factory-calculation/factory-calculation'
import { type ModuleResourceBoundary } from '../module-resource-boundary/module-resource-boundary'

export interface ResourceSupplyRow {
  moduleId: string
  moduleName: string
  produced: number
  used: number
  disposed: number
  /** Recipe balance after dedicated transfers; never a delivered factory import. */
  balance: number
  uses: { name: string; quantity: number }[]
  incoming: ModuleResourceTransfer[]
  outgoing: ModuleResourceTransfer[]
  boundary: ModuleResourceBoundary | null
}

/** Preserve provenance without inventing pairwise transfers through the shared pool. */
export const getResourceSupplyRows = (
  modules: readonly Module[],
  calculation: FactoryCalculation,
  resourceId: ResourceId,
): ResourceSupplyRow[] => {
  const { factoryResult, linkedModulesResult } = calculation

  return modules.flatMap(module => {
    const localResult = linkedModulesResult.moduleResults.get(module.id)

    if (module.includedInFactoryTotals === false && !localResult) return []

    const result = localResult ?? factoryResult.calculation
    const preset = module.presets.find(candidate => candidate.id === module.defaultPresetId)
    const uses = new Map<string, number>()
    let produced = 0
    let used = 0
    let disposed = 0

    for (const line of [...result.regularResults, ...result.sourceResults, ...result.sinkResults]) {
      if (line.moduleId !== module.id) continue

      const consumed = line.actualInputs.reduce((sum, input) => (
        sum + (input.resourceId === resourceId ? input.quantity : 0)
      ), 0)

      produced += line.actualOutputs.reduce((sum, output) => (
        sum + (output.resourceId === resourceId ? output.quantity : 0)
      ), 0)
      // Cooling/recovery is useful consumption; only terminal sinks are disposal.
      if (line.recipe.group === 'sink' && line.recipe.outputs.length === 0) {
        disposed += consumed
      } else {
        used += consumed
        const product = line.actualOutputs.find(output => (
          output.quantity > 0 && line.recipe.balanceOutputIds?.includes(output.resourceId)
        )) ?? line.actualOutputs.find(output => output.quantity > 0)
        const name = product ? resources[product.resourceId].name : 'Other use'

        if (consumed > 0) uses.set(name, (uses.get(name) ?? 0) + consumed)
      }
    }

    const fixedDemand = Math.max(0, preset?.fixedDemands?.[resourceId] ?? 0)

    used += fixedDemand
    if (fixedDemand > 0) uses.set('Module demand', fixedDemand)

    const incoming = linkedModulesResult.transfers.filter(transfer => (
      transfer.resourceId === resourceId && transfer.targetModuleId === module.id
    ))
    const outgoing = linkedModulesResult.transfers.filter(transfer => (
      transfer.resourceId === resourceId && transfer.sourceModuleId === module.id
    ))
    const balance = produced - used - disposed
      + incoming.reduce((sum, transfer) => sum + transfer.quantity, 0)
      - outgoing.reduce((sum, transfer) => sum + transfer.quantity, 0)
    const boundary = linkedModulesResult.boundaries.find(candidate => (
      candidate.moduleId === module.id && candidate.resourceId === resourceId
    )) ?? null

    if (produced + used + disposed < 0.001 && incoming.length === 0 && outgoing.length === 0
      && !boundary?.factoryDemand && !boundary?.factorySupply) return []

    return [{
      moduleId: module.id,
      moduleName: module.name,
      produced,
      used,
      disposed,
      balance,
      uses: [...uses].map(([name, quantity]) => ({ name, quantity }))
        .toSorted((left, right) => right.quantity - left.quantity),
      incoming,
      outgoing,
      boundary,
    }]
  }).toSorted((left, right) => left.moduleName.localeCompare(right.moduleName))
}

export const getResourceSupplyAccess = (
  row: ResourceSupplyRow,
  resourceId: ResourceId,
) => row.boundary?.rule.access ?? resourceSupplyRules[resourceId] ?? 'factory'
