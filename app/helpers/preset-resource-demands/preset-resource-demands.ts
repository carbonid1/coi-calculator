import { type Preset } from '../../db/modules/modules'
import { type ResourceId } from '../../db/resources'
import { typedEntries } from '../typed-entries/typed-entries'

type DemandPreset = Pick<Preset, 'fixedDemands' | 'plannedDemands' | 'requestedExports'>

/** Combines internal external loads with explicit module export requests. */
export const getPresetResourceDemands = (
  preset: DemandPreset | null | undefined,
): Partial<Record<ResourceId, number>> => {
  const demands: Partial<Record<ResourceId, number>> = {}

  for (const source of [preset?.fixedDemands, preset?.plannedDemands, preset?.requestedExports]) {
    for (const [resourceId, quantity] of typedEntries(source ?? {})) {
      demands[resourceId] = (demands[resourceId] ?? 0) + Math.max(0, quantity)
    }
  }

  return demands
}
