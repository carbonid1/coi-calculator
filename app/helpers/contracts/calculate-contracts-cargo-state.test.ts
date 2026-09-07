import { expect, it } from 'vitest'
import { activeContracts } from '../../test-fixtures/active-contracts'
import { createWorldRoute } from '../../test-fixtures/world-mines'
import { applyContracts, calculateContractWorkers } from './calculate-contracts'

const syncedContract = () => {
  const contract = structuredClone(activeContracts[0])
  const route = contract?.routes[0]

  if (!contract || !route || !route.ship) throw new Error('Missing contract test fixture')
  route.source = 'synced'
  route.shipping.fuelPerTrip = 289
  route.operation = createWorldRoute(route.cargoModules.length).operation
  route.operation.modules = route.cargoModules.map((module, index) => ({
    ...route.operation!.modules[index]!, entityId: module.entityId!, workersNeeded: module.workers,
  }))
  route.operation.ship!.workersNeeded = route.ship.workers
  return { contract, route }
}

it('preserves assigned cargo workers when a synced ship is paused', () => {
  const { contract, route } = syncedContract()

  route.ship!.running = false
  route.ship!.workers = 0
  const { contractResults } = applyContracts([], [contract])

  expect(contractResults[0]!.imported).toBe(0)
  expect(contractResults[0]!.fuelPerProductionCycle).toBe(0)
  expect(calculateContractWorkers([contract])).toBe(20)
})

it.each(['timing', 'fuel'])('does not substitute constants for missing synced voyage %s', field => {
  const { contract, route } = syncedContract()

  if (field === 'timing') route.shipping.roundTripDurationProductionCycles = null
  else route.shipping.fuelPerTrip = null
  const { contractResults } = applyContracts([], [contract])

  expect(contractResults[0]!.imported).toBe(0)
  expect(contractResults[0]!.routes[0]!.fuelUnavailable).toBe(true)
})

it('withholds contract imports while the synced ship is waiting for fuel', () => {
  const { contract, route } = syncedContract()

  route.operation!.ship!.state = 'NotEnoughFuel'
  const { contractResults } = applyContracts([], [contract])

  expect(contractResults[0]!.imported).toBe(0)
})
