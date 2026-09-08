import { expect, it } from 'vitest'

import { allocateProcessingSupply, getResourcePriorityStorageKey, parseResourcePriorityOverrides } from './resource-priorities'

it('scopes persisted overrides to a save and rejects invalid settings', () => {
  expect(getResourcePriorityStorageKey(null)).toBeNull()
  expect(getResourcePriorityStorageKey('One / two')).not.toBe(getResourcePriorityStorageKey('One'))
  expect(parseResourcePriorityOverrides(JSON.stringify({
    12: { brine: 'local-first', salt: 'factory', badResource: 'local-first', water: 'bad' },
    13: ['local-first'], badArea: { brine: 'local-first' },
  }))).toEqual({ 12: { brine: 'local-first', salt: 'factory' } })
  for (const value of [null, 'bad json', 'null', '[]', '42']) {
    expect(parseResourcePriorityOverrides(value)).toEqual({})
  }
})

it('retains Default-area priorities after reloading and editing another area', () => {
  const reloaded = parseResourcePriorityOverrides(JSON.stringify({
    '-1': { water: 'local-first' }, '-2': { water: 'local-first' },
  }))

  expect(reloaded).toEqual({ '-1': { water: 'local-first' } })
  expect(parseResourcePriorityOverrides(JSON.stringify({
    ...reloaded, 12: { brine: 'local-first' },
  }))).toEqual({ '-1': { water: 'local-first' }, 12: { brine: 'local-first' } })
})

it('reserves only each preferred module’s own supply before normal priorities', () => {
  const result = allocateProcessingSupply([
    { id: 'global', moduleId: 'global', desired: 100, localFirst: false },
    { id: 'a', moduleId: 'a', desired: 80, localFirst: true },
    { id: 'b', moduleId: 'b', desired: 80, localFirst: true },
  ], new Map([['a', 30], ['b', 20]]), 100, 100)

  expect(Object.fromEntries(result)).toEqual({ a: 30, b: 20, global: 50 })
})

it('uses only needed local supply and leaves committed consumption intact', () => {
  const requests = [
    { id: 'global', moduleId: 'global', desired: 100, localFirst: false },
    { id: 'a', moduleId: 'a', desired: 80, localFirst: true },
  ]

  expect(Object.fromEntries(allocateProcessingSupply(requests, new Map([['a', 100]]), 60, 60)))
    .toEqual({ a: 60, global: 0 })
  expect(Object.fromEntries(allocateProcessingSupply(requests, new Map(), 100, 100)))
    .toEqual({ a: 0, global: 100 })
})
