import { type Module } from "./modules";

export const RESERVES_MODULE_ID = "reserves";
export const GOLD_RESERVE_RECIPE_ID = "gold-virtual-provision";

export const selectedReserveResources = [
  {
    id: "gold",
    name: "Gold",
    recipeId: GOLD_RESERVE_RECIPE_ID,
  },
] as const;

export interface ReserveBalances {
  gold: number;
}

export const createReservesModule = (balances: ReserveBalances | null): Module => {
  const hasGold = (balances?.gold ?? 0) > 0;

  return {
    id: RESERVES_MODULE_ID,
    name: "Reserves",
    description: "Actual contents of selected standalone storage, excluding train-linked storage and storage with an assigned incoming truck route",
    builtBuildings: { [GOLD_RESERVE_RECIPE_ID]: 1 },
    presets: [
      {
        id: "synced-reserves",
        name: "Synced reserves",
        description: "Use eligible stored Gold only while the synced balance is positive.",
        activeBuildings: { [GOLD_RESERVE_RECIPE_ID]: hasGold ? 1 : 0 },
        fixed: [],
      },
    ],
    defaultPresetId: "synced-reserves",
  };
};

export const reserves = createReservesModule(null);
