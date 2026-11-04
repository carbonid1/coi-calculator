import { type BuildingDefinition } from '../building-state';
import { getFocusDefinitions, getOfficeDefinition, type OfficeFocusDefinitions } from '../office-focus-state';
import { getBuildingData } from './buildings';
import { officeCatalog, type OfficeTierId, type OfficeBoostStep, type FocusEffectId } from './office-catalog';

export { officeCatalog, focusCatalog, mapFocusValues, type OfficeTierId, type OfficeBoostStep, type FocusEffectId } from './office-catalog';
type FocusId = FocusEffectId;

interface OfficeTierPlan {
  count: number;
  computingBoostStep: OfficeBoostStep;
}

export interface OfficePlan {
  officeSuppliesAssemblyVCount: number;
  offices: Record<OfficeTierId, OfficeTierPlan>;
  focusSteps: Record<FocusId, number>;
}

export interface OfficeConfigurationCount {
  tierId: OfficeTierId;
  computingBoostStep: OfficeBoostStep;
  count: number;
}

const emptyFocusSteps: Record<FocusId, number> = {
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

export const plannedOfficePlan: OfficePlan = {
  ...defaultOfficePlan,
  officeSuppliesAssemblyVCount: 1,
  offices: {
    ...defaultOfficePlan.offices,
    officeIII: { count: 3, computingBoostStep: 2 },
  },
};

const normalizeCount = (count: number) => Math.max(0, Math.trunc(count));

export const getOfficeRecipeId = (tierId: OfficeTierId, computingBoostStep: OfficeBoostStep) =>
  `${tierId}-boost-${computingBoostStep}`;

export const calculateFocusPointsCost = (focus: { pointCosts: readonly number[] }, targetStep: number) => {
  const cost = focus.pointCosts[Math.min(focus.pointCosts.length - 1, Math.max(0, Math.trunc(targetStep)))];

  if (cost === undefined) throw new Error('Focus cost table is incomplete');
  return cost;
};

export interface OfficePlanCalculation {
  bonuses: Record<FocusEffectId, number>;
  focusPointsAvailable: number;
  focusPointsCapacity: number;
  focusPointsRequired: number;
  focusResearchBonusPercent: number;
  isAffordable: boolean;
  officeSuppliesPerCycle: number;
  computingTflops: number;
  electricityKw: number;
  workers: number;
}

export const calculateOfficePlan = (
  plan: OfficePlan,
  definitions: OfficeFocusDefinitions,
  syncedConfigurations?: readonly OfficeConfigurationCount[],
  buildingDefinitions: readonly BuildingDefinition[] = [],
): OfficePlanCalculation => {
  const totals = { focusPointsCapacity: 0, officeSuppliesPerCycle: 0, computingTflops: 0, electricityKw: 0, workers: 0 };
  const configurations = syncedConfigurations ?? officeCatalog.map(office => ({
    tierId: office.id, computingBoostStep: plan.offices[office.id].computingBoostStep, count: plan.offices[office.id].count,
  }));

  for (const configuration of configurations) {
    const office = officeCatalog.find(candidate => candidate.id === configuration.tierId);
    const count = normalizeCount(configuration.count);

    if (!office || count === 0) continue;
    const building = getBuildingData(office.name, buildingDefinitions, office.prototypeId);
    const definition = getOfficeDefinition(definitions, office.prototypeId);
    const boost = definition.boosts[configuration.computingBoostStep];

    if (!building || !boost) throw new Error(`Office requirements unavailable for ${office.name}`);
    // Installed OfficeBuilding rounds the property multiplier and boost separately.
    const baseFocus = Math.round(building.workers * definitions.pointsMultiplierPercent / 100);
    const boostFocus = Math.round(building.workers * boost.focusBonusPercent / 100);

    totals.focusPointsCapacity += count * (baseFocus + boostFocus);
    totals.officeSuppliesPerCycle += count * definition.suppliesPerCycle;
    totals.computingTflops += count * boost.computingTflops;
    totals.electricityKw += count * building.electricityKw;
    totals.workers += count * building.workers;
  }
  const focuses = getFocusDefinitions(definitions);
  const bonuses: Record<FocusEffectId, number> = { ...emptyFocusSteps };

  for (const focus of focuses) {
    const step = Math.min(focus.maxStep, Math.max(0, Math.trunc(plan.focusSteps[focus.id])));

    bonuses[focus.id] = step * focus.percentPerStep;
  }
  const focusPointsRequired = focuses.reduce((total, focus) => total + calculateFocusPointsCost(focus, plan.focusSteps[focus.id]), 0);

  return {
    ...totals, bonuses, focusPointsAvailable: Math.max(0, totals.focusPointsCapacity - focusPointsRequired),
    focusPointsRequired, focusResearchBonusPercent: definitions.pointsMultiplierPercent - 100,
    isAffordable: focusPointsRequired <= totals.focusPointsCapacity,
  };
};
