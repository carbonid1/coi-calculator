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
  // Two full data centers and one half-full data center.
  rackCount: 120,
  waterChillers: 3,
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
