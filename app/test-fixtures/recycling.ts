import { type RecyclingData } from '../helpers/recycling/recycling'

/** Explicit provenance for synthetic solver scenarios, not a production catalog. */
export const testRecycling: RecyclingData = {
  efficiencyPercent: 20,
  scrapPerRecyclable: 2,
  products: [
    { productId: 'mechanicalParts', name: 'Mechanical Parts', sources: [{ productId: 'ironScrap', name: 'Iron Scrap', quantity: 1 }] },
    { productId: 'electronicsI', name: 'Electronics I', sources: [{ productId: 'copperScrap', name: 'Copper Scrap', quantity: 1 }] },
    { productId: 'electronicsII', name: 'Electronics II', sources: [
      { productId: 'copperScrap', name: 'Copper Scrap', quantity: 2.25 },
      { productId: 'brokenGlass', name: 'Broken Glass', quantity: 0.25 },
    ] },
    { productId: 'electronicsIII', name: 'Electronics III', sources: [{ productId: 'copperScrap', name: 'Copper Scrap', quantity: 5 }] },
    { productId: 'householdGoods', name: 'Household Goods', sources: [{ productId: 'ironScrap', name: 'Iron Scrap', quantity: 1 }] },
    { productId: 'medicalSupplies', name: 'Medical Supplies', sources: [{ productId: 'brokenGlass', name: 'Broken Glass', quantity: 1 }] },
  ],
}
