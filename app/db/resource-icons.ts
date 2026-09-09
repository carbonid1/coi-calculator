import manifest from './resource-icons.json'
import { type ResourceId } from './resources'

export interface ResourceIconDefinition {
  bundle: string
  asset: string
}

/** Explicit mapping to installed game UI assets. Null entries use the resource name. */
export const resourceIcons: Record<ResourceId, ResourceIconDefinition | null> = manifest
