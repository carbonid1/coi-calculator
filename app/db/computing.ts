export interface ComputingConfig {
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
  // One full data center plus 14 racks in the second.
  rackCount: 62,
  waterChillers: 2,
};

export const getDataCenterCount = (rackCount: number) => (
  Math.ceil(Math.max(0, Math.trunc(rackCount)) / dataCenter.rackCapacity)
);

export const getRackAllocation = (rackCount: number): number[] => {
  const normalizedRackCount = Math.max(0, Math.trunc(rackCount));
  const fullDataCenters = Math.floor(normalizedRackCount / dataCenter.rackCapacity);
  const partialDataCenterRacks = normalizedRackCount % dataCenter.rackCapacity;

  return [
    ...Array.from({ length: fullDataCenters }, () => dataCenter.rackCapacity),
    ...(partialDataCenterRacks > 0 ? [partialDataCenterRacks] : []),
  ];
};
