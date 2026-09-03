import {
  mapReserveResources,
  type ReserveBalances,
  reserveResourceCatalog,
} from "../reserve-resources";
import { type Module } from "./modules";

export const RESERVES_MODULE_ID = "reserves";

export const createReservesModule = (balances: ReserveBalances | null): Module => {
  const activeByReserveKey = mapReserveResources(
    ({ key }) => (balances?.[key] ?? 0) > 0 ? 1 : 0,
  );
  const builtBuildings = Object.fromEntries(
    reserveResourceCatalog.map(({ recipeId }) => [recipeId, 1]),
  );
  const activeBuildings = Object.fromEntries(
    reserveResourceCatalog.map(({ key, recipeId }) => [
      recipeId,
      activeByReserveKey[key],
    ]),
  );

  return {
    id: RESERVES_MODULE_ID,
    name: "Reserves",
    description: "Actual contents of selected standalone storage, excluding train-linked storage and storage with an assigned incoming truck route",
    builtBuildings,
    presets: [
      {
        id: "synced-reserves",
        name: "Synced reserves",
        description: "Use eligible stored resources only while each synced balance is positive.",
        activeBuildings,
        fixed: [],
      },
    ],
    defaultPresetId: "synced-reserves",
  };
};
