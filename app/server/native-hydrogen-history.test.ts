import { expect, it } from 'vitest'

import { getGameMonth, normalizeHydrogenFuelHistory } from './native-hydrogen-history'

const history = (points = [...Array<number>(120).fill(120), 99_999]) => ({
  date: '11-1-15', start: '1-1-1', resolution: 'month', unknownIds: [],
  products: { Product_Hydrogen: { consumedAsFuel: points } },
})

it('averages 120 finished months of fuel without including the current month', () => {
  expect(normalizeHydrogenFuelHistory(history(), 120)).toEqual({
    month: 120, total: { averagePerCycle: 120, sampleMonths: 120 },
  })
})

it('uses the actual category tracking window rather than padded zeroes', () => {
  expect(normalizeHydrogenFuelHistory(history([...Array<number>(117).fill(0), 30, 60, 90, 999]), 3)).toEqual({
    month: 120, total: { averagePerCycle: 60, sampleMonths: 3 },
  })
})

it('supports young factories and rounds to the existing snapshot precision', () => {
  expect(normalizeHydrogenFuelHistory({ ...history([1, 0, 0, 999]), date: '1-4-15' }, 3)).toEqual({
    month: 3, total: { averagePerCycle: 0.333333, sampleMonths: 3 },
  })
})

it('preserves no completed fuel history as unavailable instead of inventing samples', () => {
  expect(normalizeHydrogenFuelHistory(history([...Array<number>(120).fill(0), 50]), 0)?.total).toEqual({
    averagePerCycle: 0, sampleMonths: 0,
  })
  expect(normalizeHydrogenFuelHistory({ ...history([50]), date: '1-1-15' }, 0)?.total.sampleMonths).toBe(0)
  expect(normalizeHydrogenFuelHistory(history(), 0)).toBeNull()
})

it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, null, '12', 0.5])('rejects malformed history points: %s', point => {
  expect(normalizeHydrogenFuelHistory({
    ...history(), products: { Product_Hydrogen: { consumedAsFuel: [...Array(120).fill(0), point] } },
  }, 120)).toBeNull()
})

it('rejects unsupported products, series, windows, and resolutions', () => {
  expect(normalizeHydrogenFuelHistory({ ...history(), unknownIds: ['Product_Hydrogen'] }, 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory({ ...history(), products: {} }, 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory({ ...history(), products: { Product_Hydrogen: { consumed: Array(121).fill(1) } } }, 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory({ ...history(), resolution: 'year' }, 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory(history(), 121)).toBeNull()
  expect(normalizeHydrogenFuelHistory(history(), -1)).toBeNull()
  expect(normalizeHydrogenFuelHistory(history(), 1.5)).toBeNull()
  expect(normalizeHydrogenFuelHistory(history([1, 2]), 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory({ ...history(), start: '1-2-1' }, 120)).toBeNull()
  expect(normalizeHydrogenFuelHistory(history([
    Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, ...Array<number>(119).fill(0),
  ]), 120)).toBeNull()
})

it.each([null, 'wrong', '0-1-1', '1-13-1', '1-1-0', '1-1-32'])('rejects invalid game dates: %s', date => {
  expect(getGameMonth(date)).toBeNull()
  expect(normalizeHydrogenFuelHistory({ ...history(), date }, 120)).toBeNull()
})
