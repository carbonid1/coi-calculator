import { type Module } from "./modules";

export const yellowcakePlant: Module = {
  id: "yellowcake-plant",
  name: "Yellowcake Plant",
  description: "Uranium Ore → Yellowcake — minimum build sized for 1 FBR YC demand",
  buildingTotals: {
    "crusher": 2,
    "settling-tank": 1,
  },
  presets: [
    {
      id: "supply-1fbr",
      name: "Supply 1 FBR",
      description: "3 YC/60s (18 UO), 18 toxic slurry out — nets yellowcake to zero against 1 FBR — YC, no breed",
      buildingTotals: {
        "crusher": 2,
        "settling-tank": 1,
      },
      active: {
        "crusher": 1.5,
        "settling-tank": 0.5,
      },
      pinned: ["crusher", "settling-tank"],
      externalInputs: { uraniumOre: 18, acid: 6 },
    },
  ],
  defaultPresetId: "supply-1fbr",
};
