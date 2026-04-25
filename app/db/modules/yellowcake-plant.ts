import { type Module } from "./modules";

export const yellowcakePlant: Module = {
  id: "yellowcake-plant",
  name: "Yellowcake Plant",
  description: "Uranium Ore → Yellowcake — minimum build sized for 1 FBR YC demand",
  buildingTotals: {
    "crusher": 3,
    "settling-tank": 1,
  },
  presets: [
    {
      id: "supply-1fbr",
      name: "Supply 1 FBR ×2",
      description: "6 YC/60s (36 UO), 36 toxic slurry out — nets yellowcake to zero against 1 FBR ×2 — YC, no breed",
      buildingTotals: {
        "crusher": 3,
        "settling-tank": 1,
      },
      active: {
        "crusher": 3,
        "settling-tank": 1,
      },
      pinned: ["crusher", "settling-tank"],
      externalInputs: { uraniumOre: 36, acid: 12 },
    },
  ],
  defaultPresetId: "supply-1fbr",
};
