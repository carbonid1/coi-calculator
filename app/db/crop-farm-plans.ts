import { crops, type CropFarmGroup, type CropSchedule } from './crop-farming'

const group = (schedule: CropSchedule, farmCount = 1): CropFarmGroup => ({
  id: schedule.join('-'),
  name: schedule.map(id => crops[id].name).join(' / '),
  farmCount,
  tierId: 'greenhouseII',
  schedule,
  fertilizer: { id: 'fertilizerII', targetFertilityPercent: 140 },
})

/** Fixed rotations for the projected population and office plans, September 2026. */
export const activeCropFarmGroups: readonly CropFarmGroup[] = [
  group(['canola', 'corn', 'wheat']),
  group(['corn', 'potato', 'vegetables']),
  group(['corn', 'soybean', 'vegetables']),
  group(['canola', 'fruit', 'poppy', 'fruit']),
  group(['corn', 'vegetables', 'potato', 'vegetables']),
  group(['corn', 'wheat'], 3),
  group(['fruit', 'potato', 'soybean', 'wheat']),
  group(['fruit', 'sugarCane', 'fruit', 'treeSapling']),
]
