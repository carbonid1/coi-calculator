import { expect, it } from 'vitest'

import {
  type SyncedAreaEntity,
  type SyncedProductionEntity,
} from '../../game-state'
import { buildModuleLines } from '../../helpers/build-module-lines/build-module-lines'
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from '../static-infrastructure'
import {
  attachStaticInfrastructureToModule,
  partitionStationLines,
  isAreaAssignableStaticInfrastructurePrototype,
  resolveStaticInfrastructureModuleAssignments,
  selectStaticInfrastructureLines,
} from './area-static-infrastructure'
import { modules, type Module } from './modules'

const createModule = (id: string, name: string): Module => ({
  id,
  name,
  description: '',
  builtBuildings: {},
  presets: [{
    id: 'current',
    name: 'Current',
    description: '',
    activeBuildings: {},
    fixed: [],
  }],
  defaultPresetId: 'current',
})

const defaultModule = createModule('default', 'Default')
const nuclearModule = createModule('nuclear', 'Nuclear')
const copperModule = createModule('live-area-16', 'Copper #1')

const productionEntity = (
  entityId: number,
  prototypeId: string,
  zoneNames: string[],
  running = true,
  selectedProduct?: { productId: string; name: string },
  isForLoading?: boolean,
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running,
  recipeIds: [],
  zones: zoneNames.map((name, index) => ({ id: entityId * 10 + index, name })),
  nuclearReactor: null,
  dataCenterRacks: null,
  trainStation: selectedProduct || isForLoading !== undefined
    ? { isForLoading: isForLoading ?? false, selectedProduct: selectedProduct ?? null }
    : undefined,
})

const areaEntity = (
  entityId: number,
  prototypeId: string,
  zoneName: string,
): SyncedAreaEntity => ({
  entityId,
  prototypeId,
  prototypeName: 'Loose station module (electrified)',
  constructionState: 'NotStarted',
  constructed: false,
  running: false,
  tile: { x: entityId, y: 0 },
  zones: [{ id: 16, name: zoneName }],
  recipes: [],
})

const config = (
  values: Partial<StaticInfrastructureConfig>,
): StaticInfrastructureConfig => ({
  ...emptyStaticInfrastructureConfig,
  ...values,
})

it('moves stationary infrastructure to an exact area while global assets remain in Default', () => {
  const assignments = resolveStaticInfrastructureModuleAssignments({
    builtConfig: config({
      electricLocomotiveII: 3,
      unitStationModuleElectrified: 2,
      vehicles: 20,
    }),
    runningConfig: config({
      electricLocomotiveII: 3,
      unitStationModuleElectrified: 1,
      vehicles: 20,
    }),
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, nuclearModule],
    productionEntities: [
      productionEntity(1, 'TrainStationUnit_ELEC', ['Nuclear']),
      productionEntity(2, 'LocomotiveT2Electric', ['Nuclear']),
    ],
  })

  expect(assignments.nuclear).toMatchObject({
    builtBuildings: { 'static-unit-station-module-electrified': 1 },
    activeBuildings: { 'static-unit-station-module-electrified': 1 },
  })
  expect(assignments.default).toMatchObject({
    builtBuildings: {
      'static-electric-locomotive-ii': 3,
      'static-unit-station-module-electrified': 1,
      'static-vehicles': 20,
    },
    activeBuildings: {
      'static-electric-locomotive-ii': 3,
      'static-unit-station-module-electrified': 0,
      'static-vehicles': 20,
    },
  })
})

it('places a station construction ghost in its live area without counting it as built', () => {
  const assignments = resolveStaticInfrastructureModuleAssignments({
    areaEntities: [areaEntity(7, 'TrainStationLoose_ELEC', 'Copper #1')],
    builtConfig: config({}),
    runningConfig: config({}),
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, copperModule],
  })
  const assignment = assignments[copperModule.id]

  if (!assignment) throw new Error('Missing Copper infrastructure assignment')

  const configured = attachStaticInfrastructureToModule(copperModule, assignment, 'synced')
  const line = buildModuleLines(configured, configured.presets[0] ?? null).lines[0]

  expect(line).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 0,
    constructionGhosts: 1,
    currentActiveBuildings: 0,
    dataSource: 'synced',
    operatingMode: 'fixed',
  })
})

