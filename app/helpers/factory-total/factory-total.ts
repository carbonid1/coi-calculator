import { type ActiveContract } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { type ResourceId } from "../../db/resources";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../building-stats/building-stats";
import { type ResourceFlow, type ProductionLine, calculateNet } from "../calculate/calculate";
import { applyContracts, type ContractResult } from "../contracts/calculate-contracts";
import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../modifiers/recipe-output";
import { getPresetResourceDemands } from "../preset-resource-demands/preset-resource-demands";
import { typedEntries } from "../typed-entries/typed-entries";

export interface FactoryTotalResult {
  flows: ResourceFlow[];
  allLines: ProductionLine[];
  contractResults: ContractResult[];
  calculation: ReturnType<typeof calculateNet>;
  electricityDemandMw: number;
  computingDemandTflops: number;
}

export interface FactoryTotalOptions {
  /** Contracts enabled for this specific calculation scenario. */
  contracts?: ActiveContract[];
  /** Effective recycling efficiency after synced, modeled, and planned modifiers. */
  recyclingEfficiencyPercent: number;
  outputModifiers?: RecipeModifierMultipliers;
  shipsFuelUseMultiplier?: number;
  contractsProfitMultiplier?: number;
  /** Unlinked output crossing into the factory from isolated live modules. */
  boundarySupplies?: Partial<Record<ResourceId, number>>;
  /** Unlinked input drawn by isolated live modules from the global factory. */
  boundaryDemands?: Partial<Record<ResourceId, number>>;
}

interface ElectricityDispatchGroup {
  id: string;
  priority: number;
  capacityMw: number;
  minimumGenerationMw: number;
}

const MAX_DISPATCH_ITERATIONS = 32;
const DISPATCH_TOLERANCE = 0.000001;
const MAX_CONTRACT_BALANCE_ITERATIONS = 32;
const CONTRACT_BALANCE_TOLERANCE = 0.000001;

const getDemandSourceProduction = (
  calculation: ReturnType<typeof calculateNet>,
) => {
  const production = new Map<ResourceId, number>();

  for (const result of calculation.sourceResults) {
    if (result.recipe.sourceMode !== "demand") continue;

    for (const output of result.actualOutputs) {
      production.set(
        output.resourceId,
        (production.get(output.resourceId) ?? 0) + output.quantity,
      );
    }
  }

  return production;
};

