import { type ComputingConfig } from './computing'
import { activeCropFarmGroups } from './crop-farm-plans'
import { type CropFarmGroup } from './crop-farming'
import { plannedOfficePlan, type OfficeConfigurationCount } from './offices'
import { type ResourceProcessingPriorities } from './resource-supply'
import { type ResourceId } from './resources'

interface LiveAreaPlan {
  cropFarms?: readonly CropFarmGroup[]
  resourceProcessingPriorities?: ResourceProcessingPriorities
  /** Minimum running computing inventory, including installed server racks. */
  computing?: ComputingConfig
  /** Minimum running Office configurations; completed construction satisfies the target. */
  offices?: readonly OfficeConfigurationCount[]
  /** Solve with the factory pool. Omitted areas solve locally before exchanging their boundary flows. */
  resourcePool?: 'factory'
  requestedImports?: Partial<Record<ResourceId, number>>
  requestedExports?: Partial<Record<ResourceId, number>>
}

export type LiveAreaPlans = Readonly<Record<number, LiveAreaPlan>>

/** Save-scoped operating requests. Area names are labels and never identity. */
const liveAreaPlansBySave: Readonly<Record<string, LiveAreaPlans>> = {
  'Last-Stop Waters': {
    10: { cropFarms: activeCropFarmGroups },
    12: {
      resourceProcessingPriorities: { brine: 'local-first' },
    },
    13: {
      computing: { dataCenterCount: 8, rackCount: 384, waterChillers: 8 },
    },
    16: {
      resourcePool: 'factory',
    },
    21: {
      resourcePool: 'factory',
    },
    23: {
      offices: [{ tierId: 'officeIII', ...plannedOfficePlan.offices.officeIII }],
    },
  },
}

export const getLiveAreaPlans = (saveId: string | null | undefined): LiveAreaPlans => (
  saveId ? liveAreaPlansBySave[saveId] ?? {} : {}
)