it('groups stations by their synced selected product without adding material flows', () => {
  const assignments = resolveStaticInfrastructureModuleAssignments({
    builtConfig: config({ looseStationModuleElectrified: 2 }),
    runningConfig: config({ looseStationModuleElectrified: 2 }),
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, copperModule],
    productionEntities: [
      productionEntity(
        9,
        'TrainStationLoose_ELEC',
        ['Copper #1'],
        true,
        { productId: 'Product_CopperOreCrushed', name: 'Copper Ore Crushed' },
      ),
      productionEntity(
        10,
        'TrainStationLoose_ELEC',
        ['Copper #1'],
        true,
        { productId: 'Product_CopperOreCrushed', name: 'Copper Ore Crushed' },
      ),
    ],
  })
  const assignment = assignments[copperModule.id]

  if (!assignment) throw new Error('Missing Copper infrastructure assignment')

  const configured = attachStaticInfrastructureToModule(copperModule, assignment, 'synced')
  const stationLine = buildModuleLines(configured, configured.presets[0] ?? null).lines[0]

  expect(stationLine).toMatchObject({
    activeBuildings: 2,
    builtBuildings: 2,
    recipe: {
      building: 'Loose station module (electrified)',
      displayName: 'Copper Ore Crushed · unloading',
      stationRole: 'input',
      inputs: [],
      outputs: [],
    },
  })
  expect(assignments.default?.builtBuildings).toMatchObject({
    'static-loose-station-module-electrified': 0,
  })
})

it('keeps loading, unloading, and legacy station cards in separate sections', () => {
  const lines = [
    {
      recipe: {
        id: 'static-loose-station-module-electrified:product:unloading:Product_Copper',
        stationRole: 'input' as const,
      },
    },
    { recipe: { id: 'maintenance-ii' } },
    {
      recipe: {
        id: 'static-unit-station-module-electrified:product:loading:Product_Copper',
        stationRole: 'export' as const,
      },
    },
    { recipe: { id: 'static-fluid-station-module-electrified' } },
  ]

  const sections = partitionStationLines(lines)

  expect(sections.input).toEqual([lines[0]])
  expect(sections.unconfigured).toEqual([lines[3]])
  expect(sections.content).toEqual([lines[1]])
  expect(sections.export).toEqual([lines[2]])
})

it('retains station direction when no product is selected yet', () => {
  const assignments = resolveStaticInfrastructureModuleAssignments({
    builtConfig: config({ looseStationModuleElectrified: 1 }),
    runningConfig: config({ looseStationModuleElectrified: 1 }),
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, copperModule],
    productionEntities: [
      productionEntity(11, 'TrainStationLoose_ELEC', ['Copper #1'], true, undefined, true),
    ],
  })
  const assignment = assignments[copperModule.id]

  if (!assignment) throw new Error('Missing Copper infrastructure assignment')

  const configured = attachStaticInfrastructureToModule(copperModule, assignment, 'synced')
  const [stationLine] = buildModuleLines(configured, configured.presets[0] ?? null).lines

  expect(stationLine?.recipe).toMatchObject({
    displayName: 'No product selected · loading',
    stationRole: 'export',
  })
})

it('keeps an ambiguously overlapping station in Default', () => {
  const entity = areaEntity(8, 'TrainStationLoose_ELEC', 'Nuclear')

  entity.zones.push({ id: 17, name: 'Copper #1' })

  const assignments = resolveStaticInfrastructureModuleAssignments({
    areaEntities: [entity],
    builtConfig: config({}),
    runningConfig: config({}),
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, nuclearModule, copperModule],
  })

  expect(assignments.default?.constructionGhosts).toMatchObject({
    'static-loose-station-module-electrified': 1,
  })
  expect(assignments.nuclear?.constructionGhosts).toEqual({})
  expect(assignments[copperModule.id]?.constructionGhosts).toEqual({})
})

it('selects static infrastructure cards for specialized module layouts', () => {
  const lines = [
    { recipe: { id: 'static-unit-station-module-electrified' } },
    { recipe: { id: 'static-unit-station-module-electrified:product:loading:Product_Copper' } },
    { recipe: { id: 'maintenance-ii' } },
  ]

  expect(selectStaticInfrastructureLines(lines)).toEqual([lines[0], lines[1]])
})

it('does not expose a separate Infrastructure tab', () => {
  expect(modules.some(module => module.name === 'Infrastructure')).toBe(false)
})

it('treats the recipe-less station root as handled infrastructure', () => {
  expect(isAreaAssignableStaticInfrastructurePrototype('TrainStationRoot_ELEC')).toBe(true)
})
