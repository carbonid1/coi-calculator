import {
  Archive,
  Boxes,
  MapPinned,
  Pickaxe,
  type LucideIcon,
} from "lucide-react";

import { type Module } from "../db/modules/modules";

const defaultModuleIcon = Boxes;

export const syncedModuleIcon = MapPinned;

const moduleIcons: Partial<Record<string, LucideIcon>> = {
  mines: Pickaxe,
  reserves: Archive,
};

export const getModuleIcon = (
  module: Pick<Module, "gameSynced" | "id">,
): LucideIcon => (
  module.gameSynced
    ? syncedModuleIcon
    : (moduleIcons[module.id] ?? defaultModuleIcon)
);
