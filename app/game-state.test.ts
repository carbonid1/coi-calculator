import { describe, expect, it } from 'vitest'

import { defaultEdictLevels, edictCatalog } from './db/edicts'
import { defaultInfiniteResearchLevels } from './db/research'
import { isGameStateSnapshot, normalizeGameStateSnapshot } from './game-state'

const snapshot = {
  schemaVersion: 7,
  exportedAtUtc: '2026-08-21T18:00:00.0000000Z',
  buildings: {
    electricLocomotiveII: { built: 21, running: 19 },
    looseStationModuleElectrified: { built: 143, running: 140 },
    fluidStationModuleElectrified: { built: 79, running: 79 },
    unitStationModuleElectrified: { built: 108, running: 100 },
    moltenStationModuleElectrified: { built: 6, running: 6 },
    oreSortingPlant: { built: 7, running: 6 },
    oreSortingPlantLarge: { built: 1, running: 1 },
    stackerTower: { built: 4, running: 3 },
    trainDepot: { built: 0, running: 0 },
    solarPanel: { built: 38, running: 38 },
    solarPanelMono: { built: 195, running: 195 },
    maintenanceStatue: { built: 3, running: 3 },
  },
  vehicles: {
    total: 39,
    workersAssigned: 34,
    trucks: 25,
    excavators: 10,
    treeHarvesters: 3,
    treePlanters: 1,
    quotaUsed: 39,
    quotaLimit: 45,
    quotaRemaining: 6,
  },
  history: {
    windowMonths: 120,
    maintenance: {
      maintenanceI: { averagePerCycle: 540.25, sampleMonths: 120 },
      maintenanceII: { averagePerCycle: 190.5, sampleMonths: 120 },
      maintenanceIII: { averagePerCycle: 230.75, sampleMonths: 120 },
    },
    hydrogenFuel: {
      total: { averagePerCycle: 46.5, sampleMonths: 120 },
      byUse: {
        vehicles: { averagePerCycle: 12.5, sampleMonths: 120 },
        cargoShips: { averagePerCycle: 34, sampleMonths: 120 },
        battleShip: { averagePerCycle: 0, sampleMonths: 120 },
        powerGenerators: { averagePerCycle: 0, sampleMonths: 120 },
        trains: { averagePerCycle: 0, sampleMonths: 120 },
      },
    },
    electricityGeneration: {
      byType: [
        {
          prototypeId: 'PowerGeneratorT2',
          name: 'Power Generator II',
          averageMw: 77,
          sampleMonths: 120,
        },
      ],
    },
  },
}

const trainTraffic = {
  totalTrains: 25,
  activeTrains: 25,
  waitingForTrack: 5,
  stuckTrains: 4,
  criticalThreshold: 3,
  severity: 'critical',
  sustainedWaitCycles: 1,
  trains: [
    {
      id: 63,
      name: 'Train #63',
      state: 'WaitingForFreeTrack',
      blockedForCycles: 2.5,
      blockingTrainId: 65,
    },
    {
      id: 64,
      name: 'Train #64',
      state: 'WaitingForSuperBlock',
      blockedForCycles: 2,
      blockingTrainId: null,
    },
    {
      id: 65,
      name: 'Train #65',
      state: 'WaitingForBidirectionalSuperBlock',
      blockedForCycles: 1.5,
      blockingTrainId: 67,
    },
    {
      id: 67,
      name: 'Train #67',
      state: 'WaitingForFreeTrack',
      blockedForCycles: 1,
      blockingTrainId: 63,
    },
  ],
}

const schema8Snapshot = {
  ...snapshot,
  schemaVersion: 8,
  trainTraffic,
}

const research = { ...defaultInfiniteResearchLevels }
const edicts = Object.fromEntries(
  edictCatalog.map(edict => {
    const level = defaultEdictLevels[edict.id]

    return [
      edict.id,
      {
        enabledLevel: level,
        activeLevel: level,
        inactiveReason: null,
      },
    ]
  }),
)

const schema9Snapshot = {
  ...schema8Snapshot,
  schemaVersion: 9,
  research,
  edicts,
}

const currentSnapshot = {
  ...schema9Snapshot,
  schemaVersion: 10,
  reserves: { gold: 6_000 },
}

const schema11Snapshot = {
  ...currentSnapshot,
  schemaVersion: 11,
  buildings: {
    ...currentSnapshot.buildings,
    trainDepot: { built: 2, running: 1 },
  },
}

