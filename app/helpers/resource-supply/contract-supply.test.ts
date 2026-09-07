import { describe, expect, it } from 'vitest'

import { activeContracts } from '../../test-fixtures/active-contracts'
import { applyContracts } from '../contracts/calculate-contracts'
import { getContractResourceFlows } from '../contracts/contract-resource-flows'
import { getContractSupplyRows } from './resource-supply'

const ammoniaContract = activeContracts.find(contract => contract.id === 'ammonia-for-food-pack')!
const route = ammoniaContract.routes[0]!

describe('contract supply provenance', () => {
  it('groups multiple routes once, keeping imports, payment and distinct ship fuels', () => {
    const { contractResults } = applyContracts([], [{ ...ammoniaContract, routes: [
      { ...route, id: 'hydrogen-route', importedPerProductionCycle: 12 },
      { ...route, id: 'diesel-route', importedPerProductionCycle: 18,
        shipping: { ...route.shipping, fuelResourceId: 'diesel' } },
    ] }])
    const flows = getContractResourceFlows(contractResults)
    const rows = getContractSupplyRows(flows, 'ammonia')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      contractId: ammoniaContract.id, contractName: 'Food Pack → Ammonia',
      imports: [{ resourceId: 'ammonia', quantity: 30 }],
      exports: [{ resourceId: 'foodPack', quantity: 5 }],
    })
    expect(rows[0]?.fuel).toHaveLength(2)
    expect(rows[0]?.fuel.reduce((sum, fuel) => sum + fuel.quantity, 0))
      .toBeCloseTo(contractResults[0]!.fuelPerProductionCycle)
    expect(getContractSupplyRows(flows, 'foodPack')).toEqual(rows)
    expect(getContractSupplyRows(flows, 'hydrogen')).toEqual(rows)
    expect(getContractSupplyRows(flows, 'water')).toEqual([])
  })

  it('shows a requested but stopped import without inventing deliveries or costs', () => {
    const { contractResults } = applyContracts([], [{ ...ammoniaContract, routes: [
      { ...route, running: false, importedPerProductionCycle: 20 },
    ] }])
    const flows = getContractResourceFlows(contractResults)

    expect(getContractSupplyRows(flows, 'ammonia')[0]).toMatchObject({
      importLimits: ['paused'],
      imports: [{ resourceId: 'ammonia', quantity: 0 }],
      exports: [{ resourceId: 'foodPack', quantity: 0 }],
      fuel: [{ resourceId: 'hydrogen', quantity: 0 }],
    })
    expect(getContractSupplyRows(flows, 'foodPack')).toEqual([])
    expect(getContractSupplyRows(flows, 'hydrogen')).toEqual([])
  })
})