const calculateWithDispatch = (
  lines: ProductionLine[],
  suppliedResources: Partial<Record<ResourceId, number>>,
  recyclingEfficiencyPercent: number,
  outputModifiers: RecipeModifierMultipliers,
  fixedDemands: Partial<Record<ResourceId, number>> = {},
  electricityDispatchTargets: Record<string, number> = {},
  nonConstrainingSuppliedResourceIds: ReadonlySet<ResourceId> = new Set(),
) => {
  const groupsById = new Map<string, ElectricityDispatchGroup>();
  const prioritizedLines = lines.filter((line) => (
    typedEntries(line.recipe.inputPriorities ?? {}).length > 0
  ));
  const prioritizedLineId = (line: ProductionLine) => `${line.moduleId}:${line.recipe.id}`;

  for (const line of lines) {
    const dispatch = line.recipe.electricityDispatch;

    if (!dispatch) continue;

    const electricityCapacityMw = line.recipe.outputs.reduce((total, output) => (
      output.resourceId === "electricity"
        ? total + getRecipeOutputQuantity(line.recipe, output, outputModifiers)
          * line.activeBuildings
          * line.speedLevel
        : total
    ), 0);
    const existing = groupsById.get(dispatch.groupId);

    groupsById.set(dispatch.groupId, {
      id: dispatch.groupId,
      priority: dispatch.priority,
      capacityMw: (existing?.capacityMw ?? 0) + electricityCapacityMw,
      minimumGenerationMw: Math.max(
        existing?.minimumGenerationMw ?? 0,
        electricityDispatchTargets[dispatch.groupId] ?? 0,
      ),
    });
  }

  const groups = [...groupsById.values()].toSorted((a, b) => (
    a.priority - b.priority || a.id.localeCompare(b.id)
  ));
  const minimumElectricityDemandMw = groups.reduce(
    (state, group) => ({
      priorCapacityMw: state.priorCapacityMw + group.capacityMw,
      demandMw: group.minimumGenerationMw > 0 && group.capacityMw > 0
        ? Math.max(
            state.demandMw,
            state.priorCapacityMw
              + Math.min(group.capacityMw, group.minimumGenerationMw),
          )
        : state.demandMw,
    }),
    { priorCapacityMw: 0, demandMw: 0 },
  ).demandMw;
  const applyDispatchRatios = (
    electricityRatios: Map<string, number>,
    resourceRatios: Map<string, number>,
  ) => lines.map((line) => {
    const groupId = line.recipe.electricityDispatch?.groupId;
    const resourceRatio = resourceRatios.get(prioritizedLineId(line));
    const ratios = [
      ...(groupId ? [electricityRatios.get(groupId) ?? 0] : []),
      ...(resourceRatio != null ? [resourceRatio] : []),
    ];

    return ratios.length > 0
      ? {
          ...line,
          operatingMode: "balanced" as const,
          allocationRatio: Math.min(...ratios),
        }
      : line;
  });
  let electricityRatios = new Map(groups.map((group) => [group.id, 0]));
  let resourceRatios = new Map(
    prioritizedLines.map((line) => [prioritizedLineId(line), 0]),
  );
  let dispatchedLines: ProductionLine[] = [];
  let calculation: ReturnType<typeof calculateNet>;

  // Steam routing changes both electricity demand and Brine supply. Resource
  // priorities likewise depend on final byproduct totals, so dispatch both
  // feedback loops together until the monthly plan reaches a steady state.
  for (let iteration = 0; iteration < MAX_DISPATCH_ITERATIONS; iteration += 1) {
    dispatchedLines = applyDispatchRatios(electricityRatios, resourceRatios);
    calculation = calculateNet(
      dispatchedLines,
      suppliedResources,
      recyclingEfficiencyPercent,
      outputModifiers,
      fixedDemands,
      nonConstrainingSuppliedResourceIds,
    );

    const modeledDemandMw = calculateBuildingStats(
      dispatchedLines,
      calculation,
      outputModifiers,
    ).electricityKw / 1000;
    let remainingDemandMw = Math.max(
      modeledDemandMw,
      minimumElectricityDemandMw,
    );
    const nextElectricityRatios = new Map<string, number>();

    for (const group of groups) {
      const ratio = group.capacityMw > 0
        ? Math.min(1, Math.max(0, remainingDemandMw / group.capacityMw))
        : 0;

      nextElectricityRatios.set(group.id, ratio);
      remainingDemandMw = Math.max(0, remainingDemandMw - group.capacityMw * ratio);
    }

    const desiredResourceRatios = new Map<string, number>();

    for (const line of prioritizedLines) {
      const result = calculation.regularResults.find((candidate) => (
        candidate.moduleId === line.moduleId && candidate.recipe.id === line.recipe.id
      ));
      const factor = line.activeBuildings * line.speedLevel;
      let desiredRatio = 0;

      if (line.recipe.balanceBy === "output") {
        const balanceOutputIds = line.recipe.balanceOutputIds
          ? new Set(line.recipe.balanceOutputIds)
          : null;
        const outputRatios = line.recipe.outputs.flatMap((output) => {
          if (balanceOutputIds && !balanceOutputIds.has(output.resourceId)) return [];

          const flow = calculation.allResourceFlows.find(
            (candidate) => candidate.resourceId === output.resourceId,
          );
          const currentProduced = result?.actualOutputs.find(
            (actual) => actual.resourceId === output.resourceId,
          )?.quantity ?? 0;
          const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

          if (!flow || capacity <= 0) return [];

          return [Math.max(0, flow.consumed - (flow.produced - currentProduced)) / capacity];
        });

        desiredRatio = outputRatios.length > 0 ? Math.max(...outputRatios) : 0;
      } else {
        const balanceInputIds = line.recipe.balanceInputIds
          ? new Set(line.recipe.balanceInputIds)
          : null;
        const drivingInputs = line.recipe.inputs.filter((input) => (
          (!balanceInputIds || balanceInputIds.has(input.resourceId))
          && line.recipe.inputPriorities?.[input.resourceId] == null
        ));
        const hasPrioritizedInput = line.recipe.inputs.some((input) => (
          line.recipe.inputPriorities?.[input.resourceId] != null
        ));

        desiredRatio = drivingInputs.length > 0 || hasPrioritizedInput ? 1 : 0;

        for (const input of drivingInputs) {
          const flow = calculation.allResourceFlows.find(
            (candidate) => candidate.resourceId === input.resourceId,
          );
          const currentConsumed = result?.actualInputs.find(
            (actual) => actual.resourceId === input.resourceId,
          )?.quantity ?? 0;
          const capacity = getRecipeInputQuantity(input, outputModifiers) * factor;

          if (!flow || capacity <= 0) {
            desiredRatio = 0;
            continue;
          }

          const available = flow.produced - (flow.consumed - currentConsumed);

          desiredRatio = Math.min(desiredRatio, Math.max(0, available / capacity));
        }
      }

      desiredResourceRatios.set(
        prioritizedLineId(line),
        Math.min(1, Math.max(0, desiredRatio)),
      );
    }

    // A prioritized consumer can be starved by its input allocation even when
    // its output still has unmet demand. Preserve that latent input request for
    // prioritized upstream producers. Without this pass, Brine consumers make
    // the available Brine look perfectly balanced and Super-Steam desalination
    // cannot see the Chlorine and Salt demand waiting behind them.
    for (const line of prioritizedLines) {
      if (line.recipe.balanceBy !== "output") continue;

      const result = calculation.regularResults.find((candidate) => (
        candidate.moduleId === line.moduleId && candidate.recipe.id === line.recipe.id
      ));
      const factor = line.activeBuildings * line.speedLevel;
      let desiredRatio = desiredResourceRatios.get(prioritizedLineId(line)) ?? 0;

      for (const output of line.recipe.outputs) {
        if (
          line.recipe.balanceOutputIds
          && !line.recipe.balanceOutputIds.includes(output.resourceId)
        ) {
          continue;
        }

        const downstreamConsumers = prioritizedLines.filter((candidate) => (
          candidate !== line
          && candidate.recipe.inputPriorities?.[output.resourceId] != null
        ));

        if (downstreamConsumers.length === 0) continue;

        const flow = calculation.allResourceFlows.find(
          (candidate) => candidate.resourceId === output.resourceId,
        );
        const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

        if (!flow || capacity <= 0) continue;

        const currentProduced = result?.actualOutputs.find(
          (actual) => actual.resourceId === output.resourceId,
        )?.quantity ?? 0;
        const currentPrioritizedConsumption = downstreamConsumers.reduce((total, consumer) => {
          const consumerResult = calculation.regularResults.find((candidate) => (
            candidate.moduleId === consumer.moduleId
            && candidate.recipe.id === consumer.recipe.id
          ));

          return total + (consumerResult?.actualInputs.find(
            (actual) => actual.resourceId === output.resourceId,
          )?.quantity ?? 0);
        }, 0);
        const desiredPrioritizedConsumption = downstreamConsumers.reduce((total, consumer) => {
          const input = consumer.recipe.inputs.find(
            (candidate) => candidate.resourceId === output.resourceId,
          );

          if (!input) return total;

          return total + getRecipeInputQuantity(input, outputModifiers)
            * consumer.activeBuildings
            * consumer.speedLevel
            * (desiredResourceRatios.get(prioritizedLineId(consumer)) ?? 0);
        }, 0);
        const effectiveConsumption = flow.consumed
          - currentPrioritizedConsumption
          + desiredPrioritizedConsumption;
        const producedByOtherLines = flow.produced - currentProduced;

        desiredRatio = Math.max(
          desiredRatio,
          Math.max(0, effectiveConsumption - producedByOtherLines) / capacity,
        );
      }

      desiredResourceRatios.set(
        prioritizedLineId(line),
        Math.min(1, Math.max(0, desiredRatio)),
      );
    }

    const prioritizedResourceIds = new Set(
      prioritizedLines.flatMap((line) => (
        typedEntries(line.recipe.inputPriorities ?? {}).map(([resourceId]) => resourceId)
      )),
    );

    for (const resourceId of prioritizedResourceIds) {
      const flow = calculation.allResourceFlows.find(
        (candidate) => candidate.resourceId === resourceId,
      );
      const consumers = prioritizedLines
        .filter((line) => line.recipe.inputPriorities?.[resourceId] != null)
        .toSorted((a, b) => (
          (a.recipe.inputPriorities?.[resourceId] ?? Number.MAX_SAFE_INTEGER)
          - (b.recipe.inputPriorities?.[resourceId] ?? Number.MAX_SAFE_INTEGER)
        ));
      const currentlyConsumed = consumers.reduce((total, line) => {
        const result = calculation.regularResults.find((candidate) => (
          candidate.moduleId === line.moduleId && candidate.recipe.id === line.recipe.id
        ));

        return total + (result?.actualInputs.find(
          (actual) => actual.resourceId === resourceId,
        )?.quantity ?? 0);
      }, 0);
      const consumedByFallbackSinks = calculation.sinkResults.reduce(
        (total, result) => total + (result.actualInputs.find(
          (actual) => actual.resourceId === resourceId,
        )?.quantity ?? 0),
        0,
      );
      let remaining = Math.max(
        0,
        (flow?.produced ?? 0) - (
          (flow?.consumed ?? 0) - currentlyConsumed - consumedByFallbackSinks
        ),
      );

      for (const line of consumers) {
        const id = prioritizedLineId(line);
        const desiredRatio = desiredResourceRatios.get(id) ?? 0;
        const input = line.recipe.inputs.find(
          (candidate) => candidate.resourceId === resourceId,
        );
        const capacity = input
          ? getRecipeInputQuantity(input, outputModifiers) * line.activeBuildings * line.speedLevel
          : 0;
        const allocatedRatio = capacity > 0
          ? Math.min(desiredRatio, remaining / capacity)
          : 0;

        desiredResourceRatios.set(id, allocatedRatio);
        remaining = Math.max(0, remaining - capacity * allocatedRatio);
      }
    }

    const electricityConverged = groups.every((group) => (
      Math.abs(
        (nextElectricityRatios.get(group.id) ?? 0)
        - (electricityRatios.get(group.id) ?? 0),
      ) <= DISPATCH_TOLERANCE
    ));
    const resourcesConverged = prioritizedLines.every((line) => {
      const id = prioritizedLineId(line);

      return Math.abs(
        (desiredResourceRatios.get(id) ?? 0) - (resourceRatios.get(id) ?? 0),
      ) <= DISPATCH_TOLERANCE;
    });

    electricityRatios = nextElectricityRatios;
    resourceRatios = desiredResourceRatios;

    if (electricityConverged && resourcesConverged) break;
  }

  dispatchedLines = applyDispatchRatios(electricityRatios, resourceRatios);
  calculation = calculateNet(
    dispatchedLines,
    suppliedResources,
    recyclingEfficiencyPercent,
    outputModifiers,
    fixedDemands,
    nonConstrainingSuppliedResourceIds,
  );

  const buildingStats = calculateBuildingStats(
    dispatchedLines,
    calculation,
    outputModifiers,
  );
  const modeledDemandMw = buildingStats.electricityKw / 1000;

  return {
    lines: dispatchedLines,
    calculation,
    electricityDemandMw: Math.max(modeledDemandMw, minimumElectricityDemandMw),
    computingDemandTflops: buildingStats.computingTflops,
  };
};

