import { describe, expect, it } from 'vitest'

import {
  getLinkedOnlyLiveModuleInputIds,
  getSurplusConsumptionSettings,
} from './resource-disposition'

describe('resource disposition policies', () => {
  it('requires explicit live-module links for utility fluids', () => {
    expect(getLinkedOnlyLiveModuleInputIds([
      'water',
      'moltenSteel',
      'seaWater',
      'steamLow',
      'acid',
    ])).toEqual(['seaWater', 'steamLow'])
  })

  it('prefers the configured low-steam desalination route', () => {
    expect(getSurplusConsumptionSettings(['seaWater', 'steamLow'], 'DesalinationFromLP'))
      .toEqual({ inputIds: ['steamLow'], priority: 10, scope: 'module' })
  })

  it('routes local Molten Iron through the installed steel furnace', () => {
    expect(getSurplusConsumptionSettings(['moltenIron', 'oxygen'], 'SteelSmeltingT2'))
      .toEqual({
        inputIds: ['moltenIron'],
        priority: 10,
        scope: 'module',
      })
  })

  it('lets casters absorb only their module\'s Molten Steel surplus', () => {
    expect(getSurplusConsumptionSettings(
      ['moltenSteel', 'water'],
      'SteelCastingCooled',
      { isDefaultArea: true },
    ))
      .toEqual({
        inputIds: ['moltenSteel'],
        priority: 100,
        scope: 'module',
        surplusOnly: true,
      })
    expect(getSurplusConsumptionSettings(['moltenSteel'], 'SteelCastingCooled'))
      .toBeNull()
  })

  it('allows any installed consumer to absorb a configured resource', () => {
    expect(getSurplusConsumptionSettings(['steamLow'], 'FutureSteamConsumer'))
      .toEqual({ inputIds: ['steamLow'], priority: 100, scope: 'module' })
  })

  it('does not turn ordinary resources into surplus-driven inputs', () => {
    expect(getSurplusConsumptionSettings(['water'], 'WaterConsumer')).toBeNull()
  })
})
