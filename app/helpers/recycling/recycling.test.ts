import { describe, expect, it } from 'vitest'

import { testRecycling } from '../../test-fixtures/recycling'
import { getProductRecyclingSources, isRecyclingData, resolveRecyclingSources } from './recycling'

describe('recycling snapshot data', () => {
  it('retains trace source quantities and native product aliases', () => {
    const data = { ...testRecycling, products: [{
      productId: 'Product_Electronics2', name: 'Electronics II',
      sources: [{ productId: 'Product_CopperScrap', name: 'Copper Scrap', quantity: 0.0000000042 }],
    }] }

    expect(isRecyclingData(data)).toBe(true)
    expect(getProductRecyclingSources(data, 'electronicsII')).toEqual({ copperScrap: 0.0000000042 })
  })

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid efficiency %s', efficiencyPercent => {
    expect(isRecyclingData({ ...testRecycling, efficiencyPercent })).toBe(false)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid source quantity %s', quantity => {
    expect(isRecyclingData({ ...testRecycling, products: [{
      productId: 'test', name: 'Test', sources: [{ productId: 'ironScrap', name: 'Iron Scrap', quantity }],
    }] })).toBe(false)
  })

  it('rejects duplicate product and source IDs', () => {
    expect(isRecyclingData({ ...testRecycling, products: [testRecycling.products[0], testRecycling.products[0]] })).toBe(false)
    expect(isRecyclingData({ ...testRecycling, products: [{ ...testRecycling.products[0],
      sources: [...testRecycling.products[0].sources, ...testRecycling.products[0].sources],
    }] })).toBe(false)
  })

  it('keeps unknown source composition unavailable instead of dropping a component', () => {
    expect(resolveRecyclingSources([
      { productId: 'Product_IronScrap', name: 'Iron Scrap', quantity: 1 },
      { productId: 'Unknown', name: 'Unknown scrap', quantity: 1 },
    ])).toBeNull()
  })
})
