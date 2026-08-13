export interface PlanningBaselines {
  averageNuclearGenerationMw: number;
  hydrogenFuelDemandPerCycle: number;
}

export const defaultPlanningBaselines = {
  // Conservative FBR output for the first Nuclear checkpoint.
  averageNuclearGenerationMw: 50,
  hydrogenFuelDemandPerCycle: 50,
} as const satisfies PlanningBaselines;
