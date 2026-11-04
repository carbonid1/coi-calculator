/** Current native daily simulation state. Absent on older compatible Bridges. */
export interface CropFarmRuntime {
  scheduleIndex: number
  cropId: string | null
  daysRemaining: number
  cropStarted: boolean
  irrigating: boolean
  soilWater: number
  waterCredit: number
  evaporatedWater: number
  rainPartial: number
}

export const isCropFarmRuntime = (value: unknown): value is CropFarmRuntime => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const state: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

  return amount(state.scheduleIndex) && Number.isInteger(state.scheduleIndex) && state.scheduleIndex < 4
    && (state.cropId === null || (typeof state.cropId === 'string' && state.cropId.length > 0))
    && amount(state.daysRemaining) && Number.isInteger(state.daysRemaining)
    && typeof state.cropStarted === 'boolean' && typeof state.irrigating === 'boolean'
    && amount(state.soilWater) && amount(state.waterCredit) && amount(state.evaporatedWater) && amount(state.rainPartial)
    && (state.cropId !== null || (!state.cropStarted && state.daysRemaining === 0))
}
