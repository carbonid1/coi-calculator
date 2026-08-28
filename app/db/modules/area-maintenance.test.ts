import { expect, it } from 'vitest'

import { type SyncedProductionEntity } from '../../game-state'
import { buildModuleLines } from '../../helpers/build-module-lines/build-module-lines'
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
  selectMaintenanceDepotLines,
} from './area-maintenance'
import { type Module } from './modules'

const createModule = (id: string, name: string): Module => ({
  id,
  name,
  description: `${name} production`,
  builtBuildings: {},
  presets: [
    {
      id: 'current',
      name: 'Current',
      description: 'Current production',
      activeBuildings: {},
      fixed: [],
    },
  ],
  defaultPresetId: 'current',
})

const defaultModule = createModule('general', 'Default')
const nuclearModule = createModule('nuclear', 'Nuclear')
const computingModule = createModule('computing', 'Computing')
const ownershipModules = [defaultModule, nuclearModule, computingModule]

const depotEntity = (
  entityId: number,
  prototypeId: string,
  recipeIds: string[],
  zoneNames: string[] = [],
  running = true,
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running,
  recipeIds,
  zones: zoneNames.map((name, index) => ({ id: entityId * 10 + index, name })),
  nuclearReactor: null,
  dataCenterRacks: null,
})

it('keeps the modeled depot plan under Default until depot identities are available', () => {
  const assignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: defaultModule.id,
    demand: { maintenanceI: 547.8, maintenanceII: 194.22, maintenanceIII: 236.55 },
    modules: ownershipModules,
  })

  expect(assignments.general).toMatchObject({
    builtBuildings: {
      'maintenance-i-recycling': 2,
      'maintenance-ii-recycling': 1,
      'maintenance-iii-recycling': 2,
    },
    activeBuildings: {
      'maintenance-i-recycling': 2,
      'maintenance-ii-recycling': 1,
      'maintenance-iii-recycling': 2,
    },
    recipeOutputTargets: {
      'maintenance-i-recycling': { maintenanceI: 547.8 },
      'maintenance-ii-recycling': { maintenanceII: 194.22 },
      'maintenance-iii-recycling': { maintenanceIII: 236.55 },
    },
  })
})

it('assigns unzoned depots to Default and preserves their selected recipe', () => {
  const assignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: defaultModule.id,
    demand: { maintenanceI: 480, maintenanceII: 0, maintenanceIII: 0 },
    modules: ownershipModules,
    productionEntities: [
      depotEntity(1, 'MaintenanceDepotT1', ['MaintenanceT1Recycling']),
      depotEntity(2, 'MaintenanceDepotT1', ['MaintenanceT1'], [], false),
    ],
  })

  expect(assignments.general).toMatchObject({
    builtBuildings: {
      'maintenance-i-recycling': 1,
      'maintenance-i': 1,
    },
    activeBuildings: {
      'maintenance-i-recycling': 1,
      'maintenance-i': 0,
    },
    recipeOutputTargets: {
      'maintenance-i-recycling': { maintenanceI: 480 },
    },
  })
})

it('moves a depot with an exact named area and falls back on overlaps', () => {
  const assignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: defaultModule.id,
    modules: ownershipModules,
    productionEntities: [
      depotEntity(1, 'MaintenanceDepotT2', ['MaintenanceT2Recycling'], ['Nuclear']),
      depotEntity(2, 'MaintenanceDepotT3', ['MaintenanceT3Recycling'], ['Nuclear', 'Computing']),
    ],
  })

  expect(assignments.nuclear?.builtBuildings).toEqual({
    'maintenance-ii-recycling': 1,
  })
  expect(assignments.general?.builtBuildings).toEqual({
    'maintenance-iii-recycling': 1,
  })
})

it('selects every maintenance depot recipe variant for specialized area layouts', () => {
  const lines = [
    'maintenance-i-basic',
    'maintenance-i',
    'maintenance-i-recycling',
    'maintenance-ii',
    'maintenance-ii-recycling',
    'maintenance-iii',
    'maintenance-iii-recycling',
    'air-separator',
  ].map(id => ({ recipe: { id } }))

  expect(selectMaintenanceDepotLines(lines).map(line => line.recipe.id)).toEqual([
    'maintenance-i-basic',
    'maintenance-i',
    'maintenance-i-recycling',
    'maintenance-ii',
    'maintenance-ii-recycling',
    'maintenance-iii',
    'maintenance-iii-recycling',
  ])
})

it('adds synced depot cards and observed targets to the owning module', () => {
  const assignment = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: defaultModule.id,
    demand: { maintenanceI: 480, maintenanceII: 0, maintenanceIII: 0 },
    modules: [defaultModule],
    productionEntities: [depotEntity(1, 'MaintenanceDepotT1', ['MaintenanceT1Recycling'])],
  }).general!
  const configured = attachMaintenanceDepotsToModule(defaultModule, assignment, 'synced')
  const line = buildModuleLines(configured, configured.presets[0]).lines.find(
    candidate => candidate.recipe.id === 'maintenance-i-recycling',
  )

  expect(line).toMatchObject({
    activeBuildings: 1,
    allocationRatio: 1,
    builtBuildings: 1,
    dataSource: 'synced',
    moduleId: 'general',
    operatingMode: 'fixed',
  })
  expect(configured.localResources).toEqual(['maintenanceI', 'maintenanceII', 'maintenanceIII'])
})

it("splits one tier's observed demand across mixed live recipes by capacity", () => {
  const assignment = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: defaultModule.id,
    demand: { maintenanceI: 700, maintenanceII: 0, maintenanceIII: 0 },
    modules: [defaultModule],
    productionEntities: [
      depotEntity(1, 'MaintenanceDepotT0', ['MaintenanceT0']),
      depotEntity(2, 'MaintenanceDepotT1', ['MaintenanceT1Recycling']),
    ],
  }).general

  expect(assignment?.recipeOutputTargets).toEqual({
    'maintenance-i-basic': { maintenanceI: 220 },
    'maintenance-i-recycling': { maintenanceI: 480 },
  })
})
