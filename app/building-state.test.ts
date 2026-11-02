import { expect, it } from 'vitest'

import { isBuildingDefinitions } from './building-state'

const definition = { id: 'Machine', name: 'Machine', workers: 12, electricityKw: 400, computingTflops: 5.76, unityPerCycle: 0.5 }

it('accepts zero requirements and fractional computing or Unity requirements', () => {
  expect(isBuildingDefinitions([definition])).toBe(true)
  expect(isBuildingDefinitions([{ ...definition, workers: 0, electricityKw: 0, computingTflops: 0, unityPerCycle: 0 }])).toBe(true)
})

it.each([
  { workers: -1 }, { workers: 0.5 }, { electricityKw: Number.NaN },
  { computingTflops: Number.POSITIVE_INFINITY }, { unityPerCycle: -1 }, { id: '' }, { name: '' },
])('rejects invalid requirements: %s', change => {
  expect(isBuildingDefinitions([{ ...definition, ...change }])).toBe(false)
})

it('rejects duplicate identities and missing catalogs', () => {
  expect(isBuildingDefinitions([definition, definition])).toBe(false)
  expect(isBuildingDefinitions(undefined)).toBe(false)
})
