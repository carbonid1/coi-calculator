import { crops, type CropFarmGroup, type CropSchedule } from './crop-farming'

const group = (schedule: CropSchedule, farmCount = 1, targetFertilityPercent = 140): CropFarmGroup => ({
  id: schedule.join('-'),
  name: schedule.map(id => crops[id].name).join(' / '),
  farmCount,
  tierId: 'greenhouseII',
  schedule,
  fertilizer: { id: 'fertilizerII', targetFertilityPercent },
})

/** Planned rotations for Factory Total, including Station IV and two Research Lab IVs. */
export const activeCropFarmGroups: readonly CropFarmGroup[] = [
  group(['potato', 'corn', 'soybean']),
  group(['potato', 'corn', 'wheat', 'vegetables']),
  group(['potato', 'corn', 'fruit', 'corn']),
  group(['corn', 'wheat', 'corn', 'vegetables'], 3),
  group(['wheat', 'treeSapling', 'wheat', 'fruit'], 1, 100),
  group(['wheat', 'sugarCane', 'wheat', 'fruit'], 1, 130),
  group(['wheat', 'fruit', 'soybean', 'fruit']),
  group(['vegetables', 'canola', 'poppy', 'canola']),
]
