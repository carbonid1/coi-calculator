import { type MaintenanceReducerLevel } from '../../db/edicts'
import { getEdictEffects, type PlanningDefinitions } from '../../planning-state'

export const calculateMaintenanceDemandReduction = (
  definitions: PlanningDefinitions,
  edictLevel: MaintenanceReducerLevel,
  statueCount: number,
) => {
  const count = Math.max(0, Math.trunc(statueCount))
  const reduction =
    definitions.statue.reductionsByCount[
      Math.min(count, definitions.statue.reductionsByCount.length - 1)
    ]

  if (reduction === undefined) throw new Error('Statue reduction table is incomplete')
  const edictReductionPercent = -(
    getEdictEffects(definitions, 'maintenanceReducer', edictLevel).effects
      .MaintenanceConsumptionMultiplier ?? 0
  )

  return {
    edictReductionPercent,
    statueReductionPercent: reduction,
    totalReductionPercent: edictReductionPercent + reduction,
    statueFuelGasPerCycle: count * definitions.statue.fuelPerCycle,
  }
}
