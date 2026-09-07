import { expect, it } from 'vitest'
import { activeContracts } from '../../test-fixtures/active-contracts'
import { createWorldRoute } from '../../test-fixtures/world-mines'
import { applyContracts, calculateContractWorkers } from './calculate-contracts'
import { getContractResourceFlows } from './contract-resource-flows'

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
  expect(getContractResourceFlows(contractResults)[0]?.importLimit).toBe('voyage-unmeasured')
})

it.each(['shore-storage', 'ship-fuel', 'dock', 'workers', 'module-state', 'all'])
('keeps steady contract throughput through temporary %s conditions', condition => {
  const { contract, route } = syncedContract()
  const baseline = applyContracts([], [contract]).contractResults[0]!

  if (condition === 'shore-storage' || condition === 'all') {
    route.operation!.modules[0]!.onboardQuantity = 10
    route.operation!.modules[0]!.shoreFreeCapacity = 0
  }
  if (condition === 'ship-fuel' || condition === 'all') route.operation!.ship!.state = 'NotEnoughFuel'
  if (condition === 'dock' || condition === 'all') route.operation!.dockBlocked = true
  if (condition === 'workers' || condition === 'all') route.ship!.workers = 0
  if (condition === 'module-state' || condition === 'all') {
    for (const cargoModule of route.operation!.modules) cargoModule.operational = false
  }

  const { contractResults } = applyContracts([], [contract])

  expect(baseline.imported).toBeGreaterThan(0)
  expect(contractResults[0]).toMatchObject({
    imported: baseline.imported,
    exported: baseline.exported,
    maxImportedPerProductionCycle: baseline.maxImportedPerProductionCycle,
    fuelPerProductionCycle: baseline.fuelPerProductionCycle,
  })
  expect(getContractResourceFlows(contractResults)[0]?.importLimit).toBeUndefined()
})
