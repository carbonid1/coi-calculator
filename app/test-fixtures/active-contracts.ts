import {
  type ActiveContract,
  type ContractRoute,
  contracts,
} from '../db/contracts'
import { type ResourceId } from '../db/resources'

interface ModuleGroup {
  buildingName: string
  count: number
  direction: 'export' | 'import'
  prototypeId: string
  resourceId: ResourceId
}

const defineRoute = (
  depotEntityId: number,
  modules: readonly ModuleGroup[],
  importedPerProductionCycle: number | null,
  roundTripDurationProductionCycles: number | null,
): ContractRoute => ({
  id: `test-contract-route-${depotEntityId}`,
  source: 'planned',
  depotEntityId,
  depotPrototypeId: 'CargoDepotT2',
  depotName: 'Cargo Depot (4)',
  depotSize: 4,
  enabled: true,
  running: true,
  zones: [],
  cargoModules: modules.flatMap((group, groupIndex) => (
    Array.from({ length: group.count }, (_, moduleIndex) => ({
      entityId: depotEntityId * 10 + groupIndex * 4 + moduleIndex,
      prototypeId: group.prototypeId,
      buildingName: group.buildingName,
      direction: group.direction,
      resourceId: group.resourceId,
      workers: 5,
      running: true,
      onboardCapacity: 800,
    }))
  )).map((module, slot) => ({ ...module, slot })),
  ship: {
    entityId: depotEntityId * 100,
    prototypeId: 'CargoShipT2',
    name: 'Cargo Ship (4)',
    workers: 22,
    running: true,
  },
  shipping: {
    fuelResourceId: 'hydrogen',
    saveFuel: true,
    roundTripDurationProductionCycles,
    fuelPerTrip: null,
  },
  importedPerProductionCycle,
})

const defineActiveContract = (
  contractId: string,
  route: ContractRoute,
): ActiveContract => {
  const contract = contracts.find(candidate => candidate.id === contractId)

  if (!contract) throw new Error(`Unknown test contract: ${contractId}`)

  return { ...contract, gameId: `test-${contract.id}`, routes: [route] }
}

export const activeContracts: ActiveContract[] = [
  defineActiveContract('uranium-ore-for-food-pack', defineRoute(1, [
    { buildingName: 'Unit Module (L)', count: 2, direction: 'export', prototypeId: 'CargoDepotModuleUnitT3', resourceId: 'foodPack' },
    { buildingName: 'Loose Module (L)', count: 2, direction: 'import', prototypeId: 'CargoDepotModuleLooseT3', resourceId: 'uraniumOre' },
  ], 54, 427 / 60)),
  defineActiveContract('titanium-ore-for-construction-parts-iv', defineRoute(2, [
    { buildingName: 'Unit Module (L)', count: 2, direction: 'export', prototypeId: 'CargoDepotModuleUnitT3', resourceId: 'constructionPartsIV' },
    { buildingName: 'Loose Module (L)', count: 2, direction: 'import', prototypeId: 'CargoDepotModuleLooseT3', resourceId: 'titaniumOre' },
  ], null, 426 / 60)),
  defineActiveContract('copper-ore-for-medical-supplies-iii', defineRoute(3, [
    { buildingName: 'Unit Module (L)', count: 2, direction: 'export', prototypeId: 'CargoDepotModuleUnitT3', resourceId: 'medicalSuppliesIII' },
    { buildingName: 'Loose Module (L)', count: 2, direction: 'import', prototypeId: 'CargoDepotModuleLooseT3', resourceId: 'copperOre' },
  ], null, 426 / 60)),
  defineActiveContract('ammonia-for-food-pack', defineRoute(4, [
    { buildingName: 'Unit Module (L)', count: 2, direction: 'export', prototypeId: 'CargoDepotModuleUnitT3', resourceId: 'foodPack' },
    { buildingName: 'Fluid Module (L)', count: 2, direction: 'import', prototypeId: 'CargoDepotModuleFluidT3', resourceId: 'ammonia' },
  ], null, 427 / 60)),
  defineActiveContract('quartz-for-coal', defineRoute(5, [
    { buildingName: 'Loose Module (L)', count: 1, direction: 'export', prototypeId: 'CargoDepotModuleLooseT3', resourceId: 'coal' },
    { buildingName: 'Loose Module (L)', count: 3, direction: 'import', prototypeId: 'CargoDepotModuleLooseT3', resourceId: 'quartz' },
  ], null, 426 / 60)),
]
