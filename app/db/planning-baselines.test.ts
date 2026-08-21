import { describe, expect, it } from "vitest";

import {
  emptyPlanningBaselines,
  type PlanningHistorySnapshot,
  resolvePlanningBaselines,
} from "./planning-baselines";

const snapshot = {
  history: {
    hydrogenFuel: {
      total: { averagePerCycle: 52.25, sampleMonths: 120 },
    },
    electricityGeneration: {
      byType: [
        {
          prototypeId: "PowerGeneratorT2",
          name: "Power Generator II",
          averageMw: 76.5,
          sampleMonths: 120,
        },
        {
          prototypeId: "DieselGeneratorT2",
          name: "Diesel Generator II",
          averageMw: 1.25,
          sampleMonths: 120,
        },
        {
          prototypeId: "SolarPanelMono",
          name: "Solar Panel (Mono)",
          averageMw: 24,
          sampleMonths: 120,
        },
      ],
    },
  },
} satisfies PlanningHistorySnapshot;

describe("synced operating baselines", () => {
  it("sums non-solar generator types and uses actual Hydrogen fuel history", () => {
    expect(resolvePlanningBaselines(snapshot)).toEqual({
      averageGeneratorOutputMw: 77.75,
      hydrogenFuelDemandPerCycle: 52.25,
    });
  });

  it("uses zero when no completed history exists", () => {
    expect(
      resolvePlanningBaselines({
        ...snapshot,
        history: {
          ...snapshot.history,
          hydrogenFuel: {
            ...snapshot.history.hydrogenFuel,
            total: { averagePerCycle: 0, sampleMonths: 0 },
          },
          electricityGeneration: {
            byType: snapshot.history.electricityGeneration.byType.map(generation => ({
              ...generation,
              averageMw: 0,
              sampleMonths: 0,
            })),
          },
        },
      }),
    ).toEqual(emptyPlanningBaselines);
    expect(resolvePlanningBaselines(null)).toEqual(emptyPlanningBaselines);
  });

  it("weights generator averages over one common history window", () => {
    expect(
      resolvePlanningBaselines({
        ...snapshot,
        history: {
          ...snapshot.history,
          electricityGeneration: {
            byType: [
              {
                prototypeId: "PowerGeneratorT2",
                name: "Power Generator II",
                averageMw: 60,
                sampleMonths: 120,
              },
              {
                prototypeId: "DieselGeneratorT2",
                name: "Diesel Generator II",
                averageMw: 12,
                sampleMonths: 1,
              },
            ],
          },
        },
      }),
    ).toMatchObject({
      averageGeneratorOutputMw: 60.1,
    });
  });
});
