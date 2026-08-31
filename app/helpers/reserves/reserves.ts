import { type PassiveResult } from "../calculate/calculate";

type ReserveStatus = "unavailable" | "empty" | "idle" | "draining";

export interface ReserveRunway {
  balance: number | null;
  drawPerProductionCycle: number;
  inGameYearsRemaining: number | null;
  status: ReserveStatus;
}

const DRAW_TOLERANCE = 0.000001;

export const getReserveDrawPerProductionCycle = (
  sourceResults: PassiveResult[],
  recipeId: string,
  resourceId: string,
) => sourceResults
  .find(({ recipe }) => recipe.id === recipeId)
  ?.actualOutputs.find((output) => output.resourceId === resourceId)
  ?.quantity ?? 0;

export const calculateReserveRunway = (
  balance: number | null,
  drawPerProductionCycle: number,
): ReserveRunway => {
  const normalizedDraw = drawPerProductionCycle > DRAW_TOLERANCE
    ? drawPerProductionCycle
    : 0;

  if (balance === null) {
    return {
      balance,
      drawPerProductionCycle: normalizedDraw,
      inGameYearsRemaining: null,
      status: "unavailable",
    };
  }

  if (balance === 0) {
    return {
      balance,
      drawPerProductionCycle: normalizedDraw,
      inGameYearsRemaining: null,
      status: "empty",
    };
  }

  if (normalizedDraw === 0) {
    return {
      balance,
      drawPerProductionCycle: 0,
      inGameYearsRemaining: null,
      status: "idle",
    };
  }

  const productionCyclesRemaining = balance / normalizedDraw;

  return {
    balance,
    drawPerProductionCycle: normalizedDraw,
    inGameYearsRemaining: productionCyclesRemaining / 12,
    status: "draining",
  };
};
