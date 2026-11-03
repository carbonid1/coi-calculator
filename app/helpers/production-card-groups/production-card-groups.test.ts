import { describe, expect, it } from 'vitest'

import { type Module } from '../../db/modules/modules'
import { createPopulationModule } from '../../db/modules/population'
import { createSpaceStationModule } from '../../db/modules/space-station'
import {
  emptyRocketInfrastructureConfig,
} from '../../db/rocket-infrastructure'
import { settlementRecipeIds } from '../../db/settlement'
import { testRocketIiDefinition, testSpaceStationLevels } from '../../test-fixtures/recorded-game-data'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateProductionCardLoad, groupProductionCardLines, hasBuildingInventory } from './production-card-groups'

describe('production card groups', () => {
  it('hides empty Housing II entries left by an expansion of Housing III', () => {
    const area: Module = {
      id: 'population', name: 'Population', description: '', builtBuildings: {},
      presets: [{ id: 'live', name: 'Live', description: '', activeBuildings: {}, fixed: [] }],
    }
    const population = createPopulationModule({
      counts: { [settlementRecipeIds.residents]: { built: 20, running: 20 } },
      entities: [], housingIiCandidates: { built: 0, running: 0 }, unmappedEntities: [],
    }, area, 4, 26)
    const { lines } = buildModuleLines(population, population.presets[0])
    const emptyHousing = lines.find(line => line.recipe.id === settlementRecipeIds.residentsII)
    const visible = lines.filter(hasBuildingInventory)

    expect(emptyHousing).toMatchObject({ activeBuildings: 0, builtBuildings: 0, dataSource: 'planned' })
    expect(visible).not.toContain(emptyHousing)
    expect(visible).toContainEqual(expect.objectContaining({
      recipe: expect.objectContaining({ id: settlementRecipeIds.residents }),
      activeBuildings: 26, builtBuildings: 20, unplacedPlannedBuildings: 6,
    }))
  })

  it('retains paused buildings, construction, unplaced plans, and shared physical inventory', () => {
    const empty = { activeBuildings: 0, builtBuildings: 0 }

    expect(hasBuildingInventory(empty)).toBe(false)
    expect(hasBuildingInventory({ ...empty, dataSource: 'planned' })).toBe(false)
    for (const inventory of [
      { builtBuildings: 1 }, { activeBuildings: 1 }, { currentActiveBuildings: 1 },
      { constructionGhosts: 1 }, { unplacedPlannedBuildings: 1 },
      { capacityPoolBuiltBuildings: 1 }, { capacityPoolActiveBuildings: 1 },
      { capacityPoolCurrentActiveBuildings: 1 }, { capacityPoolConstructionGhosts: 1 },
      { capacityPoolUnplacedPlannedBuildings: 1 },
    ]) expect(hasBuildingInventory({ ...empty, ...inventory })).toBe(true)
  })

  it('shows the two station operations as one physical card', () => {
    const station = createSpaceStationModule(
      { currentLevel: 4, highestLevelAchieved: 4 },
      testSpaceStationLevels,
      testRocketIiDefinition,
      emptyRocketInfrastructureConfig,
      {
        rocketRunningConfig: emptyRocketInfrastructureConfig,
        stationPartsAssembly: { built: 1, running: 1 },
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
