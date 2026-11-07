import { type ResourceId, resources } from '../../db/resources'
import { type PoolResult } from '../capacity-pools/capacity-pools'

export interface RecipePriorityNote {
  label: string
  detail?: string
}

const isFixed = (line: PoolResult) => 'operatingMode' in line && line.operatingMode === 'fixed'
const hasOutputTarget = (line: PoolResult) => 'hasOutputTarget' in line && line.hasOutputTarget === true
const isPrimary = (line: PoolResult) => !isFixed(line) && line.recipe.group !== 'source'
  && line.recipe.group !== 'sink' && line.recipe.allocation !== 'fallback' && line.recipe.allocation !== 'surplus'

/** These are configured preferences, not a fabricated total order of the settled allocation.
 * A recipe can participate in both demand production and a later surplus pass. */
export const getRecipePriorityNotes = (
  line: PoolResult,
  peers: readonly PoolResult[],
  resourceId: ResourceId,
  side: 'inputs' | 'outputs',
  localFirst = false,
): RecipePriorityNote[] => {
  if (line.activeBuildings === 0) return [{ label: 'Paused' }]
  if (isFixed(line)) return [{ label: 'Fixed production' }]
  if (hasOutputTarget(line)) return [{ label: 'Output target',
    detail: 'Inputs are reserved for the configured output target before demand-driven and fallback production.' }]

  // Targeted recipes are allocated separately; they neither follow nor rank
  // alongside the ordinary demand and surplus preferences below.
  peers = peers.filter(peer => !hasOutputTarget(peer))

  const { recipe } = line
  const notes: RecipePriorityNote[] = []
  const comparison = `recipes ${side === 'inputs' ? 'using' : 'producing'} ${resources[resourceId].name}`
  const addRank = (label: string, candidates: readonly PoolResult[], value: (candidate: PoolResult) => number) => {
    if (!candidates.includes(line)) return false
    const priorities = [...new Set(candidates.filter(candidate => candidate.activeBuildings > 0).map(value))].toSorted((a, b) => a - b)

    if (priorities.length < 2 || !priorities.includes(value(line))) return false
    notes.push({ label: `${label} ${priorities.indexOf(value(line)) + 1}`,
      detail: `Configured preference among ${comparison} in this supply scope. Lower numbers are preferred; equal preferences share a number. Demand and available inputs still limit production.` })
    return true
  }

  if (recipe.group === 'sink') {
    notes.push({ label: recipe.outputs.some(output => output.quantity > 0) ? 'Recovery' : 'Disposal' })
    addRank('Excess input priority', peers.filter(peer => peer.recipe.group === 'sink'), peer => peer.recipe.sinkPriority ?? 0)
  } else if (recipe.group === 'source') {
    notes.push({ label: recipe.sourceAllocation === 'primary' ? 'Primary supply' : 'Fallback supply' })
  } else if (recipe.allocation === 'fallback' || recipe.allocation === 'surplus') {
    notes.push({ label: recipe.allocation === 'fallback' ? 'After primary production' : 'After fallback production' })
    addRank('Priority', peers.filter(peer => !isFixed(peer) && peer.recipe.allocation === recipe.allocation), peer => peer.recipe.allocationPriority ?? 0)
  } else if (recipe.balanceBy === 'output') {
    const drivesDemand = (candidate: PoolResult) => side === 'inputs'
      || (candidate.recipe.balanceOutputIds ?? candidate.recipe.outputs.map(output => output.resourceId)).includes(resourceId)

    if (!drivesDemand(line)) {
      notes.push({ label: `Follows ${recipe.balanceOutputIds?.map(id => resources[id].name).join(', ')} demand` })
    } else if (!addRank('Demand priority', peers.filter(peer => isPrimary(peer) && peer.recipe.balanceBy === 'output' && drivesDemand(peer)), peer => peer.recipe.demandPriority ?? 0)) {
      notes.push({ label: 'Follows demand' })
    }
  } else {
    notes.push({ label: 'Uses available input' })
  }

  if (localFirst) notes.push({ label: 'Local supply first' })
  // Missing input priorities do not imply last place: factory dispatch reserves
  // ordinary production separately. Compare only explicitly prioritized routes.
  if (side === 'inputs' && recipe.inputPriorities?.[resourceId] != null) {
    addRank('Input priority', peers.filter(peer => isPrimary(peer) && peer.recipe.inputPriorities?.[resourceId] != null), peer => peer.recipe.inputPriorities?.[resourceId] ?? 0)
  }
  if (line.capacityPoolId && recipe.sharedCapacity) {
    const pool = peers.filter(peer => !isFixed(peer) && peer.activeBuildings > 0 && peer.capacityPoolId === line.capacityPoolId
      && peer.recipe.allocation === recipe.allocation && peer.recipe.balanceBy === recipe.balanceBy)
    const priorities = [...new Set(pool.map(peer => peer.recipe.sharedCapacity?.priority ?? 0))].toSorted((a, b) => a - b)

    if (priorities.length > 1) notes.push({ label: `Shared machine priority ${priorities.indexOf(recipe.sharedCapacity.priority) + 1}`,
      detail: 'Preference between these recipes on the same machines, within the same production stage.' })
  }
  if (recipe.consumeSurplusInputIds?.length && (side === 'outputs' || recipe.consumeSurplusInputIds.includes(resourceId))) {
    const label = (() => {
      if (recipe.surplusConsumptionPhase === 'before-fallback') return 'Extra before fallbacks'
      if (recipe.surplusConsumptionPhase === 'before-disposal') return 'Extra after fallbacks'
      return 'Extra after surplus production'
    })()
    const outputCondition = recipe.consumeSurplusOutputIds?.length
      ? ` Extra ${recipe.consumeSurplusOutputIds.map(id => resources[id].name).join(', ')} must have downstream use.` : ''

    notes.push({ label, detail: `Additional production from remaining ${recipe.consumeSurplusInputIds.map(id => resources[id].name).join(', ')}.${outputCondition}` })
    addRank('Extra priority', peers.filter(peer => !isFixed(peer) && peer.recipe.consumeSurplusInputIds?.length
      && peer.recipe.surplusConsumptionPhase === recipe.surplusConsumptionPhase
      && peer.recipe.consumeSurplusInputIds.some(id => recipe.consumeSurplusInputIds?.includes(id))), peer => peer.recipe.surplusConsumptionPriority ?? 0)
  }
  return notes
}
