import {
  maintenanceReducerEdict,
  type MaintenanceReducerLevel,
} from "../../db/edicts";
import { maintenanceStatue } from "../../db/maintenance-statue";

export const calculateMaintenanceStatueEffect = (count: number) => {
  const normalizedCount = Math.max(0, Math.trunc(count));
  const multiplier = maintenanceStatue.additionalEffectMultiplier;

  // Captain of Industry v0.8.7 applies the full 4% to the first maintained
  // golden statue and halves every additional statue's effect.
  const reductionPercent = normalizedCount === 0
    ? 0
    : maintenanceStatue.baseReductionPercent
      * ((1 - multiplier ** normalizedCount) / (1 - multiplier));

  return {
    count: normalizedCount,
    reductionPercent,
    fuelGasPerCycle: normalizedCount * maintenanceStatue.fuelGasPerCycle,
  };
};

export const calculateMaintenanceDemandReduction = (
  edictLevel: MaintenanceReducerLevel,
  statueCount: number,
) => {
  const edict = maintenanceReducerEdict.levels[edictLevel];
  const statues = calculateMaintenanceStatueEffect(statueCount);

  return {
    edictReductionPercent: edict.maintenanceReductionPercent,
    statueReductionPercent: statues.reductionPercent,
    totalReductionPercent: edict.maintenanceReductionPercent + statues.reductionPercent,
    statueFuelGasPerCycle: statues.fuelGasPerCycle,
  };
};
