import { type GameStateSnapshot } from "../game-state";

export interface PlanningBaselines {
  averageGeneratorOutputMw: number;
  hydrogenFuelDemandPerCycle: number;
}

export interface PlanningHistorySnapshot {
  history: {
    electricityGeneration: GameStateSnapshot["history"]["electricityGeneration"];
    hydrogenFuel: Pick<GameStateSnapshot["history"]["hydrogenFuel"], "total">
      & Partial<Pick<GameStateSnapshot["history"]["hydrogenFuel"], "byUse">>;
  };
}

export const emptyPlanningBaselines = {
  averageGeneratorOutputMw: 0,
  hydrogenFuelDemandPerCycle: 0,
} as const satisfies PlanningBaselines;

const separatelyModeledGenerationPrototypeIds = new Set(["SolarPanel", "SolarPanelMono"]);

const isSeparatelyModeledGenerationPrototype = (prototypeId: string) =>
  separatelyModeledGenerationPrototypeIds.has(prototypeId);

export const resolvePlanningBaselines = (
  snapshot: PlanningHistorySnapshot,
  replaceCargoFuel = false,
): PlanningBaselines => {
  const generationTypes = snapshot.history.electricityGeneration.byType.filter(
    generation =>
      generation.sampleMonths > 0 &&
      !isSeparatelyModeledGenerationPrototype(generation.prototypeId),
  );
  const hydrogenFuel = snapshot.history.hydrogenFuel.total;
  const cargoFuel = snapshot.history.hydrogenFuel.byUse?.cargoShips;
  // The exporter weights the aggregate over a common window. Subtract the
  // cargo contribution in that same window before inserting current routes.
  const cargoContribution = replaceCargoFuel && cargoFuel && hydrogenFuel.sampleMonths > 0
    ? cargoFuel.averagePerCycle * cargoFuel.sampleMonths / hydrogenFuel.sampleMonths
    : 0;
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
      hydrogenFuel.sampleMonths > 0 ? Math.max(0, hydrogenFuel.averagePerCycle - cargoContribution) : 0,
  };
};
