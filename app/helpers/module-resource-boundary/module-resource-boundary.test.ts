import { describe, expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Preset } from '../../db/modules/modules'
import { getConnectionOnlyResourceIds } from '../../db/resource-supply'
import { calculateModuleResourceBoundary, resolveModuleResourceBoundary } from './module-resource-boundary'

const link: ModuleResourceLink = {
  id: 'water-link', resourceId: 'water', mode: 'produce-to-demand',
  sourceModuleId: 'nuclear', sourceModuleName: 'Nuclear',
  targetModuleId: 'food', targetModuleName: 'Food',
}
const preset: Preset = { id: 'plan', name: '', description: '', activeBuildings: {}, fixed: [] }
const flow = { produced: 10, consumed: 2, fixedDemand: 1, received: 0, sent: 0, demandTriggeredSent: 0 }

describe('module resource exchange contracts', () => {
  it('shares ordinary residual demand and production independently of calculation scope', () => {
    const rule = resolveModuleResourceBoundary('nuclear', 'water', [], null)

    expect(rule.access).toBe('factory')
    expect(calculateModuleResourceBoundary(rule, flow)).toEqual({ factoryDemand: 0, factorySupply: 7 })
    expect(calculateModuleResourceBoundary(rule, { ...flow, produced: 0 })).toEqual({ factoryDemand: 3, factorySupply: 0 })
  })

  it('keeps both dedicated endpoints out of automatic factory exchange', () => {
    for (const moduleId of ['nuclear', 'food']) {
      const rule = resolveModuleResourceBoundary(moduleId, 'water', [link], null)

      expect(rule.access).toBe('connections')
      expect(calculateModuleResourceBoundary(rule, flow)).toEqual({ factoryDemand: 0, factorySupply: 0 })
      expect(calculateModuleResourceBoundary(rule, { ...flow, produced: 0 })).toEqual({ factoryDemand: 0, factorySupply: 0 })
    }
    expect(resolveModuleResourceBoundary('food', 'water', [link], null).sourceModuleIds).toEqual(['nuclear'])
    expect(resolveModuleResourceBoundary('other', 'water', [link], null).access).toBe('factory')
  })

  it('uses the same local utility-fluid rules for recipe inputs and factory boundaries', () => {
    expect(getConnectionOnlyResourceIds(['water', 'seaWater', 'steamLow', 'carbonDioxide']))
      .toEqual(['seaWater', 'steamLow'])
    const rule = resolveModuleResourceBoundary('nuclear', 'steamLow', [], null)

    expect(rule.access).toBe('connections')
    expect(calculateModuleResourceBoundary(rule, flow)).toEqual({ factoryDemand: 0, factorySupply: 0 })
  })

  it('preserves an exact import request as demand even on a dedicated endpoint', () => {
    const rule = resolveModuleResourceBoundary('food', 'water', [link], {
      ...preset, requestedImports: { water: 4 },
    })

    expect(calculateModuleResourceBoundary(rule, { ...flow, received: 20 })).toEqual({
      factoryDemand: 4, factorySupply: 0,
    })
  })

  it('reserves demand-triggered transfers before an explicit factory export', () => {
    const rule = resolveModuleResourceBoundary('nuclear', 'water', [link], {
      ...preset, requestedExports: { water: 6 },
    })

    expect(calculateModuleResourceBoundary(rule, { ...flow, sent: 4, demandTriggeredSent: 4 }))
      .toEqual({ factoryDemand: 0, factorySupply: 3 })
  })
})
