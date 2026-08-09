import { buildings } from "../../db/buildings";
import { type ProductionLine } from "../calculate/calculate";

interface BuildingStats {
  workers: number;
  electricityKw: number;
}

export const calculateBuildingStats = (lines: ProductionLine[]): BuildingStats => {
  const standaloneLines: ProductionLine[] = [];
  const pooledLines = new Map<string, ProductionLine>();

  for (const line of lines) {
    if (!line.capacityPoolId) {
      standaloneLines.push(line);
      continue;
    }

    const current = pooledLines.get(line.capacityPoolId);

    if (!current || line.buildingCount > current.buildingCount) {
      pooledLines.set(line.capacityPoolId, line);
    }
  }

  return [...standaloneLines, ...pooledLines.values()].reduce<BuildingStats>((total, line) => {
    const building = buildings[line.recipe.building];

    if (!building || line.buildingCount <= 0) return total;

    return {
      workers: total.workers + building.workers * Math.ceil(line.buildingCount),
      electricityKw: total.electricityKw + building.electricityKw * line.buildingCount,
    };
  }, { workers: 0, electricityKw: 0 });
};
