import { type Module } from "./modules";

export const general: Module = {
  id: "general",
  name: "General",
  description: "Shared production capacity for yellowcake and future processing chains",
  buildingTotals: {
    "crusher-large": 3,
    "settling-tank": 2,
  },
  presets: [
    {
      id: "yellowcake",
      name: "Yellowcake",
      description: "1 of 3 large crushers active + 2 settling tanks — 72 UO in, 12 YC + 72 toxic slurry out",
      buildingTotals: {
        "crusher-large": 3,
        "settling-tank": 2,
      },
      active: {
        "crusher-large": 1,
        "settling-tank": 2,
      },
      pinned: ["crusher-large", "settling-tank"],
    },
  ],
  defaultPresetId: "yellowcake",
};
