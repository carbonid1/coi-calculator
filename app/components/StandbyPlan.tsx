import { type Recipe } from '../db/recipes'
import { resources } from '../db/resources'
import { getDataSourceSurfaceClassName } from './DataSourceState'

export const StandbyPlan = ({ plan }: { plan: Recipe['standbyPlan'] }) => plan ? (
  <p className={getDataSourceSurfaceClassName('planned', { className: 'mb-2 rounded-lg border px-2 py-1 text-xs' })}>
    Planned {resources[plan.resourceId].name}: {plan.quantity} / cycle
  </p>
) : null
