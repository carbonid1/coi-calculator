import { expect, it } from 'vitest'

import { buildIslandOutline, normalizeIslandMap } from './island-map'

// 4 columns by 2 rows; row zero is the south edge.
const map = () => ({
  schemaVersion: 1, gameId: 'game', sessionId: 'session', revision: 3,
  width: 4, height: 2, cellSize: 1, landRows: [[0, 2], [1, 3]],
})

it('accepts a well-formed map unchanged', () => {
  expect(normalizeIslandMap(map())).toEqual(map())
  expect(normalizeIslandMap({ ...map(), landRows: [[], [0, 1, 2, 4]] })).not.toBeNull()
})

it.each([
  { name: 'a different schema version', change: { schemaVersion: 2 } },
  { name: 'an empty game id', change: { gameId: '' } },
  { name: 'a negative revision', change: { revision: -1 } },
  { name: 'a zero cell size', change: { cellSize: 0 } },
  { name: 'more than 256 columns', change: { width: 300 } },
  { name: 'a missing row', change: { landRows: [[0, 2]] } },
  { name: 'an extra row', change: { landRows: [[0, 2], [1, 3], [0, 1]] } },
  { name: 'an unpaired run boundary', change: { landRows: [[0], [1, 3]] } },
  { name: 'a run past the last column', change: { landRows: [[0, 5], [1, 3]] } },
  { name: 'an empty run', change: { landRows: [[2, 2], [1, 3]] } },
  { name: 'overlapping runs', change: { landRows: [[0, 2, 1, 3], [1, 3]] } },
  { name: 'a fractional boundary', change: { landRows: [[0, 1.5], [1, 3]] } },
])('rejects $name', ({ change }) => {
  expect(normalizeIslandMap({ ...map(), ...change })).toBeNull()
})

it.each([null, 'text', [], 42])('rejects a reply that is not an object: %s', value => {
  expect(normalizeIslandMap(value)).toBeNull()
})

it('traces one closed coastline per island and one more per inland water', () => {
  const outline = (landRows: number[][], width: number, height: number) => {
    const parsed = normalizeIslandMap({ ...map(), width, height, landRows })

    if (!parsed) throw new Error('Test map is invalid')
    return buildIslandOutline(parsed)
  }
  const closedPaths = (path: string) => path.split('M').length - 1

  expect(outline([[0, 1]], 1, 1)).toBe('M0,0L1,0L1,-1L0,-1L0,0Z')
  expect(closedPaths(outline([[0, 1, 2, 3]], 3, 1))).toBe(2)
  expect(closedPaths(outline([[0, 3], [0, 1, 2, 3], [0, 3]], 3, 3))).toBe(2)
  expect(outline([[]], 1, 1)).toBe('')
})
