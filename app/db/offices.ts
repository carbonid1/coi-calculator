import { resolveLayeredValue } from "../helpers/resolve-layered-value/resolve-layered-value";
import { focusPointsResearch } from "./research";

export type OfficeTierId = "officeI" | "officeII" | "officeIII";
export type OfficeBoostStep = 0 | 1 | 2;

export interface OfficeTierDefinition {
  id: OfficeTierId;
  name: string;
  workers: number;
  electricityKw: number;
  officeSuppliesPerCycle: number;
  recyclablesPerCycle: number;
  computingTflopsAtStepOne: number;
  gameVersion: string;
}

export const officeCatalog = [
  {
    id: "officeI",
    name: "Office I",
    workers: 250,
    electricityKw: 250,
    officeSuppliesPerCycle: 2,
    recyclablesPerCycle: 2,
    computingTflopsAtStepOne: 12,
    gameVersion: "0.8.7",
  },
  {
    id: "officeII",
    name: "Office II",
    workers: 500,
    electricityKw: 400,
    officeSuppliesPerCycle: 4,
    recyclablesPerCycle: 4,
    computingTflopsAtStepOne: 24,
    gameVersion: "0.8.7",
  },
  {
    id: "officeIII",
    name: "Office III",
    workers: 1_000,
    electricityKw: 600,
    officeSuppliesPerCycle: 8,
    recyclablesPerCycle: 8,
    computingTflopsAtStepOne: 48,
    gameVersion: "0.8.7",
  },
] as const satisfies readonly OfficeTierDefinition[];

export type FocusId =
  | "trucksCapacity"
  | "trainsCapacity"
  | "researchEfficiency"
  | "maintenanceProduction"
  | "cropYield"
  | "recyclingEfficiency"
  | "foodConsumption"
  | "settlementConsumption"
  | "unityProduction"
  | "contractsProfitability"
  | "contractsUnityCost"
  | "worldMinesEfficiency";

export type FocusEffectId = FocusId;

export interface FocusDefinition {
  id: FocusId;
  name: string;
  effectPerStep: string;
  percentPerStep: number;
  maxStep: number;
  basePointsCost: number;
  pointsCostIncrement: number;
  /** Whether this calculator currently has a consumer for the focus effect. */
  modeledInCalculator: boolean;
  gameVersion: string;
}

export const focusCatalog = [
  { id: "trucksCapacity", name: "Trucks Capacity", effectPerStep: "+2.5% capacity per step", percentPerStep: 2.5, maxStep: 40, basePointsCost: 40, pointsCostIncrement: 30, modeledInCalculator: false, gameVersion: "0.8.7" },
  { id: "trainsCapacity", name: "Trains Capacity", effectPerStep: "+2.5% capacity per step", percentPerStep: 2.5, maxStep: 40, basePointsCost: 40, pointsCostIncrement: 30, modeledInCalculator: false, gameVersion: "0.8.7" },
  { id: "researchEfficiency", name: "Research Efficiency", effectPerStep: "+2% efficiency per step", percentPerStep: 2, maxStep: 150, basePointsCost: 25, pointsCostIncrement: 10, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "maintenanceProduction", name: "Maintenance Production", effectPerStep: "+1% production per step", percentPerStep: 1, maxStep: 100, basePointsCost: 25, pointsCostIncrement: 10, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "cropYield", name: "Crop Yield", effectPerStep: "+2% yield per step", percentPerStep: 2, maxStep: 150, basePointsCost: 50, pointsCostIncrement: 10, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "recyclingEfficiency", name: "Recycling Efficiency", effectPerStep: "+1% efficiency per step", percentPerStep: 1, maxStep: 15, basePointsCost: 150, pointsCostIncrement: 50, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "foodConsumption", name: "Food Consumption", effectPerStep: "-2% consumption per step", percentPerStep: -2, maxStep: 15, basePointsCost: 75, pointsCostIncrement: 100, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "settlementConsumption", name: "Goods & Services Consumption", effectPerStep: "-2% consumption per step", percentPerStep: -2, maxStep: 25, basePointsCost: 125, pointsCostIncrement: 125, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "unityProduction", name: "Settlement Unity", effectPerStep: "+2.5% Unity per step", percentPerStep: 2.5, maxStep: 14, basePointsCost: 250, pointsCostIncrement: 250, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "contractsProfitability", name: "Contracts Profitability", effectPerStep: "+2% profitability per step", percentPerStep: 2, maxStep: 15, basePointsCost: 40, pointsCostIncrement: 40, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "contractsUnityCost", name: "Contracts Unity Cost", effectPerStep: "-2.5% Unity cost per step", percentPerStep: -2.5, maxStep: 20, basePointsCost: 40, pointsCostIncrement: 20, modeledInCalculator: true, gameVersion: "0.8.7" },
  { id: "worldMinesEfficiency", name: "World Mines & Rigs", effectPerStep: "+2% efficiency per step", percentPerStep: 2, maxStep: 25, basePointsCost: 50, pointsCostIncrement: 40, modeledInCalculator: false, gameVersion: "0.8.7" },
] as const satisfies readonly FocusDefinition[];

export interface OfficeTierPlan {
  count: number;
  computingBoostStep: OfficeBoostStep;
}

export interface OfficePlan {
  officeSuppliesAssemblyVCount: number;
  offices: Record<OfficeTierId, OfficeTierPlan>;
  focusSteps: Record<FocusId, number>;
}

