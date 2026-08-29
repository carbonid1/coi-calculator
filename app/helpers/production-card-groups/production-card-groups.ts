import { type ProductionLine } from '../calculate/calculate'

export interface ProductionCardGroup {
  key: string
  targetKey: string
  lines: ProductionLine[]
}

const hasSharedResource = (left: ReadonlySet<string>, right: ReadonlySet<string>) => {
  for (const resourceId of left) {
    if (right.has(resourceId)) return true
  }

  return false
}

/**
 * Keeps independent cards stable while placing internal producers before the
 * cards that consume their output. CSS grid then reads left-to-right and
 * top-to-bottom in production-flow order.
 */
const sortByDependencies = (groups: ProductionCardGroup[]) => {
  const baseline = groups
    .map((group, index) => ({ group, index }))
    .toSorted((left, right) => (
      (left.group.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0) -
      (right.group.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0) ||
      left.index - right.index
    ))
    .map(({ group }) => group)
  const inputs = baseline.map(group => new Set(
    group.lines.flatMap(line => line.recipe.inputs.map(input => input.resourceId)),
  ))
  const outputs = baseline.map(group => new Set(
    group.lines.flatMap(line => line.recipe.outputs.map(output => output.resourceId)),
  ))
  const dependents = baseline.map(() => new Set<number>())
  const indegrees = baseline.map(() => 0)

  for (let producerIndex = 0; producerIndex < baseline.length; producerIndex += 1) {
    for (let consumerIndex = 0; consumerIndex < baseline.length; consumerIndex += 1) {
      if (
        producerIndex === consumerIndex ||
        !hasSharedResource(outputs[producerIndex] ?? new Set(), inputs[consumerIndex] ?? new Set())
      ) continue

      dependents[producerIndex]?.add(consumerIndex)
      indegrees[consumerIndex] = (indegrees[consumerIndex] ?? 0) + 1
    }
  }

  const remaining = new Set(baseline.map((_, index) => index))
  const sorted: ProductionCardGroup[] = []

  while (remaining.size > 0) {
    const next = [...remaining].find(index => indegrees[index] === 0)
      // Keep every card visible if a production loop forms a cycle.
      ?? remaining.values().next().value

    if (next === undefined) break

    const nextGroup = baseline[next]

    if (!nextGroup) break

    remaining.delete(next)
    sorted.push(nextGroup)

    for (const dependent of dependents[next] ?? []) {
      indegrees[dependent] = Math.max(0, (indegrees[dependent] ?? 0) - 1)
    }
  }

  return sorted
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

  return sortByDependencies(groups)
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
