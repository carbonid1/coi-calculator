import { type SharedMachineClaim } from "../helpers/machine-allocation/machine-allocation";
import {
  getCropFarmGroundwaterClaimId,
  getCropFarmGroundwaterRecipeId,
} from "./modules/crop-farm-areas";
import {
  DEFAULT_GROUNDWATER_RECIPE_ID,
  DEFAULT_MODULE_ID,
} from "./modules/default";

/** Stable claim ID retained so existing one-time area mappings remain valid. */
export const DEFAULT_GROUNDWATER_CLAIM_ID = "general-groundwater";

const defaultGroundwaterPumpClaim = {
  id: DEFAULT_GROUNDWATER_CLAIM_ID,
  zoneId: -1,
  moduleId: DEFAULT_MODULE_ID,
  moduleName: "Default",
  recipeId: DEFAULT_GROUNDWATER_RECIPE_ID,
  machineName: "Groundwater Pump",
  kind: "groundwater-pump",
  target: 1,
} as const satisfies SharedMachineClaim;

export const createGroundwaterPumpClaims = (
  cropFarmZones: readonly { id: number; name: string | null }[],
): SharedMachineClaim[] => [
  ...cropFarmZones.flatMap(zone => zone.name ? [{
    id: getCropFarmGroundwaterClaimId(zone.id),
    zoneId: zone.id,
    moduleId: `live-area-${zone.id}`,
    moduleName: zone.name,
    recipeId: getCropFarmGroundwaterRecipeId(zone.id),
    machineName: "Groundwater Pump",
    kind: "groundwater-pump" as const,
    target: 0,
  }] : []),
  {
    ...defaultGroundwaterPumpClaim,
  },
];
