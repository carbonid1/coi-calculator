import { type ResourceId } from './resources'

interface LiveAreaPlan {
  /** Resource ledger used by this synced area. Omitted areas remain isolated. */
  resourcePool?: 'factory'
  requestedImports?: Partial<Record<ResourceId, number>>
  requestedExports?: Partial<Record<ResourceId, number>>
}

export type LiveAreaPlans = Readonly<Record<number, LiveAreaPlan>>

/** Save-scoped operating requests. Area names are labels and never identity. */
const liveAreaPlansBySave: Readonly<Record<string, LiveAreaPlans>> = {
  'Last-Stop Waters': {
    16: {
      resourcePool: 'factory',
    },
    21: {
      resourcePool: 'factory',
    },
  },
}

export const getLiveAreaPlans = (saveId: string | null | undefined): LiveAreaPlans => (
  saveId ? liveAreaPlansBySave[saveId] ?? {} : {}
)
