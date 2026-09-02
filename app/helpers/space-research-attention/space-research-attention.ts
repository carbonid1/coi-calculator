import { type ResearchMode } from '../../db/config'
import { type Module } from '../../db/modules/modules'
import {
  getMinimumSpaceStationLevelForResearchPoints,
  type SpaceStationLevelData,
} from '../../db/space-station'
import { type BuildingDiagnostic } from '../building-diagnostics/building-diagnostics'

const SPACE_RESEARCH_POINTS_PER_LAB = 48

export const createSpaceResearchAttention = ({
  fallbackTarget,
  mode,
  runningResearchLabs,
  station,
  stationModule,
}: {
  fallbackTarget?: {
    module: Module
    navigationKey: string
  }
  mode: ResearchMode
  runningResearchLabs: number
  station: SpaceStationLevelData
  stationModule: Module | undefined
}): BuildingDiagnostic | null => {
  const targetModule = stationModule ?? fallbackTarget?.module

  if (mode !== 'with-space' || runningResearchLabs <= 0 || !targetModule) return null
  if (stationModule?.presets.some(preset => (
    preset.planMismatches?.some(mismatch => (
      mismatch.recipeId === 'space-station-operations'
    ))
  ))) return null

  const requiredPoints = runningResearchLabs * SPACE_RESEARCH_POINTS_PER_LAB

  if (station.spaceResearchPointsPerCycle >= requiredPoints) return null

  const targetLevel = getMinimumSpaceStationLevelForResearchPoints(requiredPoints)

  if (station.level >= targetLevel) return null

  return {
    key: stationModule
      ? `${stationModule.id}:space-station-operations`
      : `${targetModule.id}:space-station-infrastructure`,
    navigationKey: stationModule ? undefined : fallbackTarget?.navigationKey,
    moduleId: targetModule.id,
    moduleName: targetModule.name,
    buildingName: 'Space Station',
    recipeName: 'Space Research',
    plannedCapacity: false,
    load: requiredPoints,
    active: station.spaceResearchPointsPerCycle,
    built: station.spaceResearchPointsPerCycle,
    attention: station.level > 0 ? 'upgrade' : 'build',
    attentionCount: 1,
    level: {
      current: station.level,
      target: targetLevel,
    },
    affectedResources: ['Space Research Points'],
  }
}