const schema12Snapshot = {
  ...schema11Snapshot,
  schemaVersion: 12,
  buildings: {
    ...schema11Snapshot.buildings,
    vehiclesDepot: { built: 3, running: 2 },
    vehiclesDepotII: { built: 2, running: 1 },
    vehiclesDepotIII: { built: 1, running: 1 },
  },
}

const schema13Snapshot = {
  ...schema12Snapshot,
  schemaVersion: 13,
  reserves: { gold: 6_000, fuelGas: 12_000 },
}

const schema14Snapshot = {
  ...schema13Snapshot,
  schemaVersion: 14,
  buildings: {
    ...schema13Snapshot.buildings,
    rocketAssemblyDepot: { built: 1, running: 1 },
    rocketLaunchPad: { built: 1, running: 1 },
  },
}

const schema15Snapshot = {
  ...schema14Snapshot,
  schemaVersion: 15,
  spaceStation: {
    currentLevel: 0,
    highestLevelAchieved: 4,
    constructionPending: true,
  },
}

const computing = {
  dataCenters: { built: 5, running: 1 },
  racks: { built: 202, running: 48 },
  waterChillers: { built: 5, running: 4 },
}
const chickenFarms = {
  configurations: [
    {
      slaughtering: true,
      built: 5,
      running: 1,
      chickens: 2_350,
      runningChickens: 500,
    },
  ],
}
const cropFarms = {
  configurations: [
    {
      prototypeId: 'FarmT4',
      built: 1,
      running: 1,
      fertilityTargetPercent: 140,
      schedule: ['Crop_Potato', 'Crop_Fruits', 'Crop_Potato', 'Crop_Wheat'],
    },
  ],
}
const schema16Snapshot = {
  ...schema15Snapshot,
  schemaVersion: 16,
  computing,
  chickenFarms,
  cropFarms,
}
const machines = [
  {
    entityId: 501,
    kind: 'groundwater-pump',
    prototypeId: 'AirSeparator',
    running: true,
    customTitle: 'Greenhouse water 1',
    tile: { x: 120, y: -45 },
  },
  {
    entityId: 502,
    kind: 'groundwater-pump',
    prototypeId: 'AirSeparator',
    running: false,
    customTitle: null,
    tile: { x: 310, y: 80 },
  },
]
const schema17Snapshot = {
  ...schema16Snapshot,
  schemaVersion: 17,
  machines,
}
const zonedMachines = machines.map((machine, index) => ({
  ...machine,
  zones: index === 0
    ? [{ id: 7, name: 'Greenhouses' }]
    : [{ id: 9, name: 'Gold Mine' }],
}))
const schema18Snapshot = {
  ...schema17Snapshot,
  schemaVersion: 18,
  machines: zonedMachines,
}
const cropFarmEntities = [{
  entityId: 601,
  prototypeId: 'FarmT4',
  running: true,
  fertilityTargetPercent: 140,
  schedule: ['Crop_Potato', 'Crop_Fruits', 'Crop_Potato', 'Crop_Wheat'],
}]
const schema19Snapshot = {
  ...schema18Snapshot,
  schemaVersion: 19,
  cropFarms: {
    ...cropFarms,
    entities: cropFarmEntities,
  },
}
const chickenFarmEntities = [
  {
    entityId: 701,
    prototypeId: 'ChickenFarm',
    running: true,
    slaughtering: true,
    chickens: 500,
    zones: [{ id: 12, name: 'Chicken Farms' }],
  },
  ...[500, 500, 500, 350].map((chickens, index) => ({
    entityId: 702 + index,
    prototypeId: 'ChickenFarm',
    running: false,
    slaughtering: true,
    chickens,
    zones: [{ id: 12, name: 'Chicken Farms' }],
  })),
]
const schema20Snapshot = {
  ...schema19Snapshot,
  schemaVersion: 20,
  chickenFarms: {
    ...chickenFarms,
    entities: chickenFarmEntities,
  },
}
const schema21Snapshot = {
  ...schema20Snapshot,
  schemaVersion: 21,
  saveId: 'Carbon Island',
}
const productionEntities = [
  {
    entityId: 801,
    prototypeId: 'FastBreederReactor',
    running: true,
    recipeIds: [],
    zones: [{ id: 14, name: 'Nuclear' }],
    nuclearReactor: {
      enrichmentStep: 0,
      targetPowerPercent: 400,
    },
  },
  {
    entityId: 802,
    prototypeId: 'HydrogenReformer',
    running: false,
    recipeIds: ['HydrogenProductionFromSteamSp'],
    zones: [{ id: 14, name: 'Nuclear' }],
    nuclearReactor: null,
  },
]
const schema22Snapshot = {
  ...schema21Snapshot,
  schemaVersion: 22,
  productionEntities,
}
const computingProductionEntities = [
  ...productionEntities.map(entity => ({ ...entity, dataCenterRacks: null })),
  {
    entityId: 803,
    prototypeId: 'DataCenter',
    running: true,
    recipeIds: [],
    zones: [{ id: 15, name: 'Computing' }],
    nuclearReactor: null,
    dataCenterRacks: 48,
  },
  {
    entityId: 804,
    prototypeId: 'WaterChiller',
    running: false,
    recipeIds: [],
    zones: [{ id: 15, name: 'Computing' }],
    nuclearReactor: null,
    dataCenterRacks: null,
  },
]
const schema23Snapshot = {
  ...schema22Snapshot,
  schemaVersion: 23,
  productionEntities: computingProductionEntities,
}
const logisticsZones = [
  { id: 7, name: 'Greenhouses' },
  { id: 15, name: 'Computing' },
  { id: 20, name: 'Solar Power' },
]
const areaProductionEntities = [
  ...computingProductionEntities,
  {
    entityId: 805,
    prototypeId: 'SolarPanelMono',
    running: true,
    recipeIds: [],
    zones: [{ id: 20, name: 'Solar Power' }],
    nuclearReactor: null,
    dataCenterRacks: null,
  },
]
const schema24Snapshot = {
  ...schema23Snapshot,
  schemaVersion: 24,
  logisticsZones,
  cropFarms: {
    ...schema23Snapshot.cropFarms,
    entities: cropFarmEntities.map(entity => ({
      ...entity,
      zones: [{ id: 7, name: 'Greenhouses' }],
    })),
  },
  productionEntities: areaProductionEntities,
}
const schema25Snapshot = {
  ...schema24Snapshot,
  schemaVersion: 25,
  logisticsZones: [...logisticsZones, { id: 25, name: 'Population' }],
  productionEntities: [
    ...areaProductionEntities,
    {
      entityId: 806,
      prototypeId: 'HousingT3',
      running: true,
      recipeIds: [],
      zones: [{ id: 25, name: 'Population' }],
      nuclearReactor: null,
      dataCenterRacks: null,
    },
  ],
}
const groundwaterAquifer = {
  id: '100:200',
  position: { x: 100, y: 200 },
  quantity: 0,
  capacity: 20_000,
  configuredCapacity: 20_000,
}
const schema26Snapshot = {
  ...schema25Snapshot,
  schemaVersion: 26,
  machines: zonedMachines.map(machine => ({
    ...machine,
    aquifer: groundwaterAquifer,
  })),
  groundwater: {
    depletedPumpSpeedPercent: 40,
    replenishWhenLowPercent: 7,
  },
}

