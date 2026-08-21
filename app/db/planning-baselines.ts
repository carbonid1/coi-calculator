import { type GameStateSnapshot } from "../game-state";

export interface PlanningBaselines {
  averageGeneratorOutputMw: number;
  hydrogenFuelDemandPerCycle: number;
}

export interface PlanningHistorySnapshot {
  history: {
    electricityGeneration: GameStateSnapshot["history"]["electricityGeneration"];
    hydrogenFuel: Pick<GameStateSnapshot["history"]["hydrogenFuel"], "total">;
  };
}

export const emptyPlanningBaselines = {
  averageGeneratorOutputMw: 0,
  hydrogenFuelDemandPerCycle: 0,
} as const satisfies PlanningBaselines;

const separatelyModeledGenerationPrototypeIds = new Set(["SolarPanel", "SolarPanelMono"]);

export const isSeparatelyModeledGenerationPrototype = (prototypeId: string) =>
  separatelyModeledGenerationPrototypeIds.has(prototypeId);

export const resolvePlanningBaselines = (
  snapshot: PlanningHistorySnapshot | null,
): PlanningBaselines => {
  if (!snapshot) return emptyPlanningBaselines;

  const generationTypes = snapshot.history.electricityGeneration.byType.filter(
    generation =>
      generation.sampleMonths > 0 &&
      !isSeparatelyModeledGenerationPrototype(generation.prototypeId),
  );
  const hydrogenFuel = snapshot.history.hydrogenFuel.total;
  const generationWindowCycles = generationTypes.reduce(
    (window, generation) => Math.max(window, generation.sampleMonths),
    0,
  );

  return {
    averageGeneratorOutputMw: generationWindowCycles > 0
      ? generationTypes.reduce(
          (total, generation) => (
            total + generation.averageMw * generation.sampleMonths
          ),
          0,
        ) / generationWindowCycles
      : 0,
    hydrogenFuelDemandPerCycle:
      hydrogenFuel.sampleMonths > 0 ? hydrogenFuel.averagePerCycle : 0,
  };
};
