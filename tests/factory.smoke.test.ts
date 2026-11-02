import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { normalizeGameStateSnapshot } from '../app/game-state'
import { calculateBuildingStats } from '../app/helpers/building-stats/building-stats'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from '../app/helpers/contracts/calculate-contracts'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'

// Recorded from Update 4.3 with Bridge schema 44 on 2026-11-03.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory-schema44.json.gz', import.meta.url))).toString())
const round = (value: number) => Number(value.toFixed(4)) || 0

it('replays the recorded factory through validation, planning, dispatch, contracts and resource balances', () => {
  const snapshot = normalizeGameStateSnapshot(capture)

  if (!snapshot) throw new Error('Recorded factory no longer matches the supported Bridge schema')
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'recorded-factory' })
  const { factoryResult, linkedModulesResult } = calculateFactoryCalculation(model.factoryCalculationInput)
  const stats = calculateBuildingStats(factoryResult.allLines, factoryResult.calculation, model.outputModifiers)
  const linkedStats = [...linkedModulesResult.moduleResults.values()].map(result => (
    calculateBuildingStats(result.lines, result, model.outputModifiers)
  ))
  const report = {
    modules: model.configuredModules.map(module => ({
      id: module.id, name: module.name,
    })),
    totals: {
      lines: factoryResult.allLines.length,
      workers: stats.workers + linkedStats.reduce((sum, value) => sum + value.workers, 0)
        + calculateContractWorkers(model.enabledContracts) + model.worldMines.workers,
      electricityMw: round(factoryResult.electricityDemandMw + linkedStats.reduce((sum, value) => sum + value.electricityKw, 0) / 1000),
      computingTflops: round(factoryResult.computingDemandTflops + linkedStats.reduce((sum, value) => sum + value.computingTflops, 0)),
      populationCapacity: model.populationCapacity,
      focus: model.officePlanCalculation.focusPointsCapacity,
      recyclingPercent: model.recyclingEfficiencyPercent,
    },
    modifiers: Object.fromEntries(Object.entries(model.outputModifiers).flatMap(([key, value]) => (
      typeof value === 'number' ? [[key, round(value)]] : []
    ))),
    contracts: factoryResult.contractResults.map(result => ({
      id: result.contract.id, imported: round(result.imported), requiredImported: round(result.requiredImported),
      exported: round(result.exported),
    })),
    flows: factoryResult.flows.map(flow => ({
      resource: flow.resourceId, produced: round(flow.produced), consumed: round(flow.consumed), net: round(flow.net),
    })),
  }

  expect(report).toEqual(JSON.parse(readFileSync(new URL('./fixtures/factory-baseline.json', import.meta.url), 'utf8')))
  expect(factoryResult.allLines.every(line => line.recipe.buildingData !== undefined)).toBe(true)
  expect(factoryResult.flows.every(flow => Number.isFinite(flow.net))).toBe(true)

  // A second complete solve proves costs come from the supplied catalog, not
  // the retired tables. Resource priorities must survive a metadata change.
  const updated = structuredClone(snapshot)
  const office = updated.buildingDefinitions.find(definition => definition.id === 'OfficeBuildingT3')

  if (!office) throw new Error('Recorded factory must exercise Office III')
  office.workers += 200
  office.electricityKw += 100
  office.computingTflops += 12
  const changedModel = deriveCalculatorModel({ snapshot: updated, machineZoneAssignments: {}, revision: 'changed-catalog' })
  const changed = calculateFactoryCalculation(changedModel.factoryCalculationInput).factoryResult
  const changedStats = calculateBuildingStats(changed.allLines, changed.calculation, changedModel.outputModifiers)

  expect(changedStats.workers - stats.workers).toBe(600)
  expect(changedStats.electricityKw - stats.electricityKw).toBeCloseTo(300, 4)
  expect(changedStats.computingTflops - stats.computingTflops).toBeCloseTo(144, 4)
  expect(changedModel.officePlanCalculation.focusPointsCapacity).toBe(6552)
  expect(changed.flows).toEqual(factoryResult.flows)
  expect(changed.contractResults).toEqual(factoryResult.contractResults)
}, 60_000)
