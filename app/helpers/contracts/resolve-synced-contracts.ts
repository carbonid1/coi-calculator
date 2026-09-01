import { type ContractRoutePlans } from '../../db/contract-plans'
import {
  type ActiveContract,
  type Contract,
  type ContractCargoModule,
  type ContractRoute,
  contracts as contractCatalog,
} from '../../db/contracts'
import { resources } from '../../db/resources'
import { type SyncedContractState } from '../../game-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

export interface SyncedContractIssue {
  gameId: string
  message: string
}

export interface SyncedContractResolution {
  contracts: ActiveContract[]
  claimedEntityIds: ReadonlySet<number>
  issues: SyncedContractIssue[]
}

const catalogByExchange = new Map<string, Contract>(contractCatalog.map(contract => [
  `${contract.exchange.exported.resourceId}|${contract.exchange.imported.resourceId}`,
  contract,
]))

export const getContractClaimedEntityIds = (state: SyncedContractState | null) => (
  new Set(state?.routes.flatMap(route => [
    route.depotEntityId,
    ...route.modules.map(module => module.entityId),
    ...(route.ship ? [route.ship.entityId] : []),
  ]) ?? [])
)

export const resolveSyncedContracts = (
  state: SyncedContractState | null,
  plans: ContractRoutePlans = {},
): SyncedContractResolution => {
  const claimedEntityIds = getContractClaimedEntityIds(state)

  if (!state) return { contracts: [], claimedEntityIds, issues: [] }

  const issues: SyncedContractIssue[] = []
  const routesByContractId = new Map<string, ContractRoute[]>()

  for (const route of state.routes) {
    const established = state.established.find(
      contract => contract.gameId === route.contractGameId,
    )

    if (!established) continue

    const importedResourceId = resolveSyncedResourceId(established.importedProduct)
    const exportedResourceId = resolveSyncedResourceId(established.exportedProduct)
    const fuelResourceId = route.ship
      ? resolveSyncedResourceId(route.ship.fuelProduct)
      : undefined

    if (!importedResourceId || !exportedResourceId || (route.ship && !fuelResourceId)) {
      issues.push({
        gameId: route.contractGameId,
        message: `Cargo Depot ${route.depotEntityId} uses a product the calculator does not recognize.`,
      })
      continue
    }

    const cargoModules: ContractCargoModule[] = []
    let unsupportedModule = false

    for (const cargoModule of route.modules) {
      if (!cargoModule.selectedProduct || !cargoModule.direction) {
        cargoModules.push({
          entityId: cargoModule.entityId,
          slot: cargoModule.slot,
          prototypeId: cargoModule.prototypeId,
          buildingName: cargoModule.prototypeName,
          direction: null,
          resourceId: null,
          workers: cargoModule.workers,
          running: cargoModule.running,
          onboardCapacity: cargoModule.onboardCapacity,
        })
        continue
      }

      const resourceId = resolveSyncedResourceId(cargoModule.selectedProduct)

      if (!resourceId) {
        unsupportedModule = true
        break
      }

      cargoModules.push({
        entityId: cargoModule.entityId,
        slot: cargoModule.slot,
        prototypeId: cargoModule.prototypeId,
        buildingName: cargoModule.prototypeName,
        direction: cargoModule.direction,
        resourceId,
        workers: cargoModule.workers,
        running: cargoModule.running,
        onboardCapacity: cargoModule.onboardCapacity,
      })
    }

    if (unsupportedModule) {
      issues.push({
        gameId: route.contractGameId,
        message: `Cargo Depot ${route.depotEntityId} has a module product the calculator does not recognize.`,
      })
      continue
    }

    const plan = plans[route.depotEntityId]
    const syncedRoute: ContractRoute = {
      id: `contract-route-${route.depotEntityId}`,
      source: plan ? 'planned' : 'synced',
      depotEntityId: route.depotEntityId,
      depotPrototypeId: route.depotPrototypeId,
      depotName: route.depotCustomTitle?.trim() || route.depotPrototypeName,
      depotSize: route.slotCount,
      enabled: plan?.enabled ?? true,
      running: route.running,
      zones: route.zones,
      cargoModules,
      ship: route.ship
        ? {
            entityId: route.ship.entityId,
            prototypeId: route.ship.prototypeId,
            name: route.ship.prototypeName,
            workers: route.ship.workers,
            running: route.ship.running,
          }
        : null,
      shipping: {
        fuelResourceId: fuelResourceId ?? 'diesel',
        saveFuel: route.ship?.saveFuel ?? false,
        roundTripDurationProductionCycles: route.ship?.journeyDurationSeconds
          ? route.ship.journeyDurationSeconds / 60
          : null,
        fuelPerTrip: route.ship?.fuelPerTrip ?? null,
      },
      importedPerProductionCycle: plan?.importedPerProductionCycle ?? null,
    }

    routesByContractId.set(route.contractGameId, [
      ...(routesByContractId.get(route.contractGameId) ?? []),
      syncedRoute,
    ])
  }

  const activeContracts: ActiveContract[] = []

  for (const syncedContract of state.established) {
    const importedResourceId = resolveSyncedResourceId(syncedContract.importedProduct)
    const exportedResourceId = resolveSyncedResourceId(syncedContract.exportedProduct)

    if (!importedResourceId || !exportedResourceId) {
      issues.push({
        gameId: syncedContract.gameId,
        message: 'This established contract uses a product the calculator does not recognize.',
      })
      continue
    }

    const catalogContract = catalogByExchange.get(`${exportedResourceId}|${importedResourceId}`)

    if (!catalogContract) {
      issues.push({
        gameId: syncedContract.gameId,
        message: 'This established contract is missing from the installed game catalog.',
      })
      continue
    }

    activeContracts.push({
      ...catalogContract,
      gameId: syncedContract.gameId,
      name: `${resources[exportedResourceId].name} → ${resources[importedResourceId].name}`,
      exchange: {
        exported: {
          resourceId: exportedResourceId,
          quantity: syncedContract.exportedQuantity,
        },
        imported: {
          resourceId: importedResourceId,
          quantity: syncedContract.importedQuantity,
        },
      },
      unity: {
        perProductionCycle: syncedContract.unityPerCycle,
        per100Imported: syncedContract.unityPer100Imported,
        establish: syncedContract.unityToEstablish,
      },
      minimumReputation: syncedContract.minimumReputation,
      routes: (routesByContractId.get(syncedContract.gameId) ?? [])
        .toSorted((left, right) => (
          (left.depotEntityId ?? Number.MAX_SAFE_INTEGER)
          - (right.depotEntityId ?? Number.MAX_SAFE_INTEGER)
        )),
    })
  }

  return { contracts: activeContracts, claimedEntityIds, issues }
}
