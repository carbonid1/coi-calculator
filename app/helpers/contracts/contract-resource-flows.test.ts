import { describe, expect, it } from 'vitest'

import { contracts, type ActiveContract } from '../../db/contracts'
import { activeContracts } from '../../test-fixtures/active-contracts'
import { calculateFactoryTotal } from '../factory-total/factory-total'

const contractWith = (id: string, fixed: number | null = null): ActiveContract => {
  const contract = contracts.find(contract => contract.id === id)!
  const template = activeContracts[0]!.routes[0]!

  return { ...contract, gameId: id, routes: [{
    ...template, id: `${id}:route`, importedPerProductionCycle: fixed,
    shipping: { ...template.shipping },
    cargoModules: template.cargoModules.map(cargo => ({ ...cargo,
      resourceId: cargo.direction === 'import' ? contract.exchange.imported.resourceId : contract.exchange.exported.resourceId,
    })),
  }] }
}

describe('contract accounting across the factory', () => {
  it.each([true, false])('counts payment imported by another contract once (payment contract first: %s)', paymentFirst => {
    const limestone = contractWith('limestone-for-iron-ore')
    const iron = contractWith('iron-ore-for-server')
    const result = calculateFactoryTotal([], {
      contracts: paymentFirst ? [iron, limestone] : [limestone, iron],
      externalDemands: { limestone: 10 }, recyclingEfficiencyPercent: 100,
    })

    expect(result.contractResults.find(result => result.contract.id === limestone.id)?.imported).toBeCloseTo(10)
    expect(result.contractResults.find(result => result.contract.id === iron.id)?.imported).toBeCloseTo(10)
    expect(result.flows.find(flow => flow.resourceId === 'ironOre')?.net).toBeCloseTo(0)
  })

  it.each([true, false])('reserves a fixed import once before demand-balanced contracts (fixed first: %s)', fixedFirst => {
    const fixed = contractWith('uranium-ore-for-food-pack', 5)
    const balanced = contractWith('uranium-ore-for-gold')
    const result = calculateFactoryTotal([], {
      contracts: fixedFirst ? [fixed, balanced] : [balanced, fixed],
      externalDemands: { uraniumOre: 10 }, recyclingEfficiencyPercent: 100,
    })

    expect(result.contractResults.map(result => result.imported)).toEqual([5, 5])
    expect(result.flows.find(flow => flow.resourceId === 'uraniumOre')?.net).toBeCloseTo(0)
  })

  it('keeps the named import, payment and fuel flows identical to the solver totals', () => {
    const result = calculateFactoryTotal([], {
      contracts: [contractWith('ammonia-for-food-pack')],
      externalDemands: { ammonia: 21.25 }, recyclingEfficiencyPercent: 100,
    })

    for (const resourceId of ['ammonia', 'foodPack', 'hydrogen'] as const) {
      const entries = result.contractFlows.filter(flow => flow.resourceId === resourceId)
      const supplied = entries.filter(flow => flow.kind === 'import').reduce((sum, flow) => sum + flow.quantity, 0)
      const spent = entries.filter(flow => flow.kind !== 'import').reduce((sum, flow) => sum + flow.quantity, 0)
      const actual = result.flows.find(flow => flow.resourceId === resourceId)

      expect(actual?.produced).toBeCloseTo(supplied)
      expect(actual?.consumed).toBeCloseTo(spent + (resourceId === 'ammonia' ? 21.25 : 0))
      expect(entries.every(flow => flow.contractName === 'Food Pack → Ammonia' && flow.routeId.length > 0)).toBe(true)
    }
  })

  it.each([
    { running: false, expectedFixed: 0, expectedBalanced: 10 },
    { running: true, expectedFixed: 8, expectedBalanced: 2 },
  ])('reserves only achievable fixed deliveries (running: $running)', ({ running, expectedFixed, expectedBalanced }) => {
    const fixed = contractWith('uranium-ore-for-food-pack', 100)

    fixed.routes[0]!.running = running
    fixed.routes[0]!.shipping.roundTripDurationProductionCycles = 200
    const result = calculateFactoryTotal([], {
      contracts: [contractWith('uranium-ore-for-gold'), fixed],
      externalDemands: { uraniumOre: 10 }, recyclingEfficiencyPercent: 100,
    })

    expect(result.contractResults.map(result => result.imported)).toEqual([expectedBalanced, expectedFixed])
    expect(result.flows.find(flow => flow.resourceId === 'uraniumOre')?.net).toBeCloseTo(0)
  })
})
