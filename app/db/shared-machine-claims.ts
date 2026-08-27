import { type SharedMachineClaim } from "../helpers/machine-allocation/machine-allocation";
import { GREENHOUSES_MODULE_ID } from "./modules/farms";
import {
  GENERAL_GROUNDWATER_RECIPE_ID,
  GENERAL_MODULE_ID,
} from "./modules/general";

export const GREENHOUSES_GROUNDWATER_CLAIM_ID = "greenhouses-groundwater";
export const GENERAL_GROUNDWATER_CLAIM_ID = "general-groundwater";

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
    id: GENERAL_GROUNDWATER_CLAIM_ID,
    moduleId: GENERAL_MODULE_ID,
    moduleName: "General",
    recipeId: GENERAL_GROUNDWATER_RECIPE_ID,
    machineName: "Groundwater Pump",
    kind: "groundwater-pump",
    target: 1,
  },
] as const satisfies readonly SharedMachineClaim[];
