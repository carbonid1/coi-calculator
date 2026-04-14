import { type Module } from "../../db/modules/modules";
import { type ResourceId, resources } from "../../db/resources";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { buildModuleLines } from "../build-module-lines/build-module-lines";

export type FactoryTotalResult = {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
};

export const calculateFactoryTotal = (
  modules: Module[],
  presetSelections: Record<string, string | null>,
): FactoryTotalResult => {
  const combined = new Map<ResourceId, { consumed: number; produced: number }>();
  const allLines: ProductionLine[] = [];

  for (const mod of modules) {
    const presetId = presetSelections[mod.id] ?? mod.defaultPresetId;
    const preset = presetId
      ? mod.presets.find((p) => p.id === presetId) ?? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? null
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
