export interface ComputingConfig {
  dataCenterCount: number;
  rackCount: number;
  waterChillers: number;
}

export const computingRecipeIds = {
  dataCenter: "computing-data-center",
  basicRack: "computing-basic-rack",
  waterChiller: "computing-water-chiller",
} as const;

export const dataCenter = {
  rackCapacity: 48,
  computingTflopsPerRack: 4,
  chilledWaterPerRack: 0.5,
} as const;

export const defaultComputingConfig: ComputingConfig = {
  // Two full data centers.
  dataCenterCount: 2,
  rackCount: 96,
  waterChillers: 2,
};

export const modeledComputingConfig: ComputingConfig = {
  // Three full rack banks plus 31 racks in the fourth data center.
  dataCenterCount: 4,
  rackCount: 175,
  waterChillers: 4,
};

export const plannedComputingConfig: ComputingConfig | undefined = undefined;

const computingConfigLayers: LayeredValue<ComputingConfig> = {
  default: defaultComputingConfig,
  modeled: modeledComputingConfig,
  planned: plannedComputingConfig,
};

export const resolvedCurrentComputingConfig = resolveCurrentLayeredValue(
  computingConfigLayers,
);
export const resolvedComputingConfig = resolveLayeredValue(computingConfigLayers);

export const getDataCenterCount = (rackCount: number) => (
  Math.ceil(Math.max(0, Math.trunc(rackCount)) / dataCenter.rackCapacity)
);

export const getRackAllocation = (
  rackCount: number,
  dataCenterCount: number = getDataCenterCount(rackCount),
): number[] => {
  const normalizedRackCount = Math.max(0, Math.trunc(rackCount));
  const normalizedDataCenterCount = Math.max(
    getDataCenterCount(normalizedRackCount),
    Math.max(0, Math.trunc(dataCenterCount)),
  );

  return Array.from({ length: normalizedDataCenterCount }, (_, index) => (
    Math.min(
      dataCenter.rackCapacity,
      Math.max(0, normalizedRackCount - index * dataCenter.rackCapacity),
    )
  ));
};
import {
  type LayeredValue,
  resolveCurrentLayeredValue,
  resolveLayeredValue,
} from "../helpers/resolve-layered-value/resolve-layered-value";
