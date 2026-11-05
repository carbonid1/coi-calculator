import { expect, it } from 'vitest'

import { createNuclearModule } from '../../db/modules/nuclear'
import { emptyPlanningBaselines } from '../../db/planning-baselines'
import { type SyncedProductionEntity } from '../../game-state'
import { buildModuleLines } from '../../test-fixtures/build-module-lines'
import { calculateNet } from '../calculate/calculate'

it('closes the FBR fuel loop using the native zero-enrichment fuel multiplier without reducing steam or breeding', () => {
  const machine = (entityId: number, prototypeId: string, recipeIds: string[] = []): SyncedProductionEntity => ({
    entityId, prototypeId, recipeIds, running: true, zones: [], nuclearReactor: null,
  })
  const entities: SyncedProductionEntity[] = [
    { ...machine(1, 'FastBreederReactor'), nuclearReactor: { enrichmentStep: 0, targetPowerPercent: 400 } },
    { ...machine(2, 'FastBreederReactor'), nuclearReactor: { enrichmentStep: 2, targetPowerPercent: 100 } },
    machine(3, 'NuclearReprocessingPlant', ['CoreFuelReprocessing']),
    machine(4, 'UraniumEnrichmentPlant', ['BlanketFuelReprocessing']),
    machine(5, 'UraniumEnrichmentPlant', ['BlanketFuelReprocessing']),
  ]
  const nuclear = createNuclearModule(emptyPlanningBaselines, undefined, entities)
  const { lines } = buildModuleLines(nuclear, nuclear.presets[0])
  const result = calculateNet(lines, { water: 1000, acid: 10, moltenGlass: 10, steel: 10, blanketFuel: 3 })
  const flow = (resourceId: string) => result.allResourceFlows.find(flow => flow.resourceId === resourceId)

  // Installed 0.8.8: zero-enrichment FuelMultiplier=50%. The recipe UI exposes
  // the unadjusted four units; generateHeatAndConsumeFuel applies the multiplier.
  expect(flow('coreFuel')).toMatchObject({ produced: 12, consumed: 12, net: 0 })
  expect(flow('coreFuelSpent')).toMatchObject({ produced: 12, consumed: 12, net: 0 })
  expect(flow('blanketFuelEnriched')).toMatchObject({ produced: 12, consumed: 12, net: 0 })
  expect(flow('blanketFuel')).toMatchObject({ produced: 12, consumed: 12, net: 0 })
  expect(flow('steamSuper')?.produced).toBe(408)
  expect(flow('fissionProduct')?.produced).toBe(1.5)
  expect(result.regularResults.find(result => result.recipe.id === 'nuclear-reprocessing'))
    .toMatchObject({ supplyRatio: 0.75 })
})
