import { describe, expect, it } from 'vitest'

import { type Module } from '../../db/modules/modules'
import { createSpaceStationModule } from '../../db/modules/space-station'
import {
  emptyRocketInfrastructureConfig,
  plannedRocketInfrastructureConfig,
} from '../../db/rocket-infrastructure'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateProductionCardLoad, groupProductionCardLines } from './production-card-groups'

describe('production card groups', () => {
  it('shows the two station operations as one physical card', () => {
    const station = createSpaceStationModule(
      { currentLevel: 0, highestLevelAchieved: 4, targetLevel: 4 },
      emptyRocketInfrastructureConfig,
      plannedRocketInfrastructureConfig,
      {
        rocketRunningConfig: emptyRocketInfrastructureConfig,
        rocketSource: 'synced',
        stationPartsAssembly: { built: 1, running: 1, source: 'synced' },
        stationSource: 'synced',
      },
    )
    const { lines } = buildModuleLines(station, station.presets[0] ?? null)
    const groups = groupProductionCardLines(lines)
    const stationGroup = groups.find(({ key }) => key === 'space-station:display:space-station')

    expect(groups).toHaveLength(4)
    expect(stationGroup).toMatchObject({
      targetKey: 'space-station:space-station-operations',
      lines: [
        { recipe: { id: 'space-station-operations' } },
        { recipe: { id: 'space-station-orbital-research' } },
      ],
    })
    expect(
      calculateProductionCardLoad(stationGroup?.lines ?? [], [
        { supplyRatio: 1 },
        { supplyRatio: 1 },
      ]),
    ).toBe(1)
  })

  it('places internal producers before their consumers', () => {
    const copperChain: Module = {
      id: 'copper-chain',
      name: 'Copper chain',
      description: '',
      builtBuildings: {
        'copper-consumer': 1,
        'molten-producer': 1,
        'impure-producer': 1,
      },
      recipes: [
        {
          id: 'copper-consumer',
          name: 'Copper consumer',
          building: 'Copper electrolysis',
          group: 'production',
          inputs: [{ resourceId: 'impureCopper', quantity: 1 }],
          outputs: [{ resourceId: 'copper', quantity: 1 }],
        },
        {
          id: 'molten-producer',
          name: 'Molten producer',
          building: 'Arc furnace II',
          group: 'production',
          inputs: [{ resourceId: 'copperOreCrushed', quantity: 1 }],
          outputs: [{ resourceId: 'moltenCopper', quantity: 1 }],
        },
        {
          id: 'impure-producer',
          name: 'Impure producer',
          building: 'Metal caster II',
          group: 'production',
          inputs: [{ resourceId: 'moltenCopper', quantity: 1 }],
          outputs: [{ resourceId: 'impureCopper', quantity: 1 }],
        },
      ],
      presets: [{
        id: 'current',
        name: 'Current',
        description: '',
        activeBuildings: {
          'copper-consumer': 1,
          'molten-producer': 1,
          'impure-producer': 1,
        },
        fixed: ['copper-consumer', 'molten-producer', 'impure-producer'],
      }],
      defaultPresetId: 'current',
    }
    const { lines } = buildModuleLines(copperChain, copperChain.presets[0] ?? null)

    expect(groupProductionCardLines(lines).map(group => group.lines[0]?.recipe.id)).toEqual([
      'molten-producer',
      'impure-producer',
      'copper-consumer',
    ])
  })
})
