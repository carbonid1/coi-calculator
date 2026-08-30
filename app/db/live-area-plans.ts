import { type ResourceId } from './resources'

export interface LiveAreaPlan {
  /** Resource ledger used by this named area. Omitted areas remain isolated. */
  resourcePool?: 'factory'
  requestedExports?: Partial<Record<ResourceId, number>>
}

export type LiveAreaPlans = Readonly<Record<string, LiveAreaPlan>>

/** Calculator-owned operating requests for synced named game areas. */
export const liveAreaPlans: LiveAreaPlans = {
  'Copper #1': {
    resourcePool: 'factory',
  },
}
