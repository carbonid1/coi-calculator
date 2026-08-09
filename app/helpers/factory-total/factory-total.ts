import { baseConfig } from "../../db/config";
import { type Contract } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { type ResourceId } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { applyContracts, type ContractResult } from "../contracts/calculate-contracts";
import { type OutputModifierMultipliers } from "../modifiers/recipe-output";
import { typedEntries } from "../typed-entries/typed-entries";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
  contractResults: ContractResult[];
  calculation: ReturnType<typeof calculateNet>;
}

export const calculateFactoryTotal = (
  modules: Module[],
  contracts: Contract[] = [],
  recyclingEfficiencyPercent: number = baseConfig.recyclingEfficiencyPercent,
  outputModifiers: OutputModifierMultipliers = {},
): FactoryTotalResult => {
  const allLines: ProductionLine[] = [];
  const localResourceIds = new Set<ResourceId>();
  const externalInputs: Partial<Record<ResourceId, number>> = {};

  for (const mod of modules) {
    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines } = buildModuleLines(mod, preset, outputModifiers);

    allLines.push(...lines);
    for (const resourceId of mod.localResources ?? []) localResourceIds.add(resourceId);
    for (const [resourceId, quantity] of typedEntries(preset?.externalInputs ?? mod.externalInputs ?? {})) {
      externalInputs[resourceId] = (externalInputs[resourceId] ?? 0) + quantity;
    }
  }

  const calculation = calculateNet(
    allLines,
    externalInputs,
    recyclingEfficiencyPercent,
    outputModifiers,
  );
  const { allResourceFlows } = calculation;
  const flows = allResourceFlows.filter((flow) => !localResourceIds.has(flow.resourceId));

  const withContracts = applyContracts(flows, contracts);

  return {
    flows: withContracts.flows,
    allLines,
    contractResults: withContracts.contractResults,
    calculation,
  };
};