export const calculateFactoryTotal = (
  modules: Module[],
  {
    contracts = [],
    recyclingEfficiencyPercent,
    outputModifiers = {},
    shipsFuelUseMultiplier = 1,
    contractsProfitMultiplier = 1,
    boundarySupplies = {},
    boundaryDemands = {},
  }: FactoryTotalOptions,
): FactoryTotalResult => {
  const allLines: ProductionLine[] = [];
  const localResourceIds = new Set<ResourceId>();
  const fixedDemands: Partial<Record<ResourceId, number>> = {};
  const electricityDispatchTargets: Record<string, number> = {};

  for (const mod of modules) {
    if (mod.includedInFactoryTotals === false) continue;

    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines } = buildModuleLines(mod, preset, outputModifiers);

    allLines.push(...lines);

    for (const resourceId of mod.localResources ?? []) localResourceIds.add(resourceId);
    for (const [resourceId, quantity] of typedEntries(getPresetResourceDemands(preset))) {
      fixedDemands[resourceId] = (fixedDemands[resourceId] ?? 0) + quantity;
    }
    for (const [groupId, quantity] of Object.entries(preset?.electricityDispatchTargets ?? {})) {
      electricityDispatchTargets[groupId] = Math.max(
        electricityDispatchTargets[groupId] ?? 0,
        quantity,
      );
    }
  }

  for (const [resourceId, quantity] of typedEntries(boundaryDemands)) {
    fixedDemands[resourceId] = (fixedDemands[resourceId] ?? 0) + quantity;
  }

  const withoutContracts = calculateWithDispatch(
    allLines,
    boundarySupplies,
    recyclingEfficiencyPercent,
    outputModifiers,
    fixedDemands,
    electricityDispatchTargets,
  );
  const demandSourceProduction = getDemandSourceProduction(
    withoutContracts.calculation,
  );

  // Demand sources (map mines, world mines, and forestry) backfill deficits in
  // calculateNet. Hide that fallback production while sizing enabled contracts
  // so an import can replace extraction, then let the final calculation reduce
  // the source to whatever demand remains after the contract input is applied.
  const contractPlanningFlows = withoutContracts.calculation.allResourceFlows.map((flow) => {
    const produced = Math.max(
      0,
      flow.produced - (demandSourceProduction.get(flow.resourceId) ?? 0),
    );

    return {
      ...flow,
      produced,
      net: produced - flow.consumed,
    };
  });
  const globalContractPlanningFlows = contractPlanningFlows.filter(
    (flow) => !localResourceIds.has(flow.resourceId),
  );
  const calculateWithContractPlan = (
    contractPlan: ReturnType<typeof applyContracts>,
  ) => {
    const suppliedResources: Partial<Record<ResourceId, number>> = {
      ...boundarySupplies,
    };
    const contractDemands: Partial<Record<ResourceId, number>> = { ...fixedDemands };
    const contractInputIds = new Set<ResourceId>();

    for (const result of contractPlan.contractResults) {
      const importedId = result.contract.exchange.imported.resourceId;
      const exportedId = result.contract.exchange.exported.resourceId;

      suppliedResources[importedId] = (suppliedResources[importedId] ?? 0)
        + result.imported;
      contractDemands[exportedId] = (contractDemands[exportedId] ?? 0)
        + result.exported;
      contractInputIds.add(importedId);
    }

    return calculateWithDispatch(
      allLines,
      suppliedResources,
      recyclingEfficiencyPercent,
      outputModifiers,
      contractDemands,
      electricityDispatchTargets,
      contractInputIds,
    );
  };
  let demandBalancedImports = new Map<string, number>();
  let contractPlan = applyContracts(
    globalContractPlanningFlows,
    contracts,
    shipsFuelUseMultiplier,
    demandBalancedImports,
    contractsProfitMultiplier,
  );
  let dispatched = calculateWithContractPlan(contractPlan);

  for (
    let iteration = 0;
    iteration < MAX_CONTRACT_BALANCE_ITERATIONS;
    iteration += 1
  ) {
    const finalDemandSources = getDemandSourceProduction(
      dispatched.calculation,
    );
    const finalFlows = new Map(
      dispatched.calculation.allResourceFlows.map((flow) => [flow.resourceId, flow]),
    );
    const nextDemandBalancedImports = new Map(demandBalancedImports);
    let converged = true;

    for (const result of contractPlan.contractResults) {
      if (result.contract.plan.importedPerProductionCycle !== null) continue;

      const importedId = result.contract.exchange.imported.resourceId;
      const finalNet = finalFlows.get(importedId)?.net ?? 0;
      const demandSourceRemainder = finalDemandSources.get(importedId) ?? 0;
      const nextImported = Math.max(
        0,
        result.imported + demandSourceRemainder - finalNet,
      );

      nextDemandBalancedImports.set(result.contract.id, nextImported);
      if (
        Math.abs(nextImported - result.requestedImported)
        > CONTRACT_BALANCE_TOLERANCE
      ) {
        converged = false;
      }
    }

    if (converged) break;

    demandBalancedImports = nextDemandBalancedImports;
    contractPlan = applyContracts(
      globalContractPlanningFlows,
      contracts,
      shipsFuelUseMultiplier,
      demandBalancedImports,
      contractsProfitMultiplier,
    );
    dispatched = calculateWithContractPlan(contractPlan);
  }
  const { calculation } = dispatched;
  const flows = calculation.allResourceFlows.filter(
    (flow) => !localResourceIds.has(flow.resourceId),
  );
  const finalDemandSources = getDemandSourceProduction(calculation);
  const finalFlowsById = new Map(flows.map((flow) => [flow.resourceId, flow]));
  const contractResults = contractPlan.contractResults.map((result) => {
    const importedId = result.contract.exchange.imported.resourceId;
    const finalNet = finalFlowsById.get(importedId)?.net ?? 0;
    const demandSourceRemainder = finalDemandSources.get(importedId) ?? 0;
    const requiredImported = Math.max(
      0,
      result.imported + demandSourceRemainder - finalNet,
    );

    return {
      ...result,
      requiredImported,
      uncoveredImported: Math.max(0, requiredImported - result.imported),
    };
  });

  return {
    flows,
    allLines: dispatched.lines,
    contractResults,
    calculation,
    electricityDemandMw: dispatched.electricityDemandMw,
    computingDemandTflops: dispatched.computingDemandTflops,
  };
};
