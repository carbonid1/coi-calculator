import { type NativeProducts } from '../product-state'

export const testProducts: NativeProducts = {
  gameId: '123', sessionId: '456',
  catalog: [
    { id: 'Product_Salt', name: 'Salt from the game', kind: 'loose', isUnlocked: true },
    { id: 'Product_Water', name: 'Water', kind: 'fluid', isUnlocked: true },
    { id: 'Product_Electronics', name: 'Electronics', kind: 'countable', isUnlocked: true },
    { id: 'Product_ConstructionParts', name: 'Construction Parts', kind: 'countable', isUnlocked: true },
    { id: 'Product_UnknownModded', name: 'Another mod product', kind: 'molten', isUnlocked: false },
  ],
  inventory: {
    Product_Salt: { quantity: 100, stored: 60, storageCapacity: 200 },
    Product_Water: { quantity: 1000, stored: 500, storageCapacity: 1000 },
  },
}
