import { type Module } from "./modules";

export const RESEARCH_MODULE_ID = "research";
export const RESEARCH_LAB_EQUIPMENT_IV_DEMAND = 34.5;

export const research: Module = {
  id: RESEARCH_MODULE_ID,
  name: "Research",
  description: "Measured Lab Equipment IV demand; individual research labs will be added later",
  buildingTotals: {
    "assembly-v-lab-equipment-i": 1,
    "assembly-v-lab-equipment-ii": 1,
    "assembly-v-lab-equipment-iii": 1,
    "assembly-v-lab-equipment-iv": 2,
  },
  presets: [
    {
      id: "measured-demand",
      name: "Measured demand",
      description: "34.5 Lab Equipment IV per month, averaged across 100 in-game years",
      available: {},
      fixed: [],
      fixedDemands: {
        labEquipmentIv: RESEARCH_LAB_EQUIPMENT_IV_DEMAND,
      },
    },
  ],
  defaultPresetId: "measured-demand",
};
