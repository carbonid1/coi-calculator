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
  /** Private linked output reserved inside its factory-pooled source module. */
  moduleFixedDemands?: ReadonlyMap<string, Partial<Record<ResourceId, number>>>;
  /** Private linked input delivered into a factory-pooled target module. */
  moduleSuppliedResources?: ReadonlyMap<string, Partial<Record<ResourceId, number>>>;
}

interface ElectricityDispatchGroup {
  id: string;
  priority: number;
  capacityMw: number;
  minimumGenerationMw: number;
}

const MAX_DISPATCH_ITERATIONS = 32;
const DISPATCH_TOLERANCE = 0.000001;
const RESOURCE_DISPATCH_RELAXATION = 0.5;
const MAX_CONTRACT_BALANCE_ITERATIONS = 32;
// Contract plans are displayed and acted on at hundredth-unit precision. Stop
// once every import changes by less than a thousandth of a unit per cycle so a
// stable geometric tail does not trigger several more full factory solves.
const CONTRACT_BALANCE_TOLERANCE = 0.001;

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
  plannedSupportingResourceIds: ReadonlyMap<
    string,
    ReadonlySet<ResourceId>
  > = new Map(),
  moduleFixedDemands: ReadonlyMap<
    string,
    Partial<Record<ResourceId, number>>
  > = new Map(),
  moduleSuppliedResources: ReadonlyMap<
    string,
    Partial<Record<ResourceId, number>>
  > = new Map(),
) => {
  const groupsById = new Map<string, ElectricityDispatchGroup>();
  const prioritizedLines = lines.filter((line) => (
    typedEntries(line.recipe.inputPriorities ?? {}).length > 0
  ));
  const prioritizedLineId = (line: ProductionLine) => `${line.moduleId}:${line.recipe.id}`;
  const getModuleResourceFlow = (
    calculation: ReturnType<typeof calculateNet>,
    moduleId: string,
    resourceId: ResourceId,
  ) => {
    const results = [
      ...calculation.regularResults,
      ...calculation.sourceResults,
      ...calculation.sinkResults,
    ].filter(result => result.moduleId === moduleId);

    return results.reduce((flow, result) => ({
      consumed: flow.consumed + result.actualInputs.reduce((total, input) => (
        input.resourceId === resourceId ? total + input.quantity : total
      ), 0),
      produced: flow.produced + result.actualOutputs.reduce((total, output) => (
        output.resourceId === resourceId ? total + output.quantity : total
      ), 0),
    }), {
      consumed: moduleFixedDemands.get(moduleId)?.[resourceId] ?? 0,
      produced: moduleSuppliedResources.get(moduleId)?.[resourceId] ?? 0,
    });
  };

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
  let calculation: ReturnType<typeof calculateNet> | null = null;
  let buildingStats: ReturnType<typeof calculateBuildingStats> | null = null;
  let calculationMatchesDispatchRatios = false;

  // Steam routing changes both electricity demand and Brine supply. Resource
  // priorities likewise depend on final byproduct totals, so dispatch both
  // feedback loops together until the monthly plan reaches a steady state.
  for (let iteration = 0; iteration < MAX_DISPATCH_ITERATIONS; iteration += 1) {
    dispatchedLines = applyDispatchRatios(electricityRatios, resourceRatios);
    const currentCalculation = calculateNet(
      dispatchedLines,
      suppliedResources,
      recyclingEfficiencyPercent,
      outputModifiers,
      fixedDemands,
      nonConstrainingSuppliedResourceIds,
      plannedSupportingResourceIds,
      moduleFixedDemands,
      moduleSuppliedResources,
    );

    calculation = currentCalculation;

    buildingStats = calculateBuildingStats(
      dispatchedLines,
      currentCalculation,
      outputModifiers,
    );
    const modeledDemandMw = buildingStats.electricityKw / 1000;
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
      const result = currentCalculation.regularResults.find((candidate) => (
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

          const flow = currentCalculation.allResourceFlows.find(
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
          const flow = currentCalculation.allResourceFlows.find(
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

      const result = currentCalculation.regularResults.find((candidate) => (
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

        const flow = currentCalculation.allResourceFlows.find(
          (candidate) => candidate.resourceId === output.resourceId,
        );
        const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

        if (!flow || capacity <= 0) continue;

        const currentProduced = result?.actualOutputs.find(
          (actual) => actual.resourceId === output.resourceId,
        )?.quantity ?? 0;
        const currentPrioritizedConsumption = downstreamConsumers.reduce((total, consumer) => {
          const consumerResult = currentCalculation.regularResults.find((candidate) => (
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
      const flow = currentCalculation.allResourceFlows.find(
        (candidate) => candidate.resourceId === resourceId,
      );
      const consumers = prioritizedLines
        .filter((line) => line.recipe.inputPriorities?.[resourceId] != null)
        .toSorted((a, b) => (
          (a.recipe.inputPriorities?.[resourceId] ?? Number.MAX_SAFE_INTEGER)
          - (b.recipe.inputPriorities?.[resourceId] ?? Number.MAX_SAFE_INTEGER)
        ));
      const currentConsumption = (line: ProductionLine) => {
        const result = currentCalculation.regularResults.find((candidate) => (
          candidate.moduleId === line.moduleId && candidate.recipe.id === line.recipe.id
        ));

        return result?.actualInputs.find(
          (actual) => actual.resourceId === resourceId,
        )?.quantity ?? 0;
      };
      const scopeKey = (line: ProductionLine) => (
        line.recipe.balanceInputScope === "module"
          ? `module:${line.moduleId}`
          : "global"
      );
      const consumersByScope = new Map<string, ProductionLine[]>();

      for (const line of consumers) {
        const key = scopeKey(line);
        const scopedConsumers = consumersByScope.get(key) ?? [];

        scopedConsumers.push(line);
        consumersByScope.set(key, scopedConsumers);
      }

      const consumedByFallbackSinks = currentCalculation.sinkResults.reduce(
        (total, result) => total + (result.actualInputs.find(
          (actual) => actual.resourceId === resourceId,
        )?.quantity ?? 0),
        0,
      );
      const remainingByScope = new Map<string, number>();
      let reservedModuleSupply = 0;

      for (const [key, scopedConsumers] of consumersByScope) {
        if (!key.startsWith("module:")) continue;

        const moduleId = key.slice("module:".length);
        const moduleFlow = getModuleResourceFlow(
          currentCalculation,
          moduleId,
          resourceId,
        );
        const currentlyConsumed = scopedConsumers.reduce(
          (total, line) => total + currentConsumption(line),
          0,
        );
        const consumedByModuleSinks = currentCalculation.sinkResults.reduce(
          (total, result) => result.moduleId === moduleId
            ? total + (result.actualInputs.find(
                (actual) => actual.resourceId === resourceId,
              )?.quantity ?? 0)
            : total,
          0,
        );
        const remaining = Math.max(
          0,
          moduleFlow.produced - (
            moduleFlow.consumed - currentlyConsumed - consumedByModuleSinks
          ),
        );

        remainingByScope.set(key, remaining);
        reservedModuleSupply += remaining;
      }

      const globallyConsumed = (consumersByScope.get("global") ?? []).reduce(
        (total, line) => total + currentConsumption(line),
        0,
      );

      remainingByScope.set("global", Math.max(
        0,
        (flow?.produced ?? 0) - (
          (flow?.consumed ?? 0) - globallyConsumed - consumedByFallbackSinks
        ) - reservedModuleSupply,
      ));

      for (const line of consumers) {
        const id = prioritizedLineId(line);
        const key = scopeKey(line);
        const remaining = remainingByScope.get(key) ?? 0;
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
        remainingByScope.set(key, Math.max(0, remaining - capacity * allocatedRatio));
      }
    }

    // Several equivalent prioritized consumers can otherwise alternate between
    // full and idle on successive dispatch passes: each sees the other one's
    // previous output, then both reverse together. Relaxing the resource update
    // makes that shared-output fixed point converge while preserving input
    // priority and installed-capacity limits.
    for (const line of prioritizedLines) {
      const id = prioritizedLineId(line);
      const previousRatio = resourceRatios.get(id) ?? 0;
      const desiredRatio = desiredResourceRatios.get(id) ?? 0;

      desiredResourceRatios.set(
        id,
        previousRatio
          + (desiredRatio - previousRatio) * RESOURCE_DISPATCH_RELAXATION,
      );
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
    const ratiosAreIdentical = groups.every((group) => (
      nextElectricityRatios.get(group.id) === electricityRatios.get(group.id)
    )) && prioritizedLines.every((line) => {
      const id = prioritizedLineId(line);

      return desiredResourceRatios.get(id) === resourceRatios.get(id);
    });

    electricityRatios = nextElectricityRatios;
    resourceRatios = desiredResourceRatios;

    if (electricityConverged && resourcesConverged) {
      calculationMatchesDispatchRatios = ratiosAreIdentical;
      break;
    }
  }

  if (!calculationMatchesDispatchRatios || !calculation || !buildingStats) {
    dispatchedLines = applyDispatchRatios(electricityRatios, resourceRatios);
    calculation = calculateNet(
      dispatchedLines,
      suppliedResources,
      recyclingEfficiencyPercent,
      outputModifiers,
      fixedDemands,
      nonConstrainingSuppliedResourceIds,
      plannedSupportingResourceIds,
      moduleFixedDemands,
      moduleSuppliedResources,
    );
    buildingStats = calculateBuildingStats(
      dispatchedLines,
      calculation,
      outputModifiers,
    );
  }

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
    moduleFixedDemands = new Map(),
    moduleSuppliedResources = new Map(),
  }: FactoryTotalOptions,
): FactoryTotalResult => {
  const allLines: ProductionLine[] = [];
  const localResourceIds = new Set<ResourceId>();
  const fixedDemands: Partial<Record<ResourceId, number>> = {};
  const suppliedResources: Partial<Record<ResourceId, number>> = {
    ...boundarySupplies,
  };
  const resolvedModuleSuppliedResources = new Map<
    string,
    Partial<Record<ResourceId, number>>
  >([...moduleSuppliedResources].map(([moduleId, supplies]) => [
    moduleId,
    { ...supplies },
  ]));

  // A private factory link is reserved as demand at its source. Credit the
  // matching delivery once globally so consumption at the pooled target does
  // not count the same transfer twice.
  for (const supplies of moduleSuppliedResources.values()) {
    for (const [resourceId, quantity] of typedEntries(supplies)) {
      suppliedResources[resourceId] = (suppliedResources[resourceId] ?? 0) + quantity;
    }
  }
  const electricityDispatchTargets: Record<string, number> = {};

  for (const mod of modules) {
    if (mod.includedInFactoryTotals === false) continue;

    const preset = mod.defaultPresetId
      ? mod.presets.find((p) => p.id === mod.defaultPresetId) ?? mod.presets[0] ?? null
      : null;
    const { lines } = buildModuleLines(mod, preset, outputModifiers);

    allLines.push(...lines);

    for (const resourceId of mod.localResources ?? []) localResourceIds.add(resourceId);
    // A globally pooled live module uses requestedExports as an internal output
    // target. Only its separately modeled fixed loads are external factory demand.
    const presetDemands = mod.liveArea
      ? (preset?.fixedDemands ?? {})
      : getPresetResourceDemands(preset)

    for (const [resourceId, quantity] of typedEntries(presetDemands)) {
      fixedDemands[resourceId] = (fixedDemands[resourceId] ?? 0) + quantity;
    }
    for (const [resourceId, quantity] of typedEntries(preset?.requestedImports ?? {})) {
      const plannedQuantity = Math.max(0, quantity);

      if (plannedQuantity === 0) continue;

      suppliedResources[resourceId] = (suppliedResources[resourceId] ?? 0)
        + plannedQuantity;
      const moduleSupplies = resolvedModuleSuppliedResources.get(mod.id) ?? {};

      moduleSupplies[resourceId] = (moduleSupplies[resourceId] ?? 0) + plannedQuantity;
      resolvedModuleSuppliedResources.set(mod.id, moduleSupplies);
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
  const plannedSupportingResourceIds = new Map<string, Set<ResourceId>>();

  for (const line of allLines) {
    const drivingInputIds = new Set(line.drivingInputIds ?? []);

    if (drivingInputIds.size === 0) continue;

    const supportingIds = plannedSupportingResourceIds.get(line.moduleId)
      ?? new Set<ResourceId>();

    for (const input of line.recipe.inputs) {
      if (!drivingInputIds.has(input.resourceId)) supportingIds.add(input.resourceId);
    }

    plannedSupportingResourceIds.set(line.moduleId, supportingIds);
  }

  // Demand-balanced contracts must be able to reveal demand through an idle
  // downstream chain. For example, an Iron Ore contract feeds a Crusher whose
  // output feeds a furnace. Without a temporary planning supply, the Crusher
  // cannot start, so the contract incorrectly sees zero Iron Ore demand.
  const demandBalancedImportIds = new Set(
    contracts
      .filter(contract => contract.routes.some(
        route => route.importedPerProductionCycle === null,
      ))
      .map(contract => contract.exchange.imported.resourceId),
  );
  const contractPlanningSeeds: Partial<Record<ResourceId, number>> = {};
  const contractPlanningSupplies: Partial<Record<ResourceId, number>> = {
    ...suppliedResources,
  };

  for (const resourceId of demandBalancedImportIds) {
    const recipeInputCapacity = allLines.reduce((total, line) => (
      total + line.recipe.inputs.reduce((inputTotal, input) => (
        input.resourceId === resourceId
          ? inputTotal
            + getRecipeInputQuantity(input, outputModifiers)
              * line.activeBuildings
              * line.speedLevel
          : inputTotal
      ), 0)
    ), 0);
    const moduleDemand = [...moduleFixedDemands.values()].reduce(
      (total, demands) => total + (demands[resourceId] ?? 0),
      0,
    );
    const potentialDemand = recipeInputCapacity
      + (fixedDemands[resourceId] ?? 0)
      + moduleDemand;
    const planningSeed = Math.max(
      0,
      potentialDemand - (suppliedResources[resourceId] ?? 0),
    );

    if (planningSeed <= 0) continue;

    contractPlanningSeeds[resourceId] = planningSeed;
    contractPlanningSupplies[resourceId] = (
      contractPlanningSupplies[resourceId] ?? 0
    ) + planningSeed;
  }

  const withoutContracts = calculateWithDispatch(
    allLines,
    contractPlanningSupplies,
    recyclingEfficiencyPercent,
    outputModifiers,
    fixedDemands,
    electricityDispatchTargets,
    new Set(),
    plannedSupportingResourceIds,
    moduleFixedDemands,
    resolvedModuleSuppliedResources,
  );
  const demandSourceProduction = getDemandSourceProduction(
    withoutContracts.calculation,
  );

  // Demand sources (terrain extraction, world mines, and forestry) backfill deficits in
  // calculateNet. Hide that fallback production while sizing enabled contracts
  // so an import can replace extraction, then let the final calculation reduce
  // the source to whatever demand remains after the contract input is applied.
  const contractPlanningFlows = withoutContracts.calculation.allResourceFlows.map((flow) => {
    const produced = Math.max(
      0,
      flow.produced
        - (demandSourceProduction.get(flow.resourceId) ?? 0)
        - (contractPlanningSeeds[flow.resourceId] ?? 0),
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
    const suppliedResourcesWithContracts: Partial<Record<ResourceId, number>> = {
      ...suppliedResources,
    };
    const contractDemands: Partial<Record<ResourceId, number>> = { ...fixedDemands };
    const contractInputIds = new Set<ResourceId>();

    for (const result of contractPlan.contractResults) {
      const importedId = result.contract.exchange.imported.resourceId;
      const exportedId = result.contract.exchange.exported.resourceId;

      suppliedResourcesWithContracts[importedId] = (
        suppliedResourcesWithContracts[importedId] ?? 0
      )
        + result.imported;
      contractDemands[exportedId] = (contractDemands[exportedId] ?? 0)
        + result.exported;
      contractInputIds.add(importedId);
    }

    return calculateWithDispatch(
      allLines,
      suppliedResourcesWithContracts,
      recyclingEfficiencyPercent,
      outputModifiers,
      contractDemands,
      electricityDispatchTargets,
      contractInputIds,
      plannedSupportingResourceIds,
      moduleFixedDemands,
      resolvedModuleSuppliedResources,
    );
  };
  const calculatePlanningFlowsWithContractExports = (
    contractPlan: ReturnType<typeof applyContracts>,
  ) => {
    const planningSupplies = { ...contractPlanningSupplies };
    const planningDemands = { ...fixedDemands };

    for (const result of contractPlan.contractResults) {
      const importedId = result.contract.exchange.imported.resourceId;
      const exportedId = result.contract.exchange.exported.resourceId;

      // Fixed imports are ordinary factory supply during planning. Dynamic
      // imports are represented by the temporary seed so their full demand can
      // be measured independently of the previous iteration's shipment.
      const fixedImported = result.routes.reduce(
        (total, route) => total + (
          route.route.importedPerProductionCycle === null ? 0 : route.imported
        ),
        0,
      );

      if (fixedImported > 0) {
        planningSupplies[importedId] = (planningSupplies[importedId] ?? 0)
          + fixedImported;
      }
      planningDemands[exportedId] = (planningDemands[exportedId] ?? 0)
        + result.exported;
    }

    const planningDispatch = calculateWithDispatch(
      allLines,
      planningSupplies,
      recyclingEfficiencyPercent,
      outputModifiers,
      planningDemands,
      electricityDispatchTargets,
      new Set(),
      plannedSupportingResourceIds,
      moduleFixedDemands,
      resolvedModuleSuppliedResources,
    );
    const planningDemandSources = getDemandSourceProduction(
      planningDispatch.calculation,
    );

    return planningDispatch.calculation.allResourceFlows
      .map((flow) => {
        const produced = Math.max(
          0,
          flow.produced
            - (planningDemandSources.get(flow.resourceId) ?? 0)
            - (contractPlanningSeeds[flow.resourceId] ?? 0),
        );

        return {
          ...flow,
          produced,
          net: produced - flow.consumed,
        };
      })
      .filter(flow => !localResourceIds.has(flow.resourceId));
  };
  let contractPlan = applyContracts(
    globalContractPlanningFlows,
    contracts,
    shipsFuelUseMultiplier,
    new Map(),
    contractsProfitMultiplier,
  );

  for (
    let iteration = 0;
    iteration < MAX_CONTRACT_BALANCE_ITERATIONS;
    iteration += 1
  ) {
    const nextContractPlan = applyContracts(
      calculatePlanningFlowsWithContractExports(contractPlan),
      contracts,
      shipsFuelUseMultiplier,
      new Map(),
      contractsProfitMultiplier,
    );
    const priorById = new Map(contractPlan.contractResults.map(result => (
      [result.contract.id, result] as const
    )));
    const converged = nextContractPlan.contractResults.every((result) => {
      const prior = priorById.get(result.contract.id);

      return prior
        && Math.abs(result.requestedImported - prior.requestedImported)
          <= CONTRACT_BALANCE_TOLERANCE
        && Math.abs(result.imported - prior.imported)
          <= CONTRACT_BALANCE_TOLERANCE;
    });

    contractPlan = nextContractPlan;

    if (converged) break;
  }
  const dispatched = calculateWithContractPlan(contractPlan);
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
    const requiredImported = result.contract.routes.some(
      route => route.importedPerProductionCycle === null,
    )
      ? result.requiredImported
      : Math.max(
          0,
          result.imported + demandSourceRemainder - finalNet,
        );

    return {
      ...result,
      requiredImported,
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
