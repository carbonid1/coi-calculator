import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export type UnityCapacityResult = ReturnType<typeof getResearchBonus>
export const calculateUnityCapacity = (
  definitions: PlanningDefinitions,
  level: number,
): UnityCapacityResult => getResearchBonus(definitions, 'unityCapacity', level)