describe('game-state snapshot validation', () => {
  it('accepts the vehicle and infrastructure exporter schema', () => {
    expect(isGameStateSnapshot(snapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(snapshot)?.trainTraffic).toBeNull()
  })

  it('accepts sustained train traffic and derives a critical fleet threshold', () => {
    expect(isGameStateSnapshot(schema8Snapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(schema8Snapshot)).toMatchObject({
      research: null,
      edicts: null,
    })
    expect(isGameStateSnapshot(schema9Snapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(schema9Snapshot)).toMatchObject({
      research,
      edicts,
      reserves: null,
    })
    expect(normalizeGameStateSnapshot(currentSnapshot)).toMatchObject({
      buildings: { trainDepot: { built: 0, running: 0 } },
      reserves: { gold: 6_000, fuelGas: null },
    })
    expect(normalizeGameStateSnapshot(schema11Snapshot)).toMatchObject({
      buildings: {
        vehiclesDepot: { built: 0, running: 0 },
        vehiclesDepotII: { built: 0, running: 0 },
        vehiclesDepotIII: { built: 0, running: 0 },
      },
    })
    expect(isGameStateSnapshot(schema12Snapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(schema12Snapshot)?.trainTraffic).toEqual(trainTraffic)
    expect(normalizeGameStateSnapshot(schema12Snapshot)).toMatchObject({
      research,
      edicts,
      reserves: { gold: 6_000, fuelGas: null },
      buildings: {
        trainDepot: { built: 2, running: 1 },
        vehiclesDepot: { built: 3, running: 2 },
        vehiclesDepotII: { built: 2, running: 1 },
        vehiclesDepotIII: { built: 1, running: 1 },
      },
    })
    expect(normalizeGameStateSnapshot(schema13Snapshot)).toMatchObject({
      schemaVersion: 13,
      reserves: { gold: 6_000, fuelGas: 12_000 },
      buildings: {
        rocketAssemblyDepot: { built: 0, running: 0 },
        rocketLaunchPad: { built: 0, running: 0 },
      },
    })
    expect(normalizeGameStateSnapshot(schema14Snapshot)).toMatchObject({
      schemaVersion: 14,
      spaceStation: null,
      buildings: {
        rocketAssemblyDepot: { built: 1, running: 1 },
        rocketLaunchPad: { built: 1, running: 1 },
      },
    })
    expect(normalizeGameStateSnapshot(schema15Snapshot)).toMatchObject({
      schemaVersion: 15,
      spaceStation: {
        currentLevel: 0,
        highestLevelAchieved: 4,
        constructionPending: true,
      },
    })
    expect(normalizeGameStateSnapshot(schema16Snapshot)).toMatchObject({
      schemaVersion: 16,
      computing,
      chickenFarms,
      cropFarms,
      machines: [],
    })
    expect(normalizeGameStateSnapshot(schema17Snapshot)).toMatchObject({
      schemaVersion: 17,
      machines: machines.map(machine => ({ ...machine, zones: [] })),
    })
    expect(normalizeGameStateSnapshot(schema18Snapshot)).toMatchObject({
      schemaVersion: 18,
      machines: zonedMachines,
    })
    expect(normalizeGameStateSnapshot(schema19Snapshot)).toMatchObject({
      schemaVersion: 19,
      cropFarms: {
        configurations: cropFarms.configurations,
        entities: cropFarmEntities,
      },
    })
    expect(normalizeGameStateSnapshot(schema20Snapshot)).toMatchObject({
      schemaVersion: 20,
      saveId: null,
      chickenFarms: {
        configurations: chickenFarms.configurations,
        entities: chickenFarmEntities,
      },
    })
    expect(normalizeGameStateSnapshot(schema21Snapshot)).toMatchObject({
      schemaVersion: 21,
      saveId: 'Carbon Island',
      productionEntities: null,
    })
    expect(normalizeGameStateSnapshot(schema22Snapshot)).toMatchObject({
      schemaVersion: 22,
      saveId: 'Carbon Island',
      productionEntities,
    })
    expect(normalizeGameStateSnapshot(schema23Snapshot)).toMatchObject({
      schemaVersion: 23,
      saveId: 'Carbon Island',
      productionEntities: computingProductionEntities,
    })
    expect(normalizeGameStateSnapshot(schema24Snapshot)).toMatchObject({
      schemaVersion: 24,
      logisticsZones,
      productionEntities: areaProductionEntities,
      cropFarms: {
        entities: [{ zones: [{ id: 7, name: 'Greenhouses' }] }],
      },
    })
    const normalizedSchema25 = normalizeGameStateSnapshot(schema25Snapshot)

    expect(normalizedSchema25?.schemaVersion).toBe(25)
    expect(normalizedSchema25?.logisticsZones).toContainEqual({ id: 25, name: 'Population' })
    expect(normalizedSchema25?.productionEntities).toContainEqual(expect.objectContaining({
      prototypeId: 'HousingT3',
    }))
    expect(normalizeGameStateSnapshot(schema26Snapshot)).toMatchObject({
      schemaVersion: 26,
      groundwater: {
        depletedPumpSpeedPercent: 40,
        replenishWhenLowPercent: 7,
      },
      machines: [{ aquifer: groundwaterAquifer }, { aquifer: groundwaterAquifer }],
    })
  })

  it('requires consistent aquifer state and depleted behavior in schema 26', () => {
    expect(normalizeGameStateSnapshot({
      ...schema26Snapshot,
      groundwater: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema26Snapshot,
      groundwater: {
        ...schema26Snapshot.groundwater,
        depletedPumpSpeedPercent: 101,
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema26Snapshot,
      machines: schema26Snapshot.machines.map((machine, index) => (
        index === 0
          ? { ...machine, aquifer: { ...machine.aquifer, quantity: 1 } }
          : machine
      )),
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema26Snapshot,
      machines: schema26Snapshot.machines.map(machine => ({
        ...machine,
        aquifer: { ...machine.aquifer, quantity: 20_001 },
      })),
    })).toBeNull()
  })

  it('requires valid stable production identities in schema 22', () => {
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: [productionEntities[0], productionEntities[0]],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: [{
        ...productionEntities[1],
        recipeIds: ['HydrogenProductionFromSteamSp', 'HydrogenProductionFromSteamSp'],
      }],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: [{
        ...productionEntities[1],
        nuclearReactor: { enrichmentStep: 0, targetPowerPercent: 100 },
      }],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: [{
        ...productionEntities[0],
        nuclearReactor: null,
      }],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema22Snapshot,
      productionEntities: [{
        ...productionEntities[0],
        nuclearReactor: { enrichmentStep: 0, targetPowerPercent: 500 },
      }],
    })).toBeNull()
  })

  it('requires Data Center rack counts in schema 23', () => {
    expect(normalizeGameStateSnapshot({
      ...schema23Snapshot,
      productionEntities: computingProductionEntities.map(entity => (
        entity.prototypeId === 'DataCenter'
          ? { ...entity, dataCenterRacks: null }
          : entity
      )),
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema23Snapshot,
      productionEntities: computingProductionEntities.map(entity => (
        entity.prototypeId === 'WaterChiller'
          ? { ...entity, dataCenterRacks: 1 }
          : entity
      )),
    })).toBeNull()
  })

  it('requires named areas and greenhouse area membership in schema 24', () => {
    expect(normalizeGameStateSnapshot({
      ...schema24Snapshot,
      logisticsZones: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema24Snapshot,
      logisticsZones: [logisticsZones[0], logisticsZones[0]],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema24Snapshot,
      cropFarms: schema23Snapshot.cropFarms,
    })).toBeNull()
  })

  it('requires a non-empty save identity in schema 21', () => {
    expect(normalizeGameStateSnapshot({
      ...schema21Snapshot,
      saveId: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema21Snapshot,
      saveId: '   ',
    })).toBeNull()
  })

  it('requires rocket infrastructure counts in schema 14', () => {
    const buildingsWithoutRockets = Object.fromEntries(
      Object.entries(schema14Snapshot.buildings).filter(
        ([id]) => id !== 'rocketAssemblyDepot' && id !== 'rocketLaunchPad',
      ),
    )

    expect(
      normalizeGameStateSnapshot({
        ...schema14Snapshot,
        buildings: buildingsWithoutRockets,
      }),
    ).toBeNull()
  })

  it('requires valid Space Station state in schema 15 without invalidating schema 14', () => {
    expect(normalizeGameStateSnapshot(schema14Snapshot)?.spaceStation).toBeNull()
    expect(
      normalizeGameStateSnapshot({
        ...schema15Snapshot,
        spaceStation: undefined,
      }),
    ).toBeNull()
    expect(
      normalizeGameStateSnapshot({
        ...schema15Snapshot,
        spaceStation: {
          ...schema15Snapshot.spaceStation,
          currentLevel: 5,
        },
      }),
    ).toBeNull()
  })

  it('requires valid production configurations in schema 16 without invalidating schema 15', () => {
    expect(normalizeGameStateSnapshot(schema15Snapshot)).toMatchObject({
      computing: null,
      chickenFarms: null,
      cropFarms: null,
    })
    expect(normalizeGameStateSnapshot({
      ...schema16Snapshot,
      computing: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema16Snapshot,
      chickenFarms: {
        configurations: [{
          ...chickenFarms.configurations[0],
          running: 6,
        }],
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema16Snapshot,
      cropFarms: {
        configurations: [{
          ...cropFarms.configurations[0],
          schedule: ['Crop_Potato'],
        }],
      },
    })).toBeNull()
  })

  it('requires a uniquely identified machine inventory in schema 17', () => {
    expect(normalizeGameStateSnapshot({
      ...schema17Snapshot,
      machines: undefined,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema17Snapshot,
      machines: [machines[0], machines[0]],
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema17Snapshot,
      machines: [{ ...machines[0], running: 'yes' }],
    })).toBeNull()
  })

  it('requires stable, unique greenhouse entities in schema 19', () => {
    expect(normalizeGameStateSnapshot({
      ...schema19Snapshot,
      cropFarms,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema19Snapshot,
      cropFarms: {
        ...cropFarms,
        entities: [cropFarmEntities[0], cropFarmEntities[0]],
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema19Snapshot,
      cropFarms: {
        ...cropFarms,
        entities: [{ ...cropFarmEntities[0], running: 'yes' }],
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema19Snapshot,
      cropFarms: {
        ...cropFarms,
        entities: [],
      },
    })).toBeNull()
  })

  it('requires stable, consistent chicken farm entities in schema 20', () => {
    expect(normalizeGameStateSnapshot({
      ...schema20Snapshot,
      chickenFarms,
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema20Snapshot,
      chickenFarms: {
        ...chickenFarms,
        entities: [chickenFarmEntities[0], chickenFarmEntities[0]],
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema20Snapshot,
      chickenFarms: {
        ...chickenFarms,
        entities: chickenFarmEntities.map((entity, index) => (
          index === 0 ? { ...entity, chickens: 450 } : entity
        )),
      },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...schema20Snapshot,
      chickenFarms: {
        ...chickenFarms,
        entities: chickenFarmEntities.map((entity, index) => (
          index === 0
            ? { ...entity, zones: [{ id: 12, name: 'Chicken Farms' }, { id: 12, name: 'Other' }] }
            : entity
        )),
      },
    })).toBeNull()
  })

  it('accepts an enabled edict whose effect is currently inactive', () => {
    expect(
      normalizeGameStateSnapshot({
        ...schema12Snapshot,
        edicts: {
          ...edicts,
          maintenanceReducer: {
            enabledLevel: 3,
            activeLevel: 0,
            inactiveReason: 'Not enough Unity',
          },
        },
      })?.edicts?.maintenanceReducer,
    ).toEqual({
      enabledLevel: 3,
      activeLevel: 0,
      inactiveReason: 'Not enough Unity',
    })
  })

  it('rejects missing or impossible synced research and edict values', () => {
    expect(isGameStateSnapshot({ ...schema12Snapshot, research: undefined })).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema12Snapshot,
        research: { ...research, solarPower: 201 },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema12Snapshot,
        edicts: {
          ...edicts,
          farmingBoost: {
            enabledLevel: 1,
            activeLevel: 4,
            inactiveReason: null,
          },
        },
      }),
    ).toBe(false)
  })

  it('requires a confirmed non-negative integer reserve balance from schema 10 onward', () => {
    expect(isGameStateSnapshot({ ...schema12Snapshot, reserves: undefined })).toBe(false)
    expect(isGameStateSnapshot({ ...schema12Snapshot, reserves: { gold: -1 } })).toBe(false)
    expect(isGameStateSnapshot({ ...schema12Snapshot, reserves: { gold: 1.5 } })).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema13Snapshot,
        reserves: { gold: 6_000 },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema13Snapshot,
        reserves: { gold: 6_000, fuelGas: -1 },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema13Snapshot,
        reserves: { gold: 6_000, fuelGas: 1.5 },
      }),
    ).toBe(false)
    expect(normalizeGameStateSnapshot(schema12Snapshot)?.reserves).toEqual({
      gold: 6_000,
      fuelGas: null,
    })
    expect(normalizeGameStateSnapshot(schema9Snapshot)?.reserves).toBeNull()
  })

  it('requires Train Depot counts in schema 11 without invalidating schema 10 snapshots', () => {
    const schema10Buildings = Object.fromEntries(
      Object.entries(currentSnapshot.buildings).filter(([id]) => id !== 'trainDepot'),
    )

    expect(
      normalizeGameStateSnapshot({
        ...currentSnapshot,
        buildings: schema10Buildings,
      })?.buildings.trainDepot,
    ).toEqual({ built: 0, running: 0 })
    expect(
      isGameStateSnapshot({
        ...currentSnapshot,
        buildings: schema10Buildings,
      }),
    ).toBe(true)
    expect(
      normalizeGameStateSnapshot({
        ...schema11Snapshot,
        buildings: Object.fromEntries(
          Object.entries(schema11Snapshot.buildings).filter(([id]) => id !== 'trainDepot'),
        ),
      }),
    ).toBeNull()
  })

  it('requires Vehicles depot counts in schema 12 without invalidating schema 11 snapshots', () => {
    const depotIds = new Set(['vehiclesDepot', 'vehiclesDepotII', 'vehiclesDepotIII'])
    const schema11Buildings = Object.fromEntries(
      Object.entries(schema11Snapshot.buildings).filter(([id]) => !depotIds.has(id)),
    )
    const schema12Buildings = Object.fromEntries(
      Object.entries(schema12Snapshot.buildings).filter(([id]) => !depotIds.has(id)),
    )

    expect(
      normalizeGameStateSnapshot({
        ...schema11Snapshot,
        buildings: schema11Buildings,
      })?.buildings,
    ).toMatchObject({
      vehiclesDepot: { built: 0, running: 0 },
      vehiclesDepotII: { built: 0, running: 0 },
      vehiclesDepotIII: { built: 0, running: 0 },
    })
    expect(
      normalizeGameStateSnapshot({
        ...schema12Snapshot,
        buildings: schema12Buildings,
      }),
    ).toBeNull()
  })

  it('rejects inconsistent train traffic severity and durations', () => {
    expect(
      isGameStateSnapshot({
        ...schema12Snapshot,
        trainTraffic: { ...trainTraffic, severity: 'warning' },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...schema12Snapshot,
        trainTraffic: {
          ...trainTraffic,
          trains: [
            { ...trainTraffic.trains[0], blockedForCycles: 0.5 },
            ...trainTraffic.trains.slice(1),
          ],
        },
      }),
    ).toBe(false)
  })

  it('normalizes schema 6 and fills unavailable additive building counts with zero', () => {
    const buildings = Object.fromEntries(
      Object.entries(snapshot.buildings).filter(
        ([id]) => id !== 'moltenStationModuleElectrified' && id !== 'trainDepot',
      ),
    )

    expect(
      normalizeGameStateSnapshot({
        ...snapshot,
        schemaVersion: 6,
        buildings,
      }),
    ).toMatchObject({
      schemaVersion: 6,
      buildings: {
        solarPanelMono: { built: 195, running: 195 },
        unitStationModuleElectrified: { built: 108, running: 100 },
        moltenStationModuleElectrified: { built: 0, running: 0 },
        trainDepot: { built: 0, running: 0 },
        vehiclesDepot: { built: 0, running: 0 },
        vehiclesDepotII: { built: 0, running: 0 },
        vehiclesDepotIII: { built: 0, running: 0 },
      },
      history: snapshot.history,
    })
  })

  it('rejects impossible quota arithmetic', () => {
    expect(
      isGameStateSnapshot({
        ...snapshot,
        vehicles: { ...snapshot.vehicles, quotaRemaining: 7 },
      }),
    ).toBe(false)
  })

  it('rejects negative or fractional counts', () => {
    expect(
      isGameStateSnapshot({
        ...snapshot,
        vehicles: { ...snapshot.vehicles, total: -1 },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...snapshot,
        vehicles: { ...snapshot.vehicles, trucks: 2.5 },
      }),
    ).toBe(false)
  })

  it('rejects more assigned workers than physical vehicles', () => {
    expect(
      isGameStateSnapshot({
        ...snapshot,
        vehicles: { ...snapshot.vehicles, workersAssigned: 40 },
      }),
    ).toBe(false)
  })

  it('rejects more running buildings than completed buildings', () => {
    expect(
      isGameStateSnapshot({
        ...snapshot,
        buildings: {
          ...snapshot.buildings,
          oreSortingPlant: { built: 7, running: 8 },
        },
      }),
    ).toBe(false)
  })

  it('rejects invalid or duplicate history series', () => {
    expect(
      isGameStateSnapshot({
        ...snapshot,
        history: {
          ...snapshot.history,
          maintenance: {
            ...snapshot.history.maintenance,
            maintenanceII: { averagePerCycle: -1, sampleMonths: 120 },
          },
        },
      }),
    ).toBe(false)
    expect(
      isGameStateSnapshot({
        ...snapshot,
        history: {
          ...snapshot.history,
          electricityGeneration: {
            byType: [
              ...snapshot.history.electricityGeneration.byType,
              ...snapshot.history.electricityGeneration.byType,
            ],
          },
        },
      }),
    ).toBe(false)
  })
})
