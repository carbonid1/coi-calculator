import { type ProductionLine } from '../calculate/calculate'

export interface ProductionCardGroup {
  key: string
  targetKey: string
  lines: ProductionLine[]
}

export const groupProductionCardLines = (lines: ProductionLine[]): ProductionCardGroup[] => {
  const groups: ProductionCardGroup[] = []
  const groupedLines = new Map<string, ProductionLine[]>()

  for (const line of lines) {
    const displayGroupId = line.recipe.displayGroup
      ? `${line.moduleId}:display:${line.recipe.displayGroup.id}`
      : undefined
    const groupId = line.capacityPoolId ?? displayGroupId
    const targetKey = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`

    if (!groupId) {
      groups.push({ key: line.recipe.id, targetKey, lines: [line] })
      continue
    }

    const existing = groupedLines.get(groupId)

    if (existing) {
      existing.push(line)
      continue
    }

    const sharedLines = [line]

    groupedLines.set(groupId, sharedLines)
    groups.push({ key: groupId, targetKey, lines: sharedLines })
  }

  return groups.toSorted(
    (a, b) =>
      (a.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0) -
      (b.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0),
  )
}

export const calculateProductionCardLoad = (
  lines: ProductionLine[],
  results: ({ supplyRatio: number } | undefined)[],
) => {
  const loads = lines.map(
    (line, index) => line.activeBuildings * (results[index]?.supplyRatio ?? 0),
  )

  if (loads.length === 0) return 0

  return lines[0]?.recipe.displayGroup
    ? Math.max(...loads)
    : loads.reduce((total, load) => total + load, 0)
}
