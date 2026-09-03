import { describe, expect, it } from 'vitest'

import { resolveDirectionalPlan } from './resolve-directional-plan'

describe('directional plans', () => {
  it('keeps an at-least target planned until synced state reaches it', () => {
    expect(resolveDirectionalPlan(4, { direction: 'at-least', target: 5 })).toMatchObject({
      source: 'planned',
      value: 5,
      difference: 1,
      satisfied: false,
    })

    expect(resolveDirectionalPlan(5, { direction: 'at-least', target: 5 })).toMatchObject({
      source: 'synced',
      value: 5,
      difference: 0,
      satisfied: true,
    })
  })

  it('keeps an at-most target planned until excess synced state is paused', () => {
    expect(resolveDirectionalPlan(6, { direction: 'at-most', target: 5 })).toMatchObject({
      source: 'planned',
      value: 5,
      difference: 1,
      satisfied: false,
    })

    expect(resolveDirectionalPlan(4, { direction: 'at-most', target: 5 })).toMatchObject({
      source: 'synced',
      value: 4,
      difference: 0,
      satisfied: true,
    })
  })
})
