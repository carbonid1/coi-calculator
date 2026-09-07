import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Preset } from '../../db/modules/modules'
import { resourceSupplyRules } from '../../db/resource-supply'
import { type ResourceId } from '../../db/resources'

export interface ModuleResourceBoundaryRule {
  access: 'factory' | 'connections'
  sourceModuleIds: string[]
  targetModuleIds: string[]
  requestedImport: number
  requestedExport: number
}

export interface ModuleResourceBoundary {
  moduleId: string
  resourceId: ResourceId
  rule: ModuleResourceBoundaryRule
  /** Demand on the factory, not a claim that supply was delivered. */
  factoryDemand: number
  /** Production available to the factory after dedicated transfers. */
  factorySupply: number
}

/** Resolve the exchange contract separately from the module's calculation scope. */
export const resolveModuleResourceBoundary = (
  moduleId: string,
  resourceId: ResourceId,
  links: readonly ModuleResourceLink[],
  preset: Preset | null,
): ModuleResourceBoundaryRule => {
  const matching = links.filter(link => link.resourceId === resourceId)
  const sourceModuleIds = matching
    .filter(link => link.targetModuleId === moduleId)
    .map(link => link.sourceModuleId)
  const targetModuleIds = matching
    .filter(link => link.sourceModuleId === moduleId)
    .map(link => link.targetModuleId)
  const dedicated = sourceModuleIds.length > 0 || targetModuleIds.length > 0

  return {
    access: dedicated ? 'connections' : resourceSupplyRules[resourceId] ?? 'factory',
    sourceModuleIds: [...new Set(sourceModuleIds)],
    targetModuleIds: [...new Set(targetModuleIds)],
    requestedImport: resourceSupplyRules[resourceId] === 'connections'
      ? 0 : Math.max(0, preset?.requestedImports?.[resourceId] ?? 0),
    requestedExport: resourceSupplyRules[resourceId] === 'connections'
      ? 0 : Math.max(0, preset?.requestedExports?.[resourceId] ?? 0),
  }
}

export const calculateModuleResourceBoundary = (
  rule: ModuleResourceBoundaryRule,
  flow: {
    produced: number
    consumed: number
    fixedDemand: number
    received: number
    sent: number
    demandTriggeredSent: number
  },
): Pick<ModuleResourceBoundary, 'factoryDemand' | 'factorySupply'> => {
  if (rule.requestedImport > 0.000001) {
    return { factoryDemand: rule.requestedImport, factorySupply: 0 }
  }

  const available = flow.produced + flow.received - flow.consumed - flow.fixedDemand

  if (rule.access === 'connections') {
    // A requested export opens an existing dedicated route to the factory.
    // Unconnected local resources retain their local balance.
    const connected = rule.sourceModuleIds.length > 0 || rule.targetModuleIds.length > 0

    return {
      factoryDemand: 0,
      factorySupply: connected
        ? Math.min(rule.requestedExport, Math.max(0, available - flow.demandTriggeredSent))
        : 0,
    }
  }

  const net = available - flow.sent

  return { factoryDemand: Math.max(0, -net), factorySupply: Math.max(0, net) }
}
