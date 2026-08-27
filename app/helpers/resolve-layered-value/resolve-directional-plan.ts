import {
  resolveCurrentLayeredValue,
  type LayeredValue,
  type ResolvedCurrentValue,
  type ResolvedValue,
} from "./resolve-layered-value";

export type PlanDirection = "at-least" | "at-most";

export interface DirectionalPlan {
  direction: PlanDirection;
  target: number;
}

export interface ResolvedDirectionalPlan extends ResolvedValue<number> {
  current: ResolvedCurrentValue<number>;
  direction: PlanDirection;
  difference: number;
  satisfied: boolean;
  target: number;
}

const isSatisfied = (current: number, plan: DirectionalPlan) => (
  plan.direction === "at-least"
    ? current >= plan.target
    : current <= plan.target
);

/**
 * Applies a directional plan only while the highest-priority current value
 * does not satisfy it. Once reached, the current modeled/synced value wins and
 * the plan no longer appears as the effective source.
 */
export const resolveDirectionalPlan = (
  layers: LayeredValue<number>,
  plan: DirectionalPlan,
): ResolvedDirectionalPlan => {
  const current = resolveCurrentLayeredValue(layers);
  const satisfied = isSatisfied(current.value, plan);
  const difference = plan.direction === "at-least"
    ? Math.max(0, plan.target - current.value)
    : Math.max(0, current.value - plan.target);

  return {
    current,
    direction: plan.direction,
    difference,
    satisfied,
    target: plan.target,
    ...(satisfied
      ? current
      : { source: "planned" as const, value: plan.target }),
  };
};
