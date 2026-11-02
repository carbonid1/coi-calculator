import { type GameStateSnapshot } from '../game-state'

const WINDOW_MONTHS = 120
const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const amount = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
)

export const getGameMonth = (date: unknown): number | null => {
  if (typeof date !== 'string') return null
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(date)

  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isSafeInteger(year) || year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const index = (year - 1) * 12 + month - 1

  return Number.isSafeInteger(index) ? index : null
}

/** Only finished months belong to the existing 10-year planning baseline. */
export const normalizeHydrogenFuelHistory = (value: unknown, sampleMonths: number): {
  month: number
  total: GameStateSnapshot['history']['hydrogenFuel']['total']
} | null => {
  if (!record(value) || value.resolution !== 'month' || !Array.isArray(value.unknownIds)
    || value.unknownIds.length > 0 || !record(value.products) || !record(value.products.Product_Hydrogen)
    || !Number.isInteger(sampleMonths) || sampleMonths < 0 || sampleMonths > WINDOW_MONTHS) return null
  const month = getGameMonth(value.date)
  const start = getGameMonth(value.start)
  const points = value.products.Product_Hydrogen.consumedAsFuel

  if (month === null || start === null || typeof value.start !== 'string' || !value.start.endsWith('-1')
    || month - start !== Math.min(WINDOW_MONTHS, month)
    || !Array.isArray(points) || points.length !== month - start + 1 || !points.every(amount)
    || points.length - 1 < sampleMonths) return null
  // The native API pads older flow history with zeroes and appends the current
  // month. Bridge category sample counts retain the actual fuel-tracking window,
  // including fuels first used less than 10 in-game years ago.
  const finished = points.slice(0, -1)

  if (sampleMonths === 0 && finished.some(value => value > 0)) return null
  const sum = sampleMonths > 0 ? finished.slice(-sampleMonths).reduce((total, value) => total + value, 0) : 0

  if (!Number.isSafeInteger(sum)) return null
  return {
    month,
    // Match the Bridge's existing six-decimal snapshot precision.
    total: { averagePerCycle: sampleMonths > 0 ? Number((sum / sampleMonths).toFixed(6)) : 0, sampleMonths },
  }
}