export const emptyFocusSteps: Record<FocusId, number> = {
  trucksCapacity: 0,
  trainsCapacity: 0,
  researchEfficiency: 0,
  maintenanceProduction: 0,
  cropYield: 0,
  recyclingEfficiency: 0,
  foodConsumption: 0,
  settlementConsumption: 0,
  unityProduction: 0,
  contractsProfitability: 0,
  contractsUnityCost: 0,
  worldMinesEfficiency: 0,
};

export const defaultOfficePlan: OfficePlan = {
  officeSuppliesAssemblyVCount: 0,
  offices: {
    officeI: { count: 0, computingBoostStep: 0 },
    officeII: { count: 0, computingBoostStep: 0 },
    officeIII: { count: 0, computingBoostStep: 0 },
  },
  focusSteps: { ...emptyFocusSteps },
};

/**
 * Calculator-owned target. Set this to an OfficePlan when a future target is
 * requested. It remains authoritative over future synced data until changed
 * here explicitly; there is intentionally no automatic plan clearing.
 */
export const plannedOfficePlan: OfficePlan | undefined = undefined;

export const resolvedOfficePlan = resolveLayeredValue<OfficePlan>({
  default: defaultOfficePlan,
  planned: plannedOfficePlan,
});

const clampBoostStep = (step: number): OfficeBoostStep => {
  const normalizedStep = Math.min(2, Math.max(0, Math.trunc(step)));

  if (normalizedStep === 0) return 0;
  if (normalizedStep === 1) return 1;

  return 2;
};

const normalizeCount = (count: number) => Math.max(0, Math.trunc(count));

export const getOfficeRecipeId = (
  tierId: OfficeTierId,
  computingBoostStep: OfficeBoostStep,
) => `${tierId}-boost-${computingBoostStep}`;

export const calculateFocusPointsCost = (
  focus: FocusDefinition,
  targetStep: number,
) => {
  const step = Math.min(focus.maxStep, Math.max(0, Math.trunc(targetStep)));

  return step * (
    2 * focus.basePointsCost + (step - 1) * focus.pointsCostIncrement
  ) / 2;
};

export const calculateOfficeBoostBonusPercent = (step: number) => {
  const normalizedStep = clampBoostStep(step);

  return normalizedStep * 20 + Math.max(0, normalizedStep - 1) * 10;
};

export const calculateOfficeComputingTflops = (
  office: OfficeTierDefinition,
  step: number,
) => office.computingTflopsAtStepOne * clampBoostStep(step) ** 2;

export interface OfficePlanCalculation {
  bonuses: Record<FocusEffectId, number>;
  focusPointsAvailable: number;
  focusPointsCapacity: number;
  focusPointsRequired: number;
  focusResearchBonusPercent: number;
  isAffordable: boolean;
  officeSuppliesPerCycle: number;
  recyclablesPerCycle: number;
  computingTflops: number;
  electricityKw: number;
  workers: number;
}

export const calculateOfficePlan = (
  plan: OfficePlan,
  focusResearchLevel: number,
): OfficePlanCalculation => {
  const normalizedResearchLevel = Math.min(
    focusPointsResearch.maxLevel,
    Math.max(0, Math.trunc(focusResearchLevel)),
  );
  const focusResearchBonusPercent = normalizedResearchLevel
    * focusPointsResearch.percentPerLevel;
  let focusPointsCapacity = 0;
  let officeSuppliesPerCycle = 0;
  let recyclablesPerCycle = 0;
  let computingTflops = 0;
  let electricityKw = 0;
  let workers = 0;

  for (const office of officeCatalog) {
    const tierPlan = plan.offices[office.id];
    const count = normalizeCount(tierPlan.count);
    const boostStep = clampBoostStep(tierPlan.computingBoostStep);
    const baseFocusPerOffice = Math.round(
      office.workers * (1 + focusResearchBonusPercent / 100),
    );
    const boostFocusPerOffice = Math.round(
      office.workers * calculateOfficeBoostBonusPercent(boostStep) / 100,
    );

    focusPointsCapacity += count * (baseFocusPerOffice + boostFocusPerOffice);
    officeSuppliesPerCycle += count * office.officeSuppliesPerCycle;
    recyclablesPerCycle += count * office.recyclablesPerCycle;
    computingTflops += count * calculateOfficeComputingTflops(office, boostStep);
    electricityKw += count * office.electricityKw;
    workers += count * office.workers;
  }

  const bonuses: Record<FocusEffectId, number> = { ...emptyFocusSteps };

  for (const focus of focusCatalog) {
    const step = Math.min(
      focus.maxStep,
      Math.max(0, Math.trunc(plan.focusSteps[focus.id])),
    );

    bonuses[focus.id] = step * focus.percentPerStep;
  }
  const focusPointsRequired = focusCatalog.reduce((total, focus) => (
    total + calculateFocusPointsCost(focus, plan.focusSteps[focus.id])
  ), 0);

  return {
    bonuses,
    focusPointsAvailable: Math.max(0, focusPointsCapacity - focusPointsRequired),
    focusPointsCapacity,
    focusPointsRequired,
    focusResearchBonusPercent,
    isAffordable: focusPointsRequired <= focusPointsCapacity,
    officeSuppliesPerCycle,
    recyclablesPerCycle,
    computingTflops,
    electricityKw,
    workers,
  };
};
