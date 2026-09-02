import { type ProductionLine } from '../calculate/calculate'

export interface StationActivityCounts {
  active: number
  ghosts: number
  paused: number
  planned: number
}

export const calculateStationActivityCounts = (
  lines: readonly ProductionLine[],
): StationActivityCounts => lines.reduce<StationActivityCounts>((counts, line) => {
  const ghosts = line.constructionGhosts ?? 0
  const planned = line.unplacedPlannedBuildings ?? 0
  const active = line.currentActiveBuildings ?? Math.max(
    0,
    Math.min(line.builtBuildings, line.activeBuildings - ghosts - planned),
  )

  return {
    active: counts.active + active,
    ghosts: counts.ghosts + ghosts,
    paused: counts.paused + Math.max(0, line.builtBuildings - active),
    planned: counts.planned + planned,
  }
}, {
  active: 0,
  ghosts: 0,
  paused: 0,
  planned: 0,
})
