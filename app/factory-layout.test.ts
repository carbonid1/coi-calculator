import { expect, it } from 'vitest'

import { buildFactoryFootprintPath, normalizeFactoryLayout } from './factory-layout'

const layout = () => ({
  schemaVersion: 1, gameId: 'game', sessionId: 'session',
  areas: [{ id: 1, outline: [[0, 0], [10, 0], [10, 10]] }, { id: 2, outline: [[0, 0], [-10, 0], [-10, -10]] }],
  shapes: [[[-1, -1, 1, 1]], [[-2, -1, 2, 1], [-1, 1, 1, 2]]],
  buildings: [
    { id: 7, prototypeId: 'Smelter', x: 5, y: 5, shape: 0, constructed: true, areas: [1] },
    { id: 8, prototypeId: 'Depot', x: -5, y: -5, shape: 1, constructed: false, areas: [1, 2] },
  ],
})

it('accepts a well-formed layout unchanged', () => {
  expect(normalizeFactoryLayout(layout())).toEqual(layout())
})

it.each([
  { name: 'a different schema version', change: { schemaVersion: 2 } },
  { name: 'an empty game id', change: { gameId: '' } },
  { name: 'an empty session id', change: { sessionId: '' } },
  { name: 'duplicate area ids', change: { areas: [layout().areas[0], layout().areas[0]] } },
  { name: 'an outline with two points', change: { areas: [{ id: 1, outline: [[0, 0], [1, 1]] }] } },
  { name: 'a coordinate outside the map', change: { areas: [{ id: 1, outline: [[0, 0], [70000, 0], [0, 10]] }] } },
  { name: 'a fractional coordinate', change: { areas: [{ id: 1, outline: [[0, 0], [1.5, 0], [0, 10]] }] } },
  { name: 'an empty shape', change: { shapes: [[]] } },
  { name: 'a rectangle with no width', change: { shapes: [[[1, -1, 1, 1]]] } },
  { name: 'a rectangle with no height', change: { shapes: [[[-1, 1, 1, 1]]] } },
])('rejects $name', ({ change }) => {
  expect(normalizeFactoryLayout({ ...layout(), ...change })).toBeNull()
})

it.each([
  { name: 'a shape index past the end', change: { shape: 2 } },
  { name: 'an unknown area', change: { areas: [3] } },
  { name: 'the same area twice', change: { areas: [1, 1] } },
  { name: 'an empty prototype id', change: { prototypeId: '' } },
  { name: 'a non-boolean construction flag', change: { constructed: 1 } },
  { name: 'a duplicate building id', change: { id: 8 } },
])('rejects a building with $name', ({ change }) => {
  const [first, second] = layout().buildings

  expect(normalizeFactoryLayout({ ...layout(), buildings: [{ ...first, ...change }, second] })).toBeNull()
})

it.each([null, 'text', [], 42])('rejects a reply that is not an object: %s', value => {
  expect(normalizeFactoryLayout(value)).toBeNull()
})

it('draws footprints north-up by negating y', () => {
  expect(buildFactoryFootprintPath([[-1, -2, 3, 4]])).toBe('M-1,2H3V-4H-1Z')
  expect(buildFactoryFootprintPath([[0, 1, 2, 3], [4, 5, 6, 7]])).toBe('M0,-1H2V-3H0ZM4,-5H6V-7H4Z')
})
