import { type SyncedProductionEntity } from '../game-state'

const depot = (
  entityId: number,
  prototypeId: string,
  gameRecipeId: string,
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running: true,
  recipeIds: [gameRecipeId],
  zones: [],
  nuclearReactor: null,
  dataCenterRacks: null,
  trainStation: null,
})

export const syncedMaintenanceDepotEntities: SyncedProductionEntity[] = [
  depot(1, 'MaintenanceDepotT1', 'MaintenanceT1Recycling'),
  depot(2, 'MaintenanceDepotT1', 'MaintenanceT1Recycling'),
  depot(3, 'MaintenanceDepotT2', 'MaintenanceT2Recycling'),
  depot(4, 'MaintenanceDepotT3', 'MaintenanceT3Recycling'),
  depot(5, 'MaintenanceDepotT3', 'MaintenanceT3Recycling'),
]
