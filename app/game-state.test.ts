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
    })
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
