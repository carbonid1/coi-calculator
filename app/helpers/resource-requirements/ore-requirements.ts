import { type FactoryCalculation } from '../factory-calculation/factory-calculation'

export interface OreRequirements {
  ironOre: number
  copperOre: number
}

/** Count material spent, not extraction, deliveries, storage targets or internal transfers. */
export const calculateOreRequirements = (calculation: FactoryCalculation): OreRequirements => {
  const quantities: OreRequirements = { ironOre: 0, copperOre: 0 }
  const results = [
    calculation.factoryResult.calculation,
    ...calculation.linkedModulesResult.moduleResults.values(),
  ]

  for (const result of results) {
    for (const line of [...result.regularResults, ...result.sourceResults, ...result.sinkResults]) {
      for (const input of line.actualInputs) {
        if (input.resourceId === 'ironOre' || input.resourceId === 'copperOre')
          quantities[input.resourceId] += input.quantity
      }
    }
  }
  for (const flow of calculation.factoryResult.contractFlows) {
    if (
      flow.kind !== 'import' &&
      (flow.resourceId === 'ironOre' || flow.resourceId === 'copperOre')
    ) {
      quantities[flow.resourceId] += flow.quantity
    }
  }

  return quantities
}
