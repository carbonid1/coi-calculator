import { type Module } from './modules/modules'
import { type ResourceId } from './resources'

type ModuleResourceLinkMode = 'surplus-only' | 'produce-to-demand'

/** Save-scoped connection between two synced game areas. */
export interface ModuleResourceLinkDefinition {
  id: string
  saveId: string
  sourceZoneId: number
  targetZoneId: number
  resourceId: ResourceId
  mode: ModuleResourceLinkMode
}

export interface ModuleResourceLink {
  id: string
  sourceModuleName: string
  sourceModuleId: string
  targetModuleName: string
  targetModuleId: string
  resourceId: ResourceId
  mode: ModuleResourceLinkMode
}

export interface ModuleResourceTransfer extends ModuleResourceLink {
  quantity: number
  requestedQuantity: number
}

/** Seeded through the same resource-link shape a future module-link UI edits. */
export const moduleResourceLinkDefinitions: readonly ModuleResourceLinkDefinition[] = [
  {
    id: 'copper-1-exhaust-to-exaust-1',
    saveId: 'Last-Stop Waters',
    sourceZoneId: 16,
    targetZoneId: 17,
    resourceId: 'exhaust',
    mode: 'surplus-only',
  },
  {
    id: 'copper-1-sea-water-to-exaust-1',
    saveId: 'Last-Stop Waters',
    sourceZoneId: 16,
    targetZoneId: 17,
    resourceId: 'seaWater',
    mode: 'produce-to-demand',
  },
  {
    id: 'copper-1-sea-water-to-steel-1',
    saveId: 'Last-Stop Waters',
    sourceZoneId: 16,
    targetZoneId: 21,
    resourceId: 'seaWater',
    mode: 'produce-to-demand',
  },
  {
    id: 'steel-1-exhaust-to-exaust-1',
    saveId: 'Last-Stop Waters',
    sourceZoneId: 21,
    targetZoneId: 17,
    resourceId: 'exhaust',
    mode: 'surplus-only',
  },
]

export const resolveModuleResourceLinks = (
  modules: readonly Module[],
  saveId: string | null | undefined,
  definitions: readonly ModuleResourceLinkDefinition[] = moduleResourceLinkDefinitions,
): ModuleResourceLink[] => {
  const modulesByZoneId = new Map(modules.flatMap(module => (
    module.liveArea ? [[module.liveArea.zoneId, module] as const] : []
  )))

  return definitions.flatMap(definition => {
    if (definition.saveId !== saveId) return []
    const source = modulesByZoneId.get(definition.sourceZoneId)
    const target = modulesByZoneId.get(definition.targetZoneId)

    if (!source || !target || source.id === target.id) return []

    return [{
      id: definition.id,
      sourceModuleName: source.name,
      sourceModuleId: source.id,
      targetModuleName: target.name,
      targetModuleId: target.id,
      resourceId: definition.resourceId,
      mode: definition.mode,
    }]
  })
}
