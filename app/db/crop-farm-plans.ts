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

/** Planned Third FBR rotations for 27 Housing III and 3,850 chickens. */
export const thirdFbrCropFarmGroups: readonly CropFarmGroup[] = [
  group(['corn', 'vegetables']),
  group(['potato', 'corn', 'soybean']),
  group(['corn', 'wheat', 'vegetables']),
  group(['wheat', 'poppy', 'greenManure'], 1, 130),
  group(['potato', 'corn', 'wheat', 'corn']),
  group(['potato', 'corn', 'wheat', 'canola']),
  group(['corn', 'wheat', 'corn', 'vegetables']),
  group(['corn', 'vegetables', 'corn', 'fruit']),
  group(['wheat', 'treeSapling', 'wheat', 'fruit'], 1, 100),
  group(['wheat', 'soybean', 'fruit', 'canola'], 1, 120),
  group(['wheat', 'sugarCane', 'wheat', 'fruit'], 1, 130),
  group(['wheat', 'fruit', 'wheat', 'canola']),
]

/** Rotations for Appliances & Waste Recovery with 28 Housing III and 3,900 chickens. */
export const applianceCropFarmGroups: readonly CropFarmGroup[] = [
  group(['corn', 'vegetables']),
  group(['corn', 'wheat']),
  group(['poppy', 'vegetables', 'soybean']),
  group(['corn', 'wheat', 'vegetables']),
  group(['corn', 'wheat', 'corn', 'potato']),
  group(['canola', 'vegetables', 'sugarCane', 'treeSapling'], 1, 130),
  group(['corn', 'fruit', 'corn', 'potato'], 1, 130),
  group(['canola', 'corn', 'wheat']),
  group(['wheat', 'canola', 'wheat', 'fruit']),
  group(['corn', 'wheat', 'potato'], 1, 120),
  group(['corn', 'wheat', 'fruit', 'potato']),
  group(['fruit', 'wheat', 'soybean']),
]
