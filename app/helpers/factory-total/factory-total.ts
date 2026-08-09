import { type Contract } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { type ResourceId, resources } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { applyContracts, type ContractResult } from "../contracts/calculate-contracts";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
  contractResults: ContractResult[];
}

export const calculateFactoryTotal = (modules: Module[], contracts: Contract[] = []): FactoryTotalResult => {
  const combined = new Map<ResourceId, { consumed: number; produced: number }>();
  const allLines: ProductionLine[] = [];

  for (const mod of modules) {
    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines, pinnedIds } = buildModuleLines(mod, preset);

    allLines.push(...lines);
    const { allResourceFlows } = calculateNet(lines, pinnedIds);

    for (const flow of allResourceFlows) {
      const existing = combined.get(flow.resourceId) ?? { consumed: 0, produced: 0 };

      existing.consumed += flow.consumed;
      existing.produced += flow.produced;
      combined.set(flow.resourceId, existing);
    }
  }

  const flows: ResourceFlow[] = [];

  for (const [resourceId, { consumed, produced }] of combined) {
    const net = produced - consumed;

    flows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net });
  }

  const withContracts = applyContracts(flows, contracts);

  return { flows: withContracts.flows, allLines, contractResults: withContracts.contractResults };
};
