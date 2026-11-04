import { type EdictLevel } from '../../db/edicts'
import { getEdictEffects, type PlanningDefinitions } from '../../planning-state'

export interface RecyclingEfficiencyResult {
  effectivePercent: number
}
/** Project only policy and Focus changes on top of observed recycling. */
export const calculateRecyclingEfficiency = (
  definitions: PlanningDefinitions,
  level: EdictLevel,
  focusBonusPercent = 0,
): RecyclingEfficiencyResult => ({
  effectivePercent:
    (getEdictEffects(definitions, 'recyclingIncrease', level).effects.RecyclingRatioDiff ?? 0) +
    Math.max(0, focusBonusPercent),
})
