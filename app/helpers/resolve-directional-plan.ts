import { type ValueSource } from '../data-source'

export type PlanDirection = 'at-least' | 'at-most'

export interface DirectionalPlan {
  direction: PlanDirection
  target: number
}

const isSatisfied = (current: number, plan: DirectionalPlan) =>
  plan.direction === 'at-least' ? current >= plan.target : current <= plan.target

export const resolveDirectionalPlan = (current: number, plan: DirectionalPlan) => {
  const satisfied = isSatisfied(current, plan)
  const source: ValueSource = satisfied ? 'synced' : 'planned'
  const difference =
    plan.direction === 'at-least'
      ? Math.max(0, plan.target - current)
      : Math.max(0, current - plan.target)

  return {
    direction: plan.direction,
    difference,
    satisfied,
    target: plan.target,
    source,
    value: satisfied ? current : plan.target,
  }
}
