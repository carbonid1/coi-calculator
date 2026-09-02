import { describe, expect, it } from 'vitest'

import { type Module } from '../../db/modules/modules'
import { calculateSpaceStationLevel } from '../../db/space-station'
import { createSpaceResearchAttention } from './space-research-attention'

const stationModule: Module = {
  id: 'live-area-15',
  name: 'Space Station',
  description: '',
  builtBuildings: {},
  presets: [],
  defaultPresetId: null,
}

describe('Space Research attention', () => {
  it('does not turn a planned lab into premature station attention', () => {
    expect(createSpaceResearchAttention({
      mode: 'with-space',
      runningResearchLabs: 0,
      station: calculateSpaceStationLevel(0),
      stationModule,
    })).toBeNull()
  })

  it('asks for level three when the first synced lab starts running', () => {
    expect(createSpaceResearchAttention({
      mode: 'with-space',
      runningResearchLabs: 1,
      station: calculateSpaceStationLevel(0),
      stationModule,
    })).toMatchObject({
      attention: 'build',
      level: { current: 0, target: 3 },
      affectedResources: ['Space Research Points'],
    })
  })

  it('keeps the action available before a Space Station module exists', () => {
    const defaultModule = { ...stationModule, id: 'general', name: 'Default' }

    expect(createSpaceResearchAttention({
      fallbackTarget: {
        module: defaultModule,
        navigationKey: 'general:research-lab-iv',
      },
      mode: 'with-space',
      runningResearchLabs: 1,
      station: calculateSpaceStationLevel(0),
      stationModule: undefined,
    })).toMatchObject({
      key: 'general:space-station-infrastructure',
      navigationKey: 'general:research-lab-iv',
      moduleId: 'general',
      attention: 'build',
      level: { current: 0, target: 3 },
    })
  })

  it('does not duplicate a Space Station plan as building attention', () => {
    expect(createSpaceResearchAttention({
      mode: 'with-space',
      runningResearchLabs: 2,
      station: calculateSpaceStationLevel(0, 4),
      stationModule: {
        ...stationModule,
        presets: [{
          id: 'current',
          name: 'Current',
          description: '',
          activeBuildings: { 'space-station-operations': 1 },
          fixed: ['space-station-operations'],
          planMismatches: [{
            recipeId: 'space-station-operations',
            current: 0,
            currentSource: 'synced',
            target: 4,
            direction: 'at-least',
            format: 'level',
            actions: [{ type: 'build', label: 'Build Space Station level 4' }],
          }],
        }],
        defaultPresetId: 'current',
      },
    })).toBeNull()
  })

  it('asks for level four only after the second synced lab starts running', () => {
    expect(createSpaceResearchAttention({
      mode: 'with-space',
      runningResearchLabs: 2,
      station: calculateSpaceStationLevel(3),
      stationModule,
    })).toMatchObject({
      attention: 'upgrade',
      level: { current: 3, target: 4 },
    })
  })

  it('clears once the synced station covers the running labs', () => {
    expect(createSpaceResearchAttention({
      mode: 'with-space',
      runningResearchLabs: 2,
      station: calculateSpaceStationLevel(4),
      stationModule,
    })).toBeNull()
  })
})
