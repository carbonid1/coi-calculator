import { describe, expect, it } from 'vitest'
import { resolveSyncedResourceId } from './synced-resources'

describe('resolveSyncedResourceId', () => {
  it.each([
    ['Product_Electronics', 'Electronics', 'electronicsI'],
    ['Product_LabEquipment', 'Lab Equipment', 'labEquipmentI'],
    ['Product_VehicleParts', 'Vehicle Parts', 'vehiclePartsI'],
    ['Product_RailParts', 'Rail Parts', 'railParts'],
    ['Product_SlagCrushed', 'Slag crushed', 'slagCrushed'],
    ['Product_MicrochipsStage1A', 'Microchips stage 1 a', 'microchipStage1A'],
    ['Product_MicrochipsStage4B', 'Microchips stage 4 b', 'microchipStage4B'],
  ])('maps %s to %s', (productId, name, expected) => {
    expect(resolveSyncedResourceId({ productId, name })).toBe(expected)
  })
})
