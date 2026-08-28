import { describe, expect, it } from 'vitest'

import { createSpaceStationModule } from '../../db/modules/space-station'
import { defaultSpaceStationConfig } from '../../db/space-station'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateProductionCardLoad, groupProductionCardLines } from './production-card-groups'

describe('production card groups', () => {
  it('shows the two station operations as one physical card', () => {
    const station = createSpaceStationModule(defaultSpaceStationConfig)
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
})
