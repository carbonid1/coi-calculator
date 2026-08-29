import { type ResourceId } from './resources'

export interface LiveAreaPlan {
  requestedExports: Partial<Record<ResourceId, number>>
}

export type LiveAreaPlans = Readonly<Record<string, LiveAreaPlan>>

/** Calculator-owned operating requests for synced named game areas. */
export const liveAreaPlans: LiveAreaPlans = {
  'Copper #1': {
    requestedExports: {
      copper: 384,
    },
  },
}
