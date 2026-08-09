import { baseConfig } from "../../db/config";
import { type Contract } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { type ResourceId } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { applyContracts, type ContractResult } from "../contracts/calculate-contracts";
import { type OutputModifierMultipliers } from "../modifiers/recipe-output";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
  contractResults: ContractResult[];
}

export const calculateFactoryTotal = (
  modules: Module[],
  contracts: Contract[] = [],
  recyclingEfficiencyPercent: number = baseConfig.recyclingEfficiencyPercent,
  outputModifiers: OutputModifierMultipliers = {},
): FactoryTotalResult => {
  const allLines: ProductionLine[] = [];
  const localResourceIds = new Set<ResourceId>();

  for (const mod of modules) {
    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines } = buildModuleLines(mod, preset, outputModifiers);

    allLines.push(...lines);
    for (const resourceId of mod.localResources ?? []) localResourceIds.add(resourceId);
  }

  const { allResourceFlows } = calculateNet(
    allLines,
    {},
    recyclingEfficiencyPercent,
    outputModifiers,
  );
  const flows = allResourceFlows.filter((flow) => !localResourceIds.has(flow.resourceId));

  const withContracts = applyContracts(flows, contracts);

  return { flows: withContracts.flows, allLines, contractResults: withContracts.contractResults };
};
