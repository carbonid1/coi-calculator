export interface PlanningBaselines {
  fbrAverageGenerationMw: number;
  hydrogenFuelDemandPerCycle: number;
}

export const defaultPlanningBaselines = {
  // Approximate mean digitized from the in-game 100-year production graph.
  fbrAverageGenerationMw: 30.2,
  hydrogenFuelDemandPerCycle: 45,
} as const satisfies PlanningBaselines;
