import { type ComputingDefinitions } from '../planning-state'

export interface ComputingConfig {
  dataCenterCount: number
  rackCount: number
  waterChillers: number
}

export const computingRecipeIds = {
  dataCenter: 'computing-data-center',
  basicRack: 'computing-basic-rack',
  waterChiller: 'computing-water-chiller',
} as const

export const getDataCenterCount = (definitions: ComputingDefinitions, rackCount: number) =>
  Math.ceil(Math.max(0, Math.trunc(rackCount)) / definitions.rackCapacity)

export const getRackAllocation = (
  definitions: ComputingDefinitions,
  rackCount: number,
  dataCenterCount: number = getDataCenterCount(definitions, rackCount),
): number[] => {
  const normalizedRackCount = Math.max(0, Math.trunc(rackCount))
  const normalizedDataCenterCount = Math.max(
    getDataCenterCount(definitions, normalizedRackCount),
    Math.max(0, Math.trunc(dataCenterCount)),
  )

  return Array.from({ length: normalizedDataCenterCount }, (_, index) =>
    Math.min(
      definitions.rackCapacity,
      Math.max(0, normalizedRackCount - index * definitions.rackCapacity),
    ),
  )
}
