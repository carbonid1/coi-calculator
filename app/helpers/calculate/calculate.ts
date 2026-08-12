import { baseConfig } from "../../db/config";
import { type Recipe } from "../../db/recipes";
import { type Resource, type ResourceId, resources } from "../../db/resources";
import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../modifiers/recipe-output";
import { typedEntries } from "../typed-entries/typed-entries";

export interface ProductionLine {
  recipe: Recipe;
  moduleId: string;
  /** Module-scoped identity for recipes sharing the same installed buildings. */
  capacityPoolId?: string;
  buildingCount: number;
  totalBuildings: number;
  speedLevel: number;
  operatingMode: OperatingMode;
  /** Factory-wide dispatch can assign a utilization without changing installed capacity. */
  allocationRatio?: number;
}

export interface ResourceFlow {
  resourceId: ResourceId;
  name: string;
  consumed: number;
  produced: number;
  net: number;
  /** Hidden source-product value retained when Recyclables were created. */
  recyclableSourceValueProduced?: number;
}

export type OperatingMode = "fixed" | "balanced";

export interface RegularResult {
  recipe: Recipe;
  moduleId: string;
  capacityPoolId?: string;
  buildingCount: number;
  totalBuildings: number;
  operatingMode: OperatingMode;
  supplyRatio: number;
  speedLevel: number;
  actualInputs: { resourceId: ResourceId; quantity: number }[];
  actualOutputs: { resourceId: ResourceId; quantity: number }[];
  appliedRecyclingEfficiencyPercent: number | null;
  recyclableSourceValueProduced: number;
}

export interface PassiveResult {
  recipe: Recipe;
  moduleId: string;
  buildingCount: number;
  totalBuildings: number;
  actualInputs: { resourceId: ResourceId; quantity: number }[];
  actualOutputs: { resourceId: ResourceId; quantity: number }[];
}

const lineFactor = (line: ProductionLine) => line.buildingCount * line.speedLevel;

const sharedCapacityPriority = (line: ProductionLine) => line.recipe.sharedCapacity?.priority ?? 0;

const orderSharedCapacity = (lines: ProductionLine[]) => {
  const ordered = [...lines];
  const indexesByPool = new Map<string, number[]>();

  for (const [index, line] of ordered.entries()) {
    if (!line.capacityPoolId) continue;

    const indexes = indexesByPool.get(line.capacityPoolId) ?? [];

    indexes.push(index);
    indexesByPool.set(line.capacityPoolId, indexes);
  }

  for (const indexes of indexesByPool.values()) {
    const poolLines = indexes
      .map((index) => ordered[index])
      .filter((line): line is ProductionLine => line != null)
      .toSorted((a, b) => sharedCapacityPriority(a) - sharedCapacityPriority(b));

    indexes.forEach((index, poolIndex) => {
      const line = poolLines[poolIndex];

      if (line) ordered[index] = line;
    });
  }

  return ordered;
};

const orderAllocatedLines = (lines: ProductionLine[]) => orderSharedCapacity(lines)
  .toSorted((a, b) => (
    (a.recipe.allocationPriority ?? 0) - (b.recipe.allocationPriority ?? 0)
  ));

const orderInputPriorities = (lines: ProductionLine[]) => orderSharedCapacity(lines)
  .toSorted((a, b) => {
    const aInputIds = new Set(a.recipe.inputs.map((input) => input.resourceId));

    for (const input of b.recipe.inputs) {
      if (!aInputIds.has(input.resourceId)) continue;

      const aPriority = a.recipe.inputPriorities?.[input.resourceId];
      const bPriority = b.recipe.inputPriorities?.[input.resourceId];

      if (aPriority == null && bPriority == null) continue;

      const difference = (aPriority ?? Number.MAX_SAFE_INTEGER)
        - (bPriority ?? Number.MAX_SAFE_INTEGER);

      if (difference !== 0) return difference;
    }

    return 0;
  });

