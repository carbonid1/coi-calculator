import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { normalizeGameStateSnapshot } from '../app/game-state'
import { calculateBuildingDiagnostics } from '../app/helpers/building-diagnostics/building-diagnostics'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'

it('runs the Default titanium byproduct → oxygen furnace → cooled caster chain in the recorded factory', () => {
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))).toString())
  const snapshot = normalizeGameStateSnapshot(capture)!

  // Running the station creates the recurring titanium demand for this chain.
  snapshot.spaceStation = { currentLevel: 4, highestLevelAchieved: 4, crewDisabled: false }
  const options = { snapshot, revision: 'processing-chain', machineZoneAssignments: {}, presetId: 'baseline' as const }
  const model = deriveCalculatorModel(options)
  const owner = model.configuredModules.find(module => module.id === 'general')!
  const source = owner.recipes!.find(recipe => recipe.gameBuildingId === 'ArcFurnace2' && recipe.gameRecipeId === 'IlmeniteSmeltingArc2')!
  const furnace = owner.recipes!.find(recipe => recipe.gameBuildingId === 'OxygenFurnace' && recipe.gameRecipeId === 'SteelSmelting')!
  const caster = owner.recipes!.find(recipe => recipe.gameBuildingId === 'CasterCooled' && recipe.gameRecipeId === 'SteelCastingCooled')!
  const baselineModel = deriveCalculatorModel({ ...options, processingLinks: [] })
  const baseline = calculateFactoryCalculation(baselineModel.factoryCalculationInput).factoryResult
  const linked = calculateFactoryCalculation(model.factoryCalculationInput).factoryResult
  const result = (recipeId: string) => linked.calculation.regularResults.find(result => result.recipe.id === recipeId)!
  const sourceIron = result(source.id).actualOutputs.find(output => output.resourceId === 'moltenIron')!.quantity
  const consumedIron = result(furnace.id).actualInputs.find(input => input.resourceId === 'moltenIron')!.quantity
  const producedSteel = result(furnace.id).actualOutputs.find(output => output.resourceId === 'moltenSteel')!.quantity
  const castSteel = result(caster.id).actualInputs.find(input => input.resourceId === 'moltenSteel')!.quantity

  expect(sourceIron).toBeGreaterThan(0)
  expect(consumedIron).toBeCloseTo(sourceIron, 3)
  expect(castSteel).toBeCloseTo(producedSteel, 3)
  expect(result(source.id).supplyRatio).toBeCloseTo(baseline.calculation.regularResults.find(result => result.recipe.id === source.id)!.supplyRatio, 3)
  expect(result(caster.id).processingBlockedBy).toBeUndefined()
  const diagnostics = calculateBuildingDiagnostics(model.configuredModules, linked.flows, linked.calculation.regularResults)

  expect(diagnostics.filter(diagnostic => diagnostic.key === `general:${furnace.id}` || diagnostic.key === `general:${caster.id}`)
    .every(diagnostic => diagnostic.attention !== 'can-pause')).toBe(true)
  // Routing moves material inside one ledger; it cannot create supply credits.
  for (const resourceId of ['moltenIron', 'moltenSteel', 'steel'] as const) {
    const flow = linked.calculation.allResourceFlows.find(flow => flow.resourceId === resourceId)!
    const total = linked.calculation.regularResults.reduce((sum, result) => sum + result.actualOutputs
      .filter(output => output.resourceId === resourceId).reduce((sum, output) => sum + output.quantity, 0), 0)

    expect(flow.produced).toBeCloseTo(total, 4)
  }
}, 60000)
