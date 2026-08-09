import { baseConfig } from "../../db/config";
import { type Contract } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { type ResourceId } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../building-stats/building-stats";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { applyContracts, type ContractResult } from "../contracts/calculate-contracts";
import { getRecipeOutputQuantity, type OutputModifierMultipliers } from "../modifiers/recipe-output";
import { typedEntries } from "../typed-entries/typed-entries";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
  contractResults: ContractResult[];
  calculation: ReturnType<typeof calculateNet>;
}

interface ElectricityDispatchGroup {
  id: string;
  priority: number;
  capacityMw: number;
}

const MAX_DISPATCH_ITERATIONS = 32;
const DISPATCH_TOLERANCE = 0.000001;

const calculateWithElectricityDispatch = (
  lines: ProductionLine[],
  externalInputs: Partial<Record<ResourceId, number>>,
  recyclingEfficiencyPercent: number,
  outputModifiers: OutputModifierMultipliers,
) => {
  const groupsById = new Map<string, ElectricityDispatchGroup>();

  for (const line of lines) {
    const dispatch = line.recipe.electricityDispatch;

    if (!dispatch) continue;

    const electricityCapacityMw = line.recipe.outputs.reduce((total, output) => (
      output.resourceId === "electricity"
        ? total + getRecipeOutputQuantity(line.recipe, output, outputModifiers)
          * line.buildingCount
          * line.speedLevel
        : total
    ), 0);
    const existing = groupsById.get(dispatch.groupId);

    groupsById.set(dispatch.groupId, {
      id: dispatch.groupId,
      priority: dispatch.priority,
      capacityMw: (existing?.capacityMw ?? 0) + electricityCapacityMw,
    });
  }

  const groups = [...groupsById.values()].toSorted((a, b) => (
    a.priority - b.priority || a.id.localeCompare(b.id)
  ));
  const applyDispatchRatios = (ratios: Map<string, number>) => lines.map((line) => {
    const groupId = line.recipe.electricityDispatch?.groupId;

    return groupId
      ? {
          ...line,
          operatingMode: "balanced" as const,
          allocationRatio: ratios.get(groupId) ?? 0,
        }
      : line;
  });
  let ratios = new Map(groups.map((group) => [group.id, 0]));
  let dispatchedLines: ProductionLine[] = [];
  let calculation: ReturnType<typeof calculateNet>;

  // Steam-routing changes reformer/desalinator power draw, which changes the
  // generation target. Iterate the small feedback loop to a steady state.
  for (let iteration = 0; iteration < MAX_DISPATCH_ITERATIONS; iteration += 1) {
    dispatchedLines = applyDispatchRatios(ratios);
    calculation = calculateNet(
      dispatchedLines,
      externalInputs,
      recyclingEfficiencyPercent,
      outputModifiers,
    );

    let remainingDemandMw = calculateBuildingStats(
      dispatchedLines,
      calculation,
    ).electricityKw / 1000;
    const nextRatios = new Map<string, number>();

    for (const group of groups) {
      const ratio = group.capacityMw > 0
        ? Math.min(1, Math.max(0, remainingDemandMw / group.capacityMw))
        : 0;

      nextRatios.set(group.id, ratio);
      remainingDemandMw = Math.max(0, remainingDemandMw - group.capacityMw * ratio);
    }

    const converged = groups.every((group) => (
      Math.abs((nextRatios.get(group.id) ?? 0) - (ratios.get(group.id) ?? 0))
      <= DISPATCH_TOLERANCE
    ));

    ratios = nextRatios;

    if (converged) break;
  }

  dispatchedLines = applyDispatchRatios(ratios);
  calculation = calculateNet(
    dispatchedLines,
    externalInputs,
    recyclingEfficiencyPercent,
    outputModifiers,
  );

  return { lines: dispatchedLines, calculation };
};

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

  const dispatched = calculateWithElectricityDispatch(
    allLines,
    externalInputs,
    recyclingEfficiencyPercent,
    outputModifiers,
  );
  const { calculation } = dispatched;
  const { allResourceFlows } = calculation;
  const flows = allResourceFlows.filter((flow) => !localResourceIds.has(flow.resourceId));

  const withContracts = applyContracts(flows, contracts);

  return {
    flows: withContracts.flows,
    allLines: dispatched.lines,
    contractResults: withContracts.contractResults,
    calculation,
  };
};