const createCapacityTracker = (lines: ProductionLine[]) => {
  const remainingByPool = new Map<string, number>();

  for (const line of lines) {
    if (!line.capacityPoolId) continue;

    remainingByPool.set(
      line.capacityPoolId,
      Math.max(remainingByPool.get(line.capacityPoolId) ?? 0, line.buildingCount),
    );
  }

  const availableRatio = (line: ProductionLine) => {
    if (!line.capacityPoolId || line.buildingCount <= 0) return 1;

    return Math.min(
      1,
      Math.max(0, (remainingByPool.get(line.capacityPoolId) ?? 0) / line.buildingCount),
    );
  };

  const use = (line: ProductionLine, ratio: number) => {
    if (!line.capacityPoolId) return;

    const remaining = remainingByPool.get(line.capacityPoolId) ?? 0;

    remainingByPool.set(
      line.capacityPoolId,
      Math.max(0, remaining - line.buildingCount * ratio),
    );
  };

  return { availableRatio, use };
};

const orderDemandBalancedLines = (lines: ProductionLine[]) => {
  const priorityOrderedLines = orderInputPriorities(lines);
  const ordered: ProductionLine[] = [];
  const visiting = new Set<ProductionLine>();
  const visited = new Set<ProductionLine>();

  const visit = (line: ProductionLine) => {
    if (visited.has(line) || visiting.has(line)) return;

    visiting.add(line);
    const outputIds = new Set(line.recipe.outputs.map((output) => output.resourceId));

    for (const possibleConsumer of priorityOrderedLines) {
      if (
        possibleConsumer !== line
        && possibleConsumer.recipe.inputs.some((input) => outputIds.has(input.resourceId))
      ) {
        visit(possibleConsumer);
      }
    }

    visiting.delete(line);
    visited.add(line);
    ordered.push(line);
  };

  for (const line of priorityOrderedLines) visit(line);

  return ordered;
};

const orderSupplyBalancedLines = (lines: ProductionLine[]) => {
  const priorityOrderedLines = orderInputPriorities(lines);
  const ordered: ProductionLine[] = [];
  const visiting = new Set<ProductionLine>();
  const visited = new Set<ProductionLine>();

  const visit = (line: ProductionLine) => {
    if (visited.has(line) || visiting.has(line)) return;

    visiting.add(line);
    const balanceInputIds = line.recipe.balanceInputIds
      ? new Set(line.recipe.balanceInputIds)
      : null;
    const inputIds = new Set(line.recipe.inputs
      .filter((input) => !balanceInputIds || balanceInputIds.has(input.resourceId))
      .map((input) => input.resourceId));

    for (const possibleProducer of priorityOrderedLines) {
      if (
        possibleProducer !== line
        && possibleProducer.recipe.outputs.some((output) => inputIds.has(output.resourceId))
      ) {
        visit(possibleProducer);
      }
    }

    visiting.delete(line);
    visited.add(line);
    ordered.push(line);
  };

  for (const line of priorityOrderedLines) visit(line);

  return ordered;
};

export const getAppliedRecyclingEfficiencyPercent = (recipe: Recipe, globalEfficiencyPercent: number) => {
  const createsRecyclables = recipe.outputs.some((output) => output.resourceId === "recyclables");

  if (!createsRecyclables) return null;

  return recipe.appliesRecyclingEfficiency === false
    ? 100
    : Math.min(100, Math.max(0, globalEfficiencyPercent));
};

interface InternalFlow {
  consumed: number;
  produced: number;
  recyclableSourcesConsumed: Map<ResourceId, number>;
  recyclableSourcesProduced: Map<ResourceId, number>;
}

type FlowMap = Map<ResourceId, InternalFlow>;

const makeGetFlow = (flows: FlowMap) => (id: ResourceId) => {
  const f = flows.get(id) ?? {
    consumed: 0,
    produced: 0,
    recyclableSourcesConsumed: new Map<ResourceId, number>(),
    recyclableSourcesProduced: new Map<ResourceId, number>(),
  };

  flows.set(id, f);
  return f;
};

