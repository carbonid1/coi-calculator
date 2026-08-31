import { type Module } from './modules/modules'
import { type ResourceId } from './resources'

type ModuleResourceLinkMode = 'surplus-only' | 'produce-to-demand'

/**
 * User-shaped connection between two module resource ports. Module names are
 * stable, visible identities for synced game areas; the resolver binds them to
 * the current snapshot's runtime module IDs.
 */
export interface ModuleResourceLinkDefinition {
  id: string
  sourceModuleName: string
  targetModuleName: string
  resourceId: ResourceId
  mode: ModuleResourceLinkMode
}

export interface ModuleResourceLink extends ModuleResourceLinkDefinition {
  sourceModuleId: string
  targetModuleId: string
}

export interface ModuleResourceTransfer extends ModuleResourceLink {
  quantity: number
  requestedQuantity: number
}

/** Seeded through the same resource-link shape a future module-link UI edits. */
export const moduleResourceLinkDefinitions: readonly ModuleResourceLinkDefinition[] = [
  {
    id: 'copper-1-exhaust-to-exaust-1',
    sourceModuleName: 'Copper #1',
    targetModuleName: 'Exaust #1',
    resourceId: 'exhaust',
    mode: 'surplus-only',
  },
  {
    id: 'copper-1-sea-water-to-exaust-1',
    sourceModuleName: 'Copper #1',
    targetModuleName: 'Exaust #1',
    resourceId: 'seaWater',
    mode: 'produce-to-demand',
  },
  {
    id: 'copper-1-sea-water-to-steel-1',
    sourceModuleName: 'Copper #1',
    targetModuleName: 'Steel #1',
    resourceId: 'seaWater',
    mode: 'produce-to-demand',
  },
  {
    id: 'steel-1-exhaust-to-exaust-1',
    sourceModuleName: 'Steel #1',
    targetModuleName: 'Exaust #1',
    resourceId: 'exhaust',
    mode: 'surplus-only',
  },
]

export const resolveModuleResourceLinks = (
  modules: readonly Module[],
  definitions: readonly ModuleResourceLinkDefinition[] = moduleResourceLinkDefinitions,
): ModuleResourceLink[] => {
  const modulesByName = new Map(modules.map(module => [module.name, module]))

  return definitions.flatMap(definition => {
    const source = modulesByName.get(definition.sourceModuleName)
    const target = modulesByName.get(definition.targetModuleName)

    if (!source || !target || source.id === target.id) return []

    return [{
      ...definition,
      sourceModuleId: source.id,
      targetModuleId: target.id,
    }]
  })
}
