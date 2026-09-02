import { describe, expect, it } from 'vitest'

import { type ProductionLine } from '../calculate/calculate'
import { calculateStationActivityCounts } from './station-activity'

const line = (overrides: Partial<ProductionLine>): ProductionLine => ({
  activeBuildings: 0,
  builtBuildings: 0,
  constructionGhosts: 0,
  moduleId: 'default',
  recipe: {
    building: 'Fluid station module (electrified)',
    duration: 60,
    group: 'production',
    id: 'static-fluid-station-module-electrified',
    inputs: [],
    name: 'Fluid station module (electrified)',
    outputs: [],
  },
  speedLevel: 1,
  unplacedPlannedBuildings: 0,
  ...overrides,
})

describe('calculateStationActivityCounts', () => {
  it('combines active and paused buildings across station assignments', () => {
    expect(calculateStationActivityCounts([
      line({ activeBuildings: 4, builtBuildings: 4, currentActiveBuildings: 4 }),
      line({ activeBuildings: 2, builtBuildings: 5, currentActiveBuildings: 2 }),
    ])).toEqual({ active: 6, ghosts: 0, paused: 3, planned: 0 })
  })

  it('keeps construction ghosts and unplaced plans out of modeled activity', () => {
    expect(calculateStationActivityCounts([
      line({
        activeBuildings: 5,
        builtBuildings: 3,
        constructionGhosts: 1,
        unplacedPlannedBuildings: 1,
      }),
    ])).toEqual({ active: 3, ghosts: 1, paused: 0, planned: 1 })
  })
})
