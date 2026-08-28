import { type SharedMachineClaim } from "../helpers/machine-allocation/machine-allocation";
import {
  DEFAULT_GROUNDWATER_RECIPE_ID,
  DEFAULT_MODULE_ID,
} from "./modules/default";
import { GREENHOUSES_MODULE_ID } from "./modules/farms";

export const GREENHOUSES_GROUNDWATER_CLAIM_ID = "greenhouses-groundwater";
/** Stable claim ID retained so existing one-time area mappings remain valid. */
export const DEFAULT_GROUNDWATER_CLAIM_ID = "general-groundwater";

export const groundwaterPumpClaims = [
  {
    id: GREENHOUSES_GROUNDWATER_CLAIM_ID,
    moduleId: GREENHOUSES_MODULE_ID,
    moduleName: "Greenhouses",
    recipeId: "groundwater-pump",
    machineName: "Groundwater Pump",
    kind: "groundwater-pump",
    target: 5,
  },
  {
    id: DEFAULT_GROUNDWATER_CLAIM_ID,
    moduleId: DEFAULT_MODULE_ID,
    moduleName: "Default",
    recipeId: DEFAULT_GROUNDWATER_RECIPE_ID,
    machineName: "Groundwater Pump",
    kind: "groundwater-pump",
    target: 1,
  },
] as const satisfies readonly SharedMachineClaim[];
