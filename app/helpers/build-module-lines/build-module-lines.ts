import { type Module, type Preset } from "../../db/modules/modules";
import { recipes } from "../../db/recipes";
import { type ProductionLine } from "../calculate/calculate";

export const buildModuleLines = (mod: Module, preset: Preset | null): { lines: ProductionLine[]; pinnedIds: Set<string> } => {
  const totals = preset?.buildingTotals ?? mod.buildingTotals;
  const visibleRecipes = recipes.filter((r) => r.id in totals);

  const lines: ProductionLine[] = visibleRecipes.map((recipe) => {
    const total = totals[recipe.id] ?? 0;
    const active = preset && recipe.id in preset.active ? (preset.active[recipe.id] ?? total) : total;

    return { recipe, buildingCount: active, totalBuildings: total };
  });

  const pinnedIds = preset ? new Set(preset.pinned) : new Set<string>();

  return { lines, pinnedIds };
};
