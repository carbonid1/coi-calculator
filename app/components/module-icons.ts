import {
  Archive,
  Boxes,
  Cloud,
  FlaskConical,
  MapPinned,
  Pickaxe,
  Sprout,
  TreePine,
  type LucideIcon,
} from "lucide-react";

import { type Module } from "../db/modules/modules";

export const defaultModuleIcon = Boxes;
export const syncedModuleIcon = MapPinned;

export const moduleIcons: Partial<Record<string, LucideIcon>> = {
  general: defaultModuleIcon,
  forestry: TreePine,
  "process-steam": Cloud,
  research: FlaskConical,
  greenhouses: Sprout,
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