export const calculateNet = (
  lines: ProductionLine[],
  externalInputs: Partial<Record<ResourceId, number>> = {},
  recyclingEfficiencyPercent: number = baseConfig.recyclingEfficiencyPercent,
  outputModifiers: RecipeModifierMultipliers = {},
  externalDemands: Partial<Record<ResourceId, number>> = {},
) => {
  const regularLines = lines.filter((l) => l.recipe.group !== "source" && l.recipe.group !== "sink");
  const sourceLines = lines.filter((l) => l.recipe.group === "source");
  const sinkLines = lines.filter((l) => l.recipe.group === "sink");

  const allocatedLines = regularLines.filter((line) => line.allocationRatio != null);
  const fixedLines = regularLines.filter((line) => (
    line.operatingMode === "fixed" && line.allocationRatio == null
  ));
  const balancedLines = regularLines.filter((line) => (
    line.operatingMode === "balanced" && line.allocationRatio == null
  ));
  const fallbackLines = orderAllocatedLines(
    balancedLines.filter((line) => line.recipe.allocation === "fallback"),
  );
  const surplusLines = orderAllocatedLines(
    balancedLines.filter((line) => line.recipe.allocation === "surplus"),
  );
  const primaryBalancedLines = balancedLines.filter(
    (line) => line.recipe.allocation !== "fallback" && line.recipe.allocation !== "surplus",
  );
  const supplyBalancedLines = orderSupplyBalancedLines(
    primaryBalancedLines.filter((line) => line.recipe.balanceBy !== "output"),
  );
  const demandBalancedLines = orderDemandBalancedLines(
    primaryBalancedLines.filter((line) => line.recipe.balanceBy === "output"),
  );
  const demandProducedIds = new Set(
    demandBalancedLines.flatMap((line) => (
      line.recipe.outputs.map((output) => output.resourceId)
    )),
  );

  const externalEntries = typedEntries(externalInputs);
  const externalDemandEntries = typedEntries(externalDemands);
  const externalIds = new Set(externalEntries.map(([id]) => id));
  const internallyProducedIds = new Set(
    lines.flatMap((line) => line.recipe.outputs.map((output) => output.resourceId)),
  );
  const sourceOutputCapacities = new Map<ProductionLine, Map<ResourceId, number>>();
  const totalSourceCapacityByResource = new Map<ResourceId, number>();
  const setSourceOutputCapacity = (
    line: ProductionLine,
    resourceId: ResourceId,
    quantity: number,
  ) => {
    const capacities = sourceOutputCapacities.get(line) ?? new Map<ResourceId, number>();

    capacities.set(resourceId, quantity);
    sourceOutputCapacities.set(line, capacities);
    totalSourceCapacityByResource.set(
      resourceId,
      (totalSourceCapacityByResource.get(resourceId) ?? 0) + quantity,
    );
  };

  // ── Pass 1: full-capacity simulation to find truly constrained resources ──
  const simFlows: FlowMap = new Map();
  const simGet = makeGetFlow(simFlows);

  // External inputs as virtual sources
  for (const [id, qty] of externalEntries) {
    simGet(id).produced += qty;
  }
  // Factory consumers such as contracts participate in the same demand graph
  // as recipes, allowing upstream modules to balance their production.
  for (const [id, qty] of externalDemandEntries) {
    simGet(id).consumed += qty;
  }

  for (const line of sourceLines.filter((source) => source.recipe.sourceMode == null)) {
    const m = lineFactor(line);

    for (const output of line.recipe.outputs) {
      const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;

      simGet(output.resourceId).produced += capacity;
      setSourceOutputCapacity(line, output.resourceId, capacity);
    }
  }
  for (const line of regularLines) {
    const m = lineFactor(line);

    for (const input of line.recipe.inputs) {
      simGet(input.resourceId).consumed += getRecipeInputQuantity(input, outputModifiers) * m;
    }
    for (const output of line.recipe.outputs) {
      simGet(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }

  // Demand sources are effectively unbounded during allocation. Their final
  // output is reduced after regular production has supplied what it can.
  for (const line of sourceLines.filter((source) => source.recipe.sourceMode === "demand")) {
    for (const output of line.recipe.outputs) {
      const flow = simGet(output.resourceId);
      const capacity = line.buildingCount > 0 ? flow.consumed : 0;

      flow.produced += capacity;
      setSourceOutputCapacity(line, output.resourceId, capacity);
    }
  }
  for (const line of sourceLines.filter((source) => source.recipe.sourceMode === "demand-capped")) {
    const m = lineFactor(line);

    for (const output of line.recipe.outputs) {
      const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;

      simGet(output.resourceId).produced += capacity;
      setSourceOutputCapacity(line, output.resourceId, capacity);
    }
  }

  const constrained = new Set<ResourceId>();

  for (const [id, flow] of simFlows) {
    if (
      flow.consumed > flow.produced
      && (internallyProducedIds.has(id) || externalIds.has(id))
    ) {
      constrained.add(id);
    }
  }

  // ── Pass 2: actual allocation with priority for constrained resources only ──
  const flows: FlowMap = new Map();
  const getFlow = makeGetFlow(flows);

  // External inputs as virtual sources
  for (const [id, qty] of externalEntries) {
    getFlow(id).produced += qty;
  }
  for (const [id, qty] of externalDemandEntries) {
    getFlow(id).consumed += qty;
  }

  // Sources reserve enough supply for allocation. Unused output is removed
  // after regular production has been calculated.
  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) {
      const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;

      getFlow(output.resourceId).produced += capacity;
    }
  }

  const allocationRatios = new Map<ProductionLine, number>();
  const createdRecyclableSources = new Map<ProductionLine, Map<ResourceId, number>>();
  const sortedRecyclableSources = new Map<ProductionLine, Map<ResourceId, number>>();
  const capacityTracker = createCapacityTracker(regularLines);
  const applyRegularLine = (line: ProductionLine, ratio: number, additive = false) => {
    allocationRatios.set(
      line,
      (additive ? (allocationRatios.get(line) ?? 0) : 0) + ratio,
    );
    capacityTracker.use(line, ratio);

    const multiplier = lineFactor(line) * ratio;

    const sortedSources = new Map<ResourceId, number>();
    const recyclableInput = line.recipe.sortsRecyclableSources
      ? line.recipe.inputs.find((input) => input.resourceId === "recyclables")
      : undefined;

    for (const input of line.recipe.inputs) {
      const flow = getFlow(input.resourceId);
      const inputQuantity = getRecipeInputQuantity(input, outputModifiers);
      const actualQuantity = inputQuantity * multiplier;

      if (input === recyclableInput) {
        const physicalAvailable = Math.max(0, flow.produced - flow.consumed);
        const consumedShare = physicalAvailable > 0
          ? Math.min(1, actualQuantity / physicalAvailable)
          : 0;

        for (const [resourceId, produced] of flow.recyclableSourcesProduced) {
          const consumed = flow.recyclableSourcesConsumed.get(resourceId) ?? 0;
          const quantity = Math.max(0, produced - consumed) * consumedShare;

          flow.recyclableSourcesConsumed.set(resourceId, consumed + quantity);
          sortedSources.set(resourceId, quantity);
        }

        sortedRecyclableSources.set(line, sortedSources);
      }

      flow.consumed += actualQuantity;
    }
    for (const output of line.recipe.outputs) {
      const outputQuantity = getRecipeOutputQuantity(line.recipe, output, outputModifiers);
      const actualQuantity = recyclableInput
        ? (sortedSources.get(output.resourceId) ?? 0)
        : outputQuantity * multiplier;
      const flow = getFlow(output.resourceId);

      flow.produced += actualQuantity;

      if (output.resourceId === "recyclables") {
        const efficiency = getAppliedRecyclingEfficiencyPercent(
          line.recipe,
          recyclingEfficiencyPercent,
        ) ?? 100;
        const sourceComposition = new Map<ResourceId, number>();

        for (const input of line.recipe.inputs) {
          const inputResource: Resource = resources[input.resourceId];
          const inputQuantity = getRecipeInputQuantity(input, outputModifiers);

          for (const [resourceId, sourceQuantity] of typedEntries(
            inputResource.recyclableSources ?? {},
          )) {
            const quantity = sourceQuantity * inputQuantity * multiplier * efficiency / 100;

            sourceComposition.set(
              resourceId,
              (sourceComposition.get(resourceId) ?? 0) + quantity,
            );
            flow.recyclableSourcesProduced.set(
              resourceId,
              (flow.recyclableSourcesProduced.get(resourceId) ?? 0) + quantity,
            );
          }
        }

        createdRecyclableSources.set(line, sourceComposition);
      }
    }
  };

  // Fixed recipes reserve their physical building capacity first.
  for (const line of orderSharedCapacity(fixedLines)) {
    applyRegularLine(line, capacityTracker.availableRatio(line));
  }

  // Factory-wide dispatch assigns utilization while preserving installed count.
  for (const line of orderSharedCapacity(allocatedLines)) {
    const requestedRatio = Math.min(1, Math.max(0, line.allocationRatio ?? 0));

    applyRegularLine(line, Math.min(requestedRatio, capacityTracker.availableRatio(line)));
  }

  // Ordinary supply-balanced recipes retain the existing constrained-resource
  // behavior. Shared fallback recipes are deferred until primary demand is known.
  for (const line of supplyBalancedLines) {
    if (line.buildingCount === 0) {
      applyRegularLine(line, 0);
      continue;
    }

    const factor = lineFactor(line);
    let ratio = capacityTracker.availableRatio(line);

    for (const input of line.recipe.inputs) {
      const explicitlyInputBalanced = line.recipe.balanceInputIds?.includes(input.resourceId) ?? false;

      if (
        line.recipe.balanceInputIds
        && !explicitlyInputBalanced
      ) {
        continue;
      }
      // Output-balanced producers run in the later demand-propagation pass. Let
      // their products go temporarily negative here so downstream demand can
      // start them; explicit input-balancing still requires available stock.
      if (demandProducedIds.has(input.resourceId) && !explicitlyInputBalanced) continue;
      if (line.recipe.balanceBy !== "input" && !constrained.has(input.resourceId)) continue;

      const flow = getFlow(input.resourceId);
      const available = flow.produced - flow.consumed;
      const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

      if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
    }

    applyRegularLine(line, ratio);
  }

  // Propagate demand from consumers to producers. Internally produced inputs are
  // intentionally allowed to go temporarily negative because their upstream
  // recipes run later in this downstream-to-upstream pass. An explicit external
  // supply with no internal producer (including zero) remains a hard limit.
  for (const line of demandBalancedLines) {
    if (line.buildingCount === 0) {
      applyRegularLine(line, 0);
      continue;
    }

    const factor = lineFactor(line);
    let ratio = capacityTracker.availableRatio(line);

    for (const input of line.recipe.inputs) {
      if (line.recipe.balanceInputIds?.includes(input.resourceId)) {
        const flow = getFlow(input.resourceId);
        const available = flow.produced - flow.consumed;
        const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

        if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
        continue;
      }
      if (!externalIds.has(input.resourceId) || internallyProducedIds.has(input.resourceId)) continue;

      const flow = getFlow(input.resourceId);
      const available = flow.produced - flow.consumed;
      const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

      if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
    }

    const outputDemandRatios = line.recipe.outputs.flatMap((output) => {
      if (
        line.recipe.balanceOutputIds
        && !line.recipe.balanceOutputIds.includes(output.resourceId)
      ) {
        return [];
      }

      const flow = flows.get(output.resourceId);
      const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

      if (!flow || flow.consumed <= 0 || capacity <= 0) return [];

      // Source recipes (map/world mines) are fallback streams. Their reserved
      // capacity must not hide demand from internal producers; unused source
      // capacity is removed after regular production has been allocated.
      const internallyProduced = flow.produced
        - (totalSourceCapacityByResource.get(output.resourceId) ?? 0);

      return [Math.max(0, flow.consumed - internallyProduced) / capacity];
    });

    ratio = outputDemandRatios.length > 0
      ? Math.min(ratio, Math.max(...outputDemandRatios))
      : 0;

    applyRegularLine(line, ratio);
  }

  const applyLowerPriorityLines = (linesToApply: ProductionLine[]) => {
    for (const line of linesToApply) {
      if (line.buildingCount === 0) {
        applyRegularLine(line, 0);
        continue;
      }

      const factor = lineFactor(line);
      let ratio = capacityTracker.availableRatio(line);

      for (const input of line.recipe.inputs) {
        const explicitlyInputBalanced = line.recipe.balanceInputIds?.includes(input.resourceId) ?? false;

        if (
          line.recipe.balanceInputIds
          && !explicitlyInputBalanced
          && internallyProducedIds.has(input.resourceId)
        ) {
          continue;
        }

        const flow = getFlow(input.resourceId);
        const available = flow.produced - flow.consumed;
        const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

        if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
      }

      if (line.recipe.balanceBy === "output") {
        const outputDemandRatios = line.recipe.outputs.flatMap((output) => {
          if (
            line.recipe.balanceOutputIds
            && !line.recipe.balanceOutputIds.includes(output.resourceId)
          ) {
            return [];
          }

          const flow = flows.get(output.resourceId);
          const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

          if (!flow || flow.consumed <= 0 || capacity <= 0) return [];

          const internallyProduced = flow.produced
            - (totalSourceCapacityByResource.get(output.resourceId) ?? 0);

          return [Math.max(0, flow.consumed - internallyProduced) / capacity];
        });

        ratio = outputDemandRatios.length > 0
          ? Math.min(ratio, Math.max(...outputDemandRatios))
          : 0;
      }

      applyRegularLine(line, ratio);
    }
  };
  const propagateAdditionalDemand = () => {
    for (let iteration = 0; iteration < demandBalancedLines.length; iteration += 1) {
      let changed = false;

      for (const line of demandBalancedLines) {
        if (line.buildingCount === 0) continue;

        const factor = lineFactor(line);
        const remainingLineRatio = Math.max(
          0,
          1 - (allocationRatios.get(line) ?? 0),
        );
        let ratio = Math.min(
          remainingLineRatio,
          capacityTracker.availableRatio(line),
        );

        for (const input of line.recipe.inputs) {
          if (line.recipe.balanceInputIds?.includes(input.resourceId)) {
            const flow = getFlow(input.resourceId);
            const available = flow.produced - flow.consumed;
            const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

            if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
            continue;
          }
          if (!externalIds.has(input.resourceId) || internallyProducedIds.has(input.resourceId)) continue;

          const flow = getFlow(input.resourceId);
          const available = flow.produced - flow.consumed;
          const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

          if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
        }

        const outputDemandRatios = line.recipe.outputs.flatMap((output) => {
          if (
            line.recipe.balanceOutputIds
            && !line.recipe.balanceOutputIds.includes(output.resourceId)
          ) {
            return [];
          }

          const flow = flows.get(output.resourceId);
          const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

          if (!flow || flow.consumed <= 0 || capacity <= 0) return [];

          const internallyProduced = flow.produced
            - (totalSourceCapacityByResource.get(output.resourceId) ?? 0);

          return [Math.max(0, flow.consumed - internallyProduced) / capacity];
        });

        ratio = outputDemandRatios.length > 0
          ? Math.min(ratio, Math.max(...outputDemandRatios))
          : 0;

        if (ratio <= 1e-9) continue;

        applyRegularLine(line, ratio, true);
        changed = true;
      }

      if (!changed) break;
    }
  };

  // Fallbacks may create supporting demand (for example Sour Water recovery
  // needs Steam). Resolve that demand before final surplus converters run.
  applyLowerPriorityLines(fallbackLines);
  propagateAdditionalDemand();
  applyLowerPriorityLines(surplusLines);
  propagateAdditionalDemand();

  // Regular results
  const regularResults: RegularResult[] = regularLines.map((line) => ({
    recipe: line.recipe,
    moduleId: line.moduleId,
    capacityPoolId: line.capacityPoolId,
    buildingCount: line.buildingCount,
    totalBuildings: line.totalBuildings,
    operatingMode: line.operatingMode,
    supplyRatio: allocationRatios.get(line) ?? 0,
    speedLevel: line.speedLevel,
    actualInputs: line.recipe.inputs.map((input) => ({
      resourceId: input.resourceId,
      quantity: getRecipeInputQuantity(input, outputModifiers)
        * lineFactor(line)
        * (allocationRatios.get(line) ?? 0),
    })),
    actualOutputs: line.recipe.outputs.map((output) => {
      const recyclableInput = line.recipe.sortsRecyclableSources
        ? line.recipe.inputs.find((input) => input.resourceId === "recyclables")
        : undefined;
      const quantity = recyclableInput
        ? (sortedRecyclableSources.get(line)?.get(output.resourceId) ?? 0)
        : getRecipeOutputQuantity(line.recipe, output, outputModifiers)
          * lineFactor(line)
          * (allocationRatios.get(line) ?? 0);

      return { resourceId: output.resourceId, quantity };
    }),
    appliedRecyclingEfficiencyPercent: getAppliedRecyclingEfficiencyPercent(
      line.recipe,
      recyclingEfficiencyPercent,
    ),
    recyclableSourceValueProduced: [
      ...(createdRecyclableSources.get(line)?.values() ?? []),
    ].reduce((total, quantity) => total + quantity, 0),
  }));

  // Sources are fallback streams: internal production is retained first, then
  // sources are allocated in declaration order to cover only what remains.
  const remainingSourceDemand = new Map<ResourceId, number>();

  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) {
      if (remainingSourceDemand.has(output.resourceId)) continue;

      const flow = getFlow(output.resourceId);
      const totalSourceCapacity = sourceLines.reduce((total, source) => {
        return total + (sourceOutputCapacities.get(source)?.get(output.resourceId) ?? 0);
      }, 0);
      const internallyProduced = flow.produced - totalSourceCapacity;

      remainingSourceDemand.set(
        output.resourceId,
        Math.max(0, flow.consumed - internallyProduced),
      );
    }
  }

  const sourceResults: PassiveResult[] = sourceLines.map((line) => {
    const actualOutputs = line.recipe.outputs.map((output) => {
      const flow = getFlow(output.resourceId);
      const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;
      const remaining = remainingSourceDemand.get(output.resourceId) ?? 0;
      const actualUsed = Math.min(capacity, remaining);

      flow.produced -= capacity - actualUsed;
      remainingSourceDemand.set(output.resourceId, remaining - actualUsed);

      return { resourceId: output.resourceId, quantity: actualUsed };
    });
    const sourceScale = actualOutputs.reduce((maximum, actual) => {
      const declared = line.recipe.outputs.find(
        (output) => output.resourceId === actual.resourceId,
      );
      const declaredQuantity = declared
        ? getRecipeOutputQuantity(line.recipe, declared, outputModifiers)
        : 0;

      return declaredQuantity > 0
        ? Math.max(maximum, actual.quantity / declaredQuantity)
        : maximum;
    }, 0);
    const actualInputs = line.recipe.inputs.map((input) => {
      const quantity = getRecipeInputQuantity(input, outputModifiers) * sourceScale;

      getFlow(input.resourceId).consumed += quantity;

      return { resourceId: input.resourceId, quantity };
    });

    return {
      recipe: line.recipe,
      moduleId: line.moduleId,
      buildingCount: line.buildingCount,
      totalBuildings: line.totalBuildings,
      actualInputs,
      actualOutputs,
    };
  });

  // Sinks absorb excess (sequential priority)
  const sinkResults: PassiveResult[] = [];

  for (const line of sinkLines) {
    if (line.buildingCount === 0) {
      sinkResults.push({ recipe: line.recipe, moduleId: line.moduleId, buildingCount: 0, totalBuildings: line.totalBuildings, actualInputs: [], actualOutputs: [] });
      continue;
    }

    const capacity = lineFactor(line);
    let utilizationRatio = line.recipe.sinkMode === "unbounded"
      ? Number.POSITIVE_INFINITY
      : 1;

    for (const input of line.recipe.inputs) {
      const f = getFlow(input.resourceId);
      const excess = f.produced - f.consumed;

      if (excess <= 0) { utilizationRatio = 0; break; }
      utilizationRatio = Math.min(
        utilizationRatio,
        excess / (getRecipeInputQuantity(input, outputModifiers) * capacity),
      );
    }

    if (utilizationRatio <= 1e-9) utilizationRatio = 0;

    const actualInputs: PassiveResult["actualInputs"] = [];
    const actualOutputs: PassiveResult["actualOutputs"] = [];

    if (utilizationRatio > 0) {
      for (const input of line.recipe.inputs) {
        const actual = getRecipeInputQuantity(input, outputModifiers)
          * capacity
          * utilizationRatio;

        getFlow(input.resourceId).consumed += actual;
        actualInputs.push({ resourceId: input.resourceId, quantity: actual });
      }
      for (const output of line.recipe.outputs) {
        const actual = getRecipeOutputQuantity(line.recipe, output, outputModifiers)
          * capacity
          * utilizationRatio;

        getFlow(output.resourceId).produced += actual;
        actualOutputs.push({ resourceId: output.resourceId, quantity: actual });
      }
    }

    sinkResults.push({ recipe: line.recipe, moduleId: line.moduleId, buildingCount: line.buildingCount, totalBuildings: line.totalBuildings, actualInputs, actualOutputs });
  }

  // Excess-processing recipes can create useful byproducts after sources were
  // allocated (for example, cooling towers return Water). Let those late
  // outputs displace demand sources instead of leaving artificial surplus.
  // Reverse order preserves the source declaration priority used above.
  for (const [resourceId, flow] of flows) {
    let excess = Math.max(0, flow.produced - flow.consumed);

    if (excess <= 1e-9) continue;

    for (const result of sourceResults.toReversed()) {
      if (!result.recipe.sourceMode || excess <= 1e-9) continue;

      const actualOutput = result.actualOutputs.find(
        (output) => output.resourceId === resourceId,
      );

      if (!actualOutput || actualOutput.quantity <= 0) continue;

      const previousScale = result.actualOutputs.reduce((maximum, actual) => {
        const declared = result.recipe.outputs.find(
          (output) => output.resourceId === actual.resourceId,
        );
        const declaredQuantity = declared
          ? getRecipeOutputQuantity(result.recipe, declared, outputModifiers)
          : 0;

        return declaredQuantity > 0
          ? Math.max(maximum, actual.quantity / declaredQuantity)
          : maximum;
      }, 0);
      const reduction = Math.min(actualOutput.quantity, excess);

      actualOutput.quantity -= reduction;
      flow.produced -= reduction;
      excess -= reduction;

      const nextScale = result.actualOutputs.reduce((maximum, actual) => {
        const declared = result.recipe.outputs.find(
          (output) => output.resourceId === actual.resourceId,
        );
        const declaredQuantity = declared
          ? getRecipeOutputQuantity(result.recipe, declared, outputModifiers)
          : 0;

        return declaredQuantity > 0
          ? Math.max(maximum, actual.quantity / declaredQuantity)
          : maximum;
      }, 0);

      if (nextScale >= previousScale) continue;

      for (const actualInput of result.actualInputs) {
        const declared = result.recipe.inputs.find(
          (input) => input.resourceId === actualInput.resourceId,
        );

        if (!declared) continue;

        const nextQuantity = getRecipeInputQuantity(declared, outputModifiers) * nextScale;

        getFlow(actualInput.resourceId).consumed -= actualInput.quantity - nextQuantity;
        actualInput.quantity = nextQuantity;
      }
    }
  }

  // Identify source-produced resources
  const sourceResourceIds = new Set<ResourceId>();

  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) sourceResourceIds.add(output.resourceId);
  }

  const resourceFlows: ResourceFlow[] = [];
  const allResourceFlows: ResourceFlow[] = [];
  const recyclableSourceValueProduced = regularResults.reduce((total, result) => {
    return total + result.recyclableSourceValueProduced;
  }, 0);

  for (const [resourceId, { consumed, produced }] of flows) {
    const net = produced - consumed;
    const recyclingMetadata = resourceId === "recyclables"
      ? { recyclableSourceValueProduced }
      : {};

    allResourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });

    if (externalIds.has(resourceId)) {
      // External inputs: only show deficit beyond declared external supply
      if (net < -0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });
      }
    } else if (sourceResourceIds.has(resourceId)) {
      // Source resources: only show deficit (from simulation), hide surplus
      if (constrained.has(resourceId)) {
        const sim = simFlows.get(resourceId) ?? { produced: 0, consumed: 0 };
        const deficit = sim.produced - sim.consumed;

        if (deficit < -0.001) {
          resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed: sim.consumed, produced: sim.produced, net: deficit, ...recyclingMetadata });
        }
      }
    } else {
      if (Math.abs(net) > 0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });
      }
    }
  }

  return { resourceFlows, allResourceFlows, regularResults, sourceResults, sinkResults };
};
