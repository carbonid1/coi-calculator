import { type Module } from "./modules";

export const HOUSING_MODULE_ID = "housing";

export const housing: Module = {
  id: HOUSING_MODULE_ID,
  name: "Housing",
  description: "Installed residential capacity",
  buildingTotals: {},
  presets: [],
  defaultPresetId: null,
};
