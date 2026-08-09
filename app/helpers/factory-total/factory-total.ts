import { type Module } from "../../db/modules/modules";
import { type ResourceId, resources } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
}

export const calculateFactoryTotal = (modules: Module[]): FactoryTotalResult => {
  const combined = new Map<ResourceId, { consumed: number; produced: number }>();
  const allLines: ProductionLine[] = [];

  for (const mod of modules) {
    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines, pinnedIds } = buildModuleLines(mod, preset);

    allLines.push(...lines);
    const { resourceFlows } = calculateNet(lines, pinnedIds);

    for (const flow of resourceFlows) {
      const existing = combined.get(flow.resourceId) ?? { consumed: 0, produced: 0 };

      existing.consumed += flow.consumed;
      existing.produced += flow.produced;
      combined.set(flow.resourceId, existing);
    }
  }

  const flows: ResourceFlow[] = [];

  for (const [resourceId, { consumed, produced }] of combined) {
    const net = produced - consumed;

    if (Math.abs(net) > 0.001) {
      flows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net });
    }
  }

  return { flows, allLines };
};
