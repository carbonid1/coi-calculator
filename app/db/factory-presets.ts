import { type LiveAreaPlans } from './live-area-plans'

// Compilation details of the complete factory preset, never individual UI switches.
const scienceExpansionLayers = [
  'science', 'settlement', 'power-water', 'computing', 'farms', 'refining', 'construction', 'operating',
] as const

export type PlanLayerId = typeof scienceExpansionLayers[number]

export const factoryPresets = [
  { id: 'current', name: 'Current setup', layers: [] },
  { id: 'science-expansion', name: 'Science expansion', layers: scienceExpansionLayers },
] as const
export type FactoryPresetId = typeof factoryPresets[number]['id']
export const getFactoryPreset = (id: string | null | undefined) => (
  factoryPresets.find(preset => preset.id === id) ?? factoryPresets[0]
)
export const getFactoryPresetStorageKey = (saveId: string | null | undefined) => (
  saveId ? `coi-factory-preset-v1:${encodeURIComponent(saveId)}` : null
)

/** Area topology describes the factory; operating targets belong to its preset. */
export const resolvePlanAreaTargets = (plans: LiveAreaPlans, selected: ReadonlySet<PlanLayerId>): LiveAreaPlans => (
  Object.fromEntries(Object.entries(plans).map(([zoneId, plan]) => [zoneId, {
    resourcePool: plan.resourcePool,
    ...(selected.has('farms') ? { cropFarms: plan.cropFarms } : {}),
    ...(selected.has('computing') ? { computing: plan.computing, offices: plan.offices } : {}),
    ...(selected.has('operating') ? {
      resourceProcessingPriorities: plan.resourceProcessingPriorities,
      requestedImports: plan.requestedImports,
      requestedExports: plan.requestedExports,
    } : {}),
  }]))
)
