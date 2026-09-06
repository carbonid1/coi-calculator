import { type CurrentChickenFarmEntity } from "../../db/chicken-farm";
import {
  type CurrentCropFarmEntity,
  type FertilizerId,
} from "../../db/crop-farming";
import {
  type SyncedChickenFarmEntity,
  type SyncedCropFarmEntity,
} from "../../game-state";

const gameCropIds: Record<string, string> = {
  Crop_NoCrop: "none",
  Crop_GreenManure: "greenManure",
  Crop_Potato: "potato",
  Crop_Corn: "corn",
  Crop_Wheat: "wheat",
  Crop_TreeSapling: "treeSapling",
  Crop_Soybeans: "soybean",
  Crop_SugarCane: "sugarCane",
  Crop_Vegetables: "vegetables",
  Crop_Fruits: "fruit",
  Crop_Canola: "canola",
  Crop_Poppy: "poppy",
  Crop_Flowers: "flowers",
};

const gameFertilizerIds: Record<string, FertilizerId> = {
  Product_FertilizerOrganic: "organic",
  Product_Fertilizer: "fertilizerI",
  Product_Fertilizer2: "fertilizerII",
};

const getSyncedFertilizerId = (
  fertilizerProductId: string | null | undefined,
) => fertilizerProductId == null
  ? null
  : gameFertilizerIds[fertilizerProductId] ?? null;

export const getSyncedChickenFarmEntities = (
  entities: readonly SyncedChickenFarmEntity[],
): CurrentChickenFarmEntity[] => entities.map(entity => ({
  entityId: entity.entityId,
  running: entity.running,
  slaughtering: entity.slaughtering,
  chickens: entity.chickens,
  zones: entity.zones,
}));

// Farm.onNewDay skips unassigned slots; Crop_NoCrop is an actual timed crop.
const mapCropSchedule = (schedule: readonly (string | null)[]) => schedule.flatMap(cropId => (
  cropId === null ? [] : [gameCropIds[cropId] ?? cropId]
));

export const getSyncedCropFarmEntities = (
  entities: readonly SyncedCropFarmEntity[],
): CurrentCropFarmEntity[] => entities.map(entity => ({
  entityId: entity.entityId,
  tierId: entity.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse",
  schedule: mapCropSchedule(entity.schedule),
  fertilityTargetPercent: entity.fertilityTargetPercent,
  fertilizerId: getSyncedFertilizerId(
    entity.fertilizerProductId,
  ),
  running: entity.running,
  zones: entity.zones ?? [],
}));
