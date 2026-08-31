import { baseConfig } from "../../db/config";
import {
  isModuleScopedSourceMode,
  isUnboundedDemandSourceMode,
  type Recipe,
} from "../../db/recipes";
import { type Resource, type ResourceId, resources } from "../../db/resources";
import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../modifiers/recipe-output";
import { type ValueSource } from "../resolve-layered-value/resolve-layered-value";
import { typedEntries } from "../typed-entries/typed-entries";

export interface ProductionLine {
  recipe: Recipe;
  moduleId: string;
  /** Provenance of this actionable recipe value, when explicitly layered. */
  dataSource?: ValueSource;
  /** Module-scoped identity for recipes sharing the same installed buildings. */
  capacityPoolId?: string;
  /** Distinct active physical buildings in the shared pool. */
  capacityPoolActiveBuildings?: number;
  /** Distinct built physical buildings in the shared pool. */
  capacityPoolBuiltBuildings?: number;
  /** Current active physical buildings in the shared pool. */
  capacityPoolCurrentActiveBuildings?: number;
  /** Distinct construction ghosts in the shared pool. */
  capacityPoolConstructionGhosts?: number;
  /** Distinct planned buildings in the shared pool that have not been placed. */
  capacityPoolUnplacedPlannedBuildings?: number;
  /** Unpaused physical buildings available to this recipe or shared pool. */
  activeBuildings: number;
  /** Current active buildings, excluding projected construction and plans. */
  currentActiveBuildings?: number;
  /** Physical buildings present, including paused buildings. */
  builtBuildings: number;
  /** Observable construction ghosts included in activeBuildings. */
  constructionGhosts?: number;
  /** Planned buildings not yet represented by a construction ghost. */
  unplacedPlannedBuildings?: number;
  speedLevel: number;
  operatingMode: OperatingMode;
  /** Factory-wide dispatch can assign a utilization without changing installed capacity. */
  allocationRatio?: number;
  /** Explicit private supplies that can start this consumer without output demand. */
  drivingInputIds?: ResourceId[];
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
  dataSource?: ValueSource;
  capacityPoolId?: string;
  capacityPoolActiveBuildings?: number;
  capacityPoolBuiltBuildings?: number;
  capacityPoolCurrentActiveBuildings?: number;
  capacityPoolConstructionGhosts?: number;
  capacityPoolUnplacedPlannedBuildings?: number;
  activeBuildings: number;
  currentActiveBuildings?: number;
  builtBuildings: number;
  constructionGhosts?: number;
  unplacedPlannedBuildings?: number;
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
  dataSource?: ValueSource;
  capacityPoolId?: string;
  capacityPoolActiveBuildings?: number;
  capacityPoolBuiltBuildings?: number;
  capacityPoolCurrentActiveBuildings?: number;
  capacityPoolConstructionGhosts?: number;
  capacityPoolUnplacedPlannedBuildings?: number;
  activeBuildings: number;
  currentActiveBuildings?: number;
  builtBuildings: number;
  constructionGhosts?: number;
  unplacedPlannedBuildings?: number;
  supplyRatio: number;
  actualInputs: { resourceId: ResourceId; quantity: number }[];
  actualOutputs: { resourceId: ResourceId; quantity: number }[];
}

const lineFactor = (line: ProductionLine) => line.activeBuildings * line.speedLevel;

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

const orderSurplusConsumers = (lines: ProductionLine[]) => orderSharedCapacity(lines)
  .toSorted((a, b) => (
    (a.recipe.surplusConsumptionPriority ?? 0)
    - (b.recipe.surplusConsumptionPriority ?? 0)
  ));

const orderInputPriorities = (lines: ProductionLine[]) => {
  const sharedCapacityOrderedLines = orderSharedCapacity(lines);
  const inputIdsByLine = new Map(sharedCapacityOrderedLines.map((line) => [
    line,
    new Set(line.recipe.inputs.map((input) => input.resourceId)),
  ]));

  return sharedCapacityOrderedLines.toSorted((a, b) => {
    const aInputIds = inputIdsByLine.get(a);

    if (!aInputIds) return 0;

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
};

const indexLineResources = (
  lines: readonly ProductionLine[],
  getResourceIds: (line: ProductionLine) => readonly ResourceId[],
) => {
  const indexesByResourceId = new Map<ResourceId, number[]>();

  for (const [index, line] of lines.entries()) {
    for (const resourceId of new Set(getResourceIds(line))) {
      const indexes = indexesByResourceId.get(resourceId) ?? [];

      indexes.push(index);
      indexesByResourceId.set(resourceId, indexes);
    }
  }

  return indexesByResourceId;
};

const getRelatedLineIndexes = (
  resourceIds: ReadonlySet<ResourceId>,
  indexesByResourceId: ReadonlyMap<ResourceId, readonly number[]>,
) => {
  const indexes = new Set<number>();

  for (const resourceId of resourceIds) {
    for (const index of indexesByResourceId.get(resourceId) ?? []) indexes.add(index);
  }

  return [...indexes].toSorted((a, b) => a - b);
};

interface CachedLineOrder {
  lines: readonly ProductionLine[];
  ordered: ProductionLine[];
}

const demandLineOrderCache = new WeakMap<ProductionLine, CachedLineOrder>();
const supplyLineOrderCache = new WeakMap<ProductionLine, CachedLineOrder>();

const getCachedLineOrder = (
  cache: WeakMap<ProductionLine, CachedLineOrder>,
  lines: readonly ProductionLine[],
  calculate: () => ProductionLine[],
) => {
  const firstLine = lines[0];

  if (!firstLine) return [];

  const cached = cache.get(firstLine);

  if (
    cached?.lines.length === lines.length
    && lines.every((line, index) => cached.lines[index] === line)
  ) {
    return cached.ordered;
  }

  const ordered = calculate();

  cache.set(firstLine, { lines: [...lines], ordered });
  return ordered;
};

const createCapacityTracker = (lines: ProductionLine[]) => {
  const remainingByPool = new Map<string, number>();

  for (const line of lines) {
    if (!line.capacityPoolId) continue;

    remainingByPool.set(
      line.capacityPoolId,
      Math.max(
        remainingByPool.get(line.capacityPoolId) ?? 0,
        line.capacityPoolActiveBuildings ?? line.activeBuildings,
      ),
    );
  }

  const availableRatio = (line: ProductionLine) => {
    if (!line.capacityPoolId || line.activeBuildings <= 0) return 1;

    return Math.min(
      1,
      Math.max(0, (remainingByPool.get(line.capacityPoolId) ?? 0) / line.activeBuildings),
    );
  };

  const use = (line: ProductionLine, ratio: number) => {
    if (!line.capacityPoolId) return;

    const remaining = remainingByPool.get(line.capacityPoolId) ?? 0;

    remainingByPool.set(
      line.capacityPoolId,
      Math.max(0, remaining - line.activeBuildings * ratio),
    );
  };

  const snapshot = () => new Map(remainingByPool);
  const restore = (state: ReadonlyMap<string, number>) => {
    remainingByPool.clear();

    for (const [poolId, remaining] of state) {
      remainingByPool.set(poolId, remaining);
    }
  };

  return { availableRatio, restore, snapshot, use };
};

const orderDemandBalancedLines = (lines: ProductionLine[]) => getCachedLineOrder(
  demandLineOrderCache,
  lines,
  () => {
    const priorityOrderedLines = orderInputPriorities(lines).toSorted((a, b) => (
      (a.recipe.demandPriority ?? 0) - (b.recipe.demandPriority ?? 0)
    ));
    const ordered: ProductionLine[] = [];
    const visiting = new Set<ProductionLine>();
    const visited = new Set<ProductionLine>();
    const consumerIndexesByInputId = indexLineResources(
      priorityOrderedLines,
      (line) => line.recipe.inputs.map((input) => input.resourceId),
    );

    const visit = (line: ProductionLine) => {
      if (visited.has(line) || visiting.has(line)) return;

      visiting.add(line);
      const outputIds = new Set(line.recipe.outputs.map((output) => output.resourceId));

      for (const index of getRelatedLineIndexes(outputIds, consumerIndexesByInputId)) {
        const possibleConsumer = priorityOrderedLines[index];

        if (possibleConsumer && possibleConsumer !== line) visit(possibleConsumer);
      }

      visiting.delete(line);
      visited.add(line);
      ordered.push(line);
    };

    for (const line of priorityOrderedLines) visit(line);

    return ordered;
  },
);

const orderSupplyBalancedLines = (lines: ProductionLine[]) => getCachedLineOrder(
  supplyLineOrderCache,
  lines,
  () => {
    const priorityOrderedLines = orderInputPriorities(lines);
    const ordered: ProductionLine[] = [];
    const visiting = new Set<ProductionLine>();
    const visited = new Set<ProductionLine>();
    const producerIndexesByOutputId = indexLineResources(
      priorityOrderedLines,
      (line) => line.recipe.outputs.map((output) => output.resourceId),
    );

    const visit = (line: ProductionLine) => {
      if (visited.has(line) || visiting.has(line)) return;

      visiting.add(line);
      const balanceInputIds = line.recipe.balanceInputIds
        ? new Set(line.recipe.balanceInputIds)
        : null;
      const inputIds = new Set(line.recipe.inputs
        .filter((input) => !balanceInputIds || balanceInputIds.has(input.resourceId))
        .map((input) => input.resourceId));

      for (const index of getRelatedLineIndexes(inputIds, producerIndexesByOutputId)) {
        const possibleProducer = priorityOrderedLines[index];

        if (possibleProducer && possibleProducer !== line) visit(possibleProducer);
      }

      visiting.delete(line);
      visited.add(line);
      ordered.push(line);
    };

    for (const line of priorityOrderedLines) visit(line);

    return ordered;
  },
);

/**
 * A requested module import can force an upstream recipe to run before its
 * ordinary output demand exists. Follow that material through consumers in
 * the same module so their external supporting inputs become factory demand
 * instead of blocking the local production chain.
 */
const getDrivenSupportingResourceIds = (lines: ProductionLine[]) => {
  const result = new Map<string, Set<ResourceId>>();
  const linesByModule = new Map<string, ProductionLine[]>();

  for (const line of lines) {
    const moduleLines = linesByModule.get(line.moduleId) ?? [];

    moduleLines.push(line);
    linesByModule.set(line.moduleId, moduleLines);
  }

  for (const moduleLines of linesByModule.values()) {
    const reachableIds = new Set<ResourceId>();
    const supportingIds = new Set<ResourceId>();

    for (const line of moduleLines) {
      if (line.activeBuildings <= 0 || !line.drivingInputIds?.length) continue;

      const drivingInputIds = new Set(line.drivingInputIds);

      for (const input of line.recipe.inputs) {
        if (!drivingInputIds.has(input.resourceId)) supportingIds.add(input.resourceId);
      }
      for (const output of line.recipe.outputs) reachableIds.add(output.resourceId);
    }

    if (reachableIds.size === 0) continue;

    let changed = true;

    while (changed) {
      changed = false;

      for (const line of moduleLines) {
        if (
          line.activeBuildings <= 0
          || !line.recipe.inputs.some(input => reachableIds.has(input.resourceId))
        ) {
          continue;
        }

        for (const input of line.recipe.inputs) {
          if (!reachableIds.has(input.resourceId)) supportingIds.add(input.resourceId);
        }
        for (const output of line.recipe.outputs) {
          if (reachableIds.has(output.resourceId)) continue;

          reachableIds.add(output.resourceId);
          changed = true;
        }
      }
    }

    const moduleId = moduleLines[0]?.moduleId;

    if (!moduleId) continue;

    const moduleSupportingIds = result.get(moduleId) ?? new Set<ResourceId>();

    for (const resourceId of supportingIds) {
      if (!reachableIds.has(resourceId)) moduleSupportingIds.add(resourceId);
    }

    if (moduleSupportingIds.size > 0) result.set(moduleId, moduleSupportingIds);
  }

  return result;
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
  suppliedResources: Partial<Record<ResourceId, number>> = {},
  recyclingEfficiencyPercent: number = baseConfig.recyclingEfficiencyPercent,
  outputModifiers: RecipeModifierMultipliers = {},
  fixedDemands: Partial<Record<ResourceId, number>> = {},
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
  const effectivePlannedSupportingResourceIds = new Map<string, Set<ResourceId>>();

  for (const [moduleId, resourceIds] of plannedSupportingResourceIds) {
    effectivePlannedSupportingResourceIds.set(moduleId, new Set(resourceIds));
  }
  for (const [moduleId, resourceIds] of getDrivenSupportingResourceIds(lines)) {
    const effectiveIds = effectivePlannedSupportingResourceIds.get(moduleId)
      ?? new Set<ResourceId>();

    for (const resourceId of resourceIds) effectiveIds.add(resourceId);
    effectivePlannedSupportingResourceIds.set(moduleId, effectiveIds);
  }

  const isPlannedSupportingResource = (moduleId: string, resourceId: ResourceId) => (
    effectivePlannedSupportingResourceIds.get(moduleId)?.has(resourceId) ?? false
  );
  const plannedSupportingModuleKeys = new Set(
    [...effectivePlannedSupportingResourceIds].flatMap(([moduleId, resourceIds]) => (
      [...resourceIds].map(resourceId => `${moduleId}:${resourceId}`)
    )),
  );
  const plannedSupportingIds = new Set(
    [...effectivePlannedSupportingResourceIds.values()].flatMap(resourceIds => (
      [...resourceIds]
    )),
  );
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
  const surplusConsumerLines = orderSurplusConsumers(
    balancedLines.filter((line) => (line.recipe.consumeSurplusInputIds?.length ?? 0) > 0),
  );
  const drivenInputLines = orderAllocatedLines(
    balancedLines.filter((line) => (line.drivingInputIds?.length ?? 0) > 0),
  );
  const demandProducedIds = new Set(
    balancedLines
      .filter((line) => line.recipe.balanceBy === "output")
      .flatMap((line) => (
        line.recipe.outputs.map((output) => output.resourceId)
      )),
  );

  const suppliedEntries = typedEntries(suppliedResources);
  const fixedDemandEntries = typedEntries(fixedDemands);
  const suppliedIds = new Set(suppliedEntries.map(([id]) => id));
  const hardSuppliedIds = new Set(
    [...suppliedIds].filter((id) => !nonConstrainingSuppliedResourceIds.has(id)),
  );
  const internallyProducedIds = new Set(
    lines.flatMap((line) => line.recipe.outputs.map((output) => output.resourceId)),
  );
  const sourceOutputCapacities = new Map<ProductionLine, Map<ResourceId, number>>();
  const totalSourceCapacityByResource = new Map<ResourceId, number>();
  const totalModuleSourceCapacityByResource = new Map<string, number>();
  const ownedModuleSupplyCapacityByResource = new Map<string, number>();
  const ownedModuleSupplyKeysByResource = new Map<ResourceId, Set<string>>();
  const moduleScopedInputKeysByResource = new Map<ResourceId, Set<string>>();
  const moduleResourceKey = (moduleId: string, resourceId: ResourceId) => (
    `${moduleId}:${resourceId}`
  );

  for (const line of lines) {
    if (line.recipe.balanceInputScope !== "module") continue;

    const scopedInputIds = line.recipe.balanceInputIds
      ?? line.recipe.inputs.map(input => input.resourceId);

    for (const resourceId of scopedInputIds) {
      const keys = moduleScopedInputKeysByResource.get(resourceId) ?? new Set<string>();

      keys.add(moduleResourceKey(line.moduleId, resourceId));
      moduleScopedInputKeysByResource.set(resourceId, keys);
    }
  }
  const simulatedModuleFlows = new Map<
    string,
    { consumed: number; produced: number }
  >();
  const getSimulatedModuleFlow = (moduleId: string, resourceId: ResourceId) => {
    const key = moduleResourceKey(moduleId, resourceId);
    const flow = simulatedModuleFlows.get(key) ?? { consumed: 0, produced: 0 };

    simulatedModuleFlows.set(key, flow);

    return flow;
  };
  const addOwnedModuleSupplyCapacity = (
    moduleId: string,
    resourceId: ResourceId,
    quantity: number,
  ) => {
    if (quantity <= 0) return;

    const moduleKey = moduleResourceKey(moduleId, resourceId);

    ownedModuleSupplyCapacityByResource.set(
      moduleKey,
      (ownedModuleSupplyCapacityByResource.get(moduleKey) ?? 0) + quantity,
    );
    const sourceKeys = ownedModuleSupplyKeysByResource.get(resourceId) ?? new Set<string>();

    sourceKeys.add(moduleKey);
    ownedModuleSupplyKeysByResource.set(resourceId, sourceKeys);
  };

  for (const [moduleId, supplies] of moduleSuppliedResources) {
    for (const [resourceId, quantity] of typedEntries(supplies)) {
      addOwnedModuleSupplyCapacity(moduleId, resourceId, quantity);
    }
  }
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
    const moduleKey = moduleResourceKey(line.moduleId, resourceId);

    totalModuleSourceCapacityByResource.set(
      moduleKey,
      (totalModuleSourceCapacityByResource.get(moduleKey) ?? 0) + quantity,
    );
    if (
      isModuleScopedSourceMode(line.recipe.sourceMode)
      && line.recipe.sourceKind === "map-mine"
    ) {
      addOwnedModuleSupplyCapacity(line.moduleId, resourceId, quantity);
    }
  };
  const getSourceScale = (
    line: ProductionLine,
    outputQuantities: ReadonlyMap<ResourceId, number>,
  ) => line.recipe.outputs.reduce((maximum, output) => {
    const declaredQuantity = getRecipeOutputQuantity(
      line.recipe,
      output,
      outputModifiers,
    );

    return declaredQuantity > 0
      ? Math.max(maximum, (outputQuantities.get(output.resourceId) ?? 0) / declaredQuantity)
      : maximum;
  }, 0);

  // ── Pass 1: full-capacity simulation to find truly constrained resources ──
  const simFlows: FlowMap = new Map();
  const simGet = makeGetFlow(simFlows);

  // Caller-supplied resources, such as contract imports, are virtual sources.
  for (const [id, qty] of suppliedEntries) {
    simGet(id).produced += qty;
  }
  for (const [moduleId, supplies] of moduleSuppliedResources) {
    for (const [id, qty] of typedEntries(supplies)) {
      getSimulatedModuleFlow(moduleId, id).produced += qty;
    }
  }
  // Factory consumers such as contracts participate in the same demand graph
  // as recipes, allowing upstream modules to balance their production.
  for (const [id, qty] of fixedDemandEntries) {
    simGet(id).consumed += qty;
  }
  for (const [moduleId, demands] of moduleFixedDemands) {
    for (const [id, qty] of typedEntries(demands)) {
      simGet(id).consumed += qty;
      getSimulatedModuleFlow(moduleId, id).consumed += qty;
    }
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
      const quantity = getRecipeInputQuantity(input, outputModifiers) * m;

      simGet(input.resourceId).consumed += quantity;
      getSimulatedModuleFlow(line.moduleId, input.resourceId).consumed += quantity;
    }
    for (const output of line.recipe.outputs) {
      const quantity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;

      simGet(output.resourceId).produced += quantity;
      getSimulatedModuleFlow(line.moduleId, output.resourceId).produced += quantity;
    }
  }

  // Demand sources are effectively unbounded during allocation. Their final
  // output is reduced after regular production has supplied what it can.
  for (const line of sourceLines.filter((source) => (
    isUnboundedDemandSourceMode(source.recipe.sourceMode)
  ))) {
    for (const output of line.recipe.outputs) {
      const flow = simGet(output.resourceId);
      const moduleFlow = getSimulatedModuleFlow(line.moduleId, output.resourceId);
      let capacity = 0;

      if (line.activeBuildings > 0) {
        capacity = isModuleScopedSourceMode(line.recipe.sourceMode)
          ? Math.max(0, moduleFlow.consumed - moduleFlow.produced)
          : flow.consumed;
      }

      flow.produced += capacity;
      setSourceOutputCapacity(line, output.resourceId, capacity);
    }
  }
  for (const line of sourceLines.filter((source) => (
    source.recipe.sourceMode === "demand-capped"
    || source.recipe.sourceMode === "module-demand-capped"
  ))) {
    const m = lineFactor(line);

    for (const output of line.recipe.outputs) {
      const installedCapacity = getRecipeOutputQuantity(
        line.recipe,
        output,
        outputModifiers,
      ) * m;
      const moduleFlow = getSimulatedModuleFlow(line.moduleId, output.resourceId);
      const capacity = line.recipe.sourceMode === "module-demand-capped"
        ? Math.min(
            installedCapacity,
            Math.max(0, moduleFlow.consumed - moduleFlow.produced),
          )
        : installedCapacity;

      simGet(output.resourceId).produced += capacity;
      setSourceOutputCapacity(line, output.resourceId, capacity);
    }
  }

  // Sources with material inputs reserve those inputs before surplus recipes
  // are allocated. Forestry is demand-driven by Wood, so its Tree Saplings
  // must be retained before a Shredder can consume the remaining farm output.
  for (const line of sourceLines) {
    const sourceScale = getSourceScale(
      line,
      sourceOutputCapacities.get(line) ?? new Map(),
    );

    for (const input of line.recipe.inputs) {
      const quantity = getRecipeInputQuantity(input, outputModifiers) * sourceScale;

      simGet(input.resourceId).consumed += quantity;
      getSimulatedModuleFlow(line.moduleId, input.resourceId).consumed += quantity;
    }
  }

  const constrained = new Set<ResourceId>();

  for (const [id, flow] of simFlows) {
    if (
      flow.consumed > flow.produced
      && (internallyProducedIds.has(id) || hardSuppliedIds.has(id))
    ) {
      constrained.add(id);
    }
  }

  // ── Pass 2: actual allocation with priority for constrained resources only ──
  let flows: FlowMap = new Map();
  let getFlow = makeGetFlow(flows);
  let actualModuleFlows = new Map<
    string,
    { consumed: number; produced: number }
  >();
  const getActualModuleFlow = (moduleId: string, resourceId: ResourceId) => {
    const key = moduleResourceKey(moduleId, resourceId);
    const flow = actualModuleFlows.get(key) ?? { consumed: 0, produced: 0 };

    actualModuleFlows.set(key, flow);

    return flow;
  };
  const getUnreservedGlobalInput = (resourceId: ResourceId) => {
    const globalFlow = getFlow(resourceId);
    const reservedModuleKeys = new Set([
      ...(ownedModuleSupplyKeysByResource.get(resourceId) ?? []),
      ...(moduleScopedInputKeysByResource.get(resourceId) ?? []),
    ]);
    const unavailableModuleSupply = [...reservedModuleKeys]
      .reduce((total, key) => {
        const capacity = ownedModuleSupplyCapacityByResource.get(key) ?? 0;
        const moduleFlow = actualModuleFlows.get(key) ?? { consumed: 0, produced: 0 };
        const nonSourceProduction = moduleFlow.produced - capacity;
        const localSourceDemand = Math.max(0, moduleFlow.consumed - nonSourceProduction);
        const locallyUsed = Math.min(capacity, localSourceDemand);
        const unusedOwnedSupply = capacity - locallyUsed;
        const moduleScopedSurplus = moduleScopedInputKeysByResource
          .get(resourceId)
          ?.has(key)
          ? Math.max(0, moduleFlow.produced - moduleFlow.consumed)
          : 0;

        return total + Math.max(unusedOwnedSupply, moduleScopedSurplus);
      }, 0);

    return globalFlow.produced - globalFlow.consumed - unavailableModuleSupply;
  };
  const getAvailableInput = (line: ProductionLine, resourceId: ResourceId) => {
    const moduleKey = moduleResourceKey(line.moduleId, resourceId);
    const hasOwnedModuleSource = (
      ownedModuleSupplyCapacityByResource.get(moduleKey) ?? 0
    ) > 0;

    if (line.recipe.balanceInputScope === "module" || hasOwnedModuleSource) {
      const flow = getActualModuleFlow(line.moduleId, resourceId);

      return flow.produced - flow.consumed;
    }

    return getUnreservedGlobalInput(resourceId);
  };

  // Caller-supplied resources, such as contract imports, are virtual sources.
  for (const [id, qty] of suppliedEntries) {
    getFlow(id).produced += qty;
  }
  for (const [moduleId, supplies] of moduleSuppliedResources) {
    for (const [id, qty] of typedEntries(supplies)) {
      getActualModuleFlow(moduleId, id).produced += qty;
    }
  }
  for (const [id, qty] of fixedDemandEntries) {
    getFlow(id).consumed += qty;
  }
  for (const [moduleId, demands] of moduleFixedDemands) {
    for (const [id, qty] of typedEntries(demands)) {
      getFlow(id).consumed += qty;
      getActualModuleFlow(moduleId, id).consumed += qty;
    }
  }

  // Sources reserve enough supply for allocation. Unused output is removed
  // after regular production has been calculated.
  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) {
      const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;

      getFlow(output.resourceId).produced += capacity;
      getActualModuleFlow(line.moduleId, output.resourceId).produced += capacity;
    }
  }
  const reservedSourceInputs = new Map<ProductionLine, Map<ResourceId, number>>();

  let allocationRatios = new Map<ProductionLine, number>();
  let surplusOnlyConsumption = new Map<ResourceId, number>();
  let surplusOnlyModuleConsumption = new Map<string, number>();
  let createdRecyclableSources = new Map<ProductionLine, Map<ResourceId, number>>();
  let sortedRecyclableSources = new Map<ProductionLine, Map<ResourceId, number>>();
  const capacityTracker = createCapacityTracker(regularLines);
  const applyRegularLine = (line: ProductionLine, ratio: number, additive = false) => {
    const previousRatio = allocationRatios.get(line) ?? 0;

    allocationRatios.set(
      line,
      (additive ? previousRatio : 0) + ratio,
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
      getActualModuleFlow(line.moduleId, input.resourceId).consumed += actualQuantity;

      if (line.recipe.consumeSurplusInputIds?.includes(input.resourceId)) {
        surplusOnlyConsumption.set(
          input.resourceId,
          (surplusOnlyConsumption.get(input.resourceId) ?? 0) + actualQuantity,
        );
        const moduleKey = moduleResourceKey(line.moduleId, input.resourceId);

        surplusOnlyModuleConsumption.set(
          moduleKey,
          (surplusOnlyModuleConsumption.get(moduleKey) ?? 0) + actualQuantity,
        );
      }
    }
    for (const output of line.recipe.outputs) {
      const outputQuantity = getRecipeOutputQuantity(line.recipe, output, outputModifiers);
      const actualQuantity = recyclableInput
        ? (sortedSources.get(output.resourceId) ?? 0)
        : outputQuantity * multiplier;
      const flow = getFlow(output.resourceId);

      flow.produced += actualQuantity;
      getActualModuleFlow(line.moduleId, output.resourceId).produced += actualQuantity;

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
  const getDrivingConsumption = (resourceId: ResourceId) => Math.max(
    0,
    getFlow(resourceId).consumed - (surplusOnlyConsumption.get(resourceId) ?? 0),
  );
  const getModuleDrivingConsumption = (moduleId: string, resourceId: ResourceId) => {
    const key = moduleResourceKey(moduleId, resourceId);

    return Math.max(
      0,
      getActualModuleFlow(moduleId, resourceId).consumed
        - (surplusOnlyModuleConsumption.get(key) ?? 0),
    );
  };
  const getOutputDemandRatio = (
    line: ProductionLine,
    resourceId: ResourceId,
    capacity: number,
    globallyProduced: number,
  ) => {
    if (capacity <= 0) return 0;

    const globalDemand = Math.max(
      0,
      getDrivingConsumption(resourceId) - globallyProduced,
    );
    const moduleDemand = moduleFixedDemands.get(line.moduleId)?.[resourceId] ?? 0;

    if (moduleDemand <= 0) return globalDemand / capacity;

    const key = moduleResourceKey(line.moduleId, resourceId);
    const moduleFlow = getActualModuleFlow(line.moduleId, resourceId);
    const moduleProduction = moduleFlow.produced
      - (totalModuleSourceCapacityByResource.get(key) ?? 0);
    const selectedSourceDemand = Math.max(
      0,
      getModuleDrivingConsumption(line.moduleId, resourceId) - moduleProduction,
    );

    return Math.max(globalDemand, selectedSourceDemand) / capacity;
  };
  const getDrivenInputRatio = (line: ProductionLine) => {
    const drivingInputIds = new Set(line.drivingInputIds);
    const factor = lineFactor(line);
    let ratio = capacityTracker.availableRatio(line);

    for (const input of line.recipe.inputs) {
      if (
        !drivingInputIds.has(input.resourceId)
        && !hardSuppliedIds.has(input.resourceId)
      ) {
        continue;
      }
      if (
        !drivingInputIds.has(input.resourceId)
        && isPlannedSupportingResource(line.moduleId, input.resourceId)
      ) {
        continue;
      }

      const available = getAvailableInput(line, input.resourceId);
      const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

      if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
    }

    return ratio;
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

  // Direct module imports reserve their recipe capacity before ordinary
  // alternatives can consume the same physical machines.
  for (const line of drivenInputLines) {
    applyRegularLine(line, getDrivenInputRatio(line));
  }

  // Ordinary supply-balanced recipes retain the existing constrained-resource
  // behavior. Shared fallback recipes are deferred until primary demand is known.
  for (const line of supplyBalancedLines) {
    if (line.activeBuildings === 0) {
      applyRegularLine(line, 0);
      continue;
    }

    const currentRatio = allocationRatios.get(line) ?? 0;
    const factor = lineFactor(line);
    let ratio = Math.min(
      Math.max(0, 1 - currentRatio),
      capacityTracker.availableRatio(line),
    );

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

      const available = getAvailableInput(line, input.resourceId);
      const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

      if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
    }

    applyRegularLine(line, ratio, currentRatio > 0);
  }

  // Propagate demand from consumers to producers. Internally produced inputs are
  // intentionally allowed to go temporarily negative because their upstream
  // recipes run later in this downstream-to-upstream pass. Explicit caller
  // supplies remain hard limits unless the caller asks to expose an uncovered
  // balance, as fixed-capacity contracts do.
  for (const line of demandBalancedLines) {
    if (line.activeBuildings === 0) {
      applyRegularLine(line, 0);
      continue;
    }

    const currentRatio = allocationRatios.get(line) ?? 0;
    const factor = lineFactor(line);
    let ratio = Math.min(
      Math.max(0, 1 - currentRatio),
      capacityTracker.availableRatio(line),
    );

    for (const input of line.recipe.inputs) {
      if (line.recipe.balanceInputIds?.includes(input.resourceId)) {
        const available = getAvailableInput(line, input.resourceId);
        const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

        if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
        continue;
      }
      if (ownedModuleSupplyKeysByResource.has(input.resourceId)) {
        const available = getAvailableInput(line, input.resourceId);
        const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

        if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
        continue;
      }
      if (!hardSuppliedIds.has(input.resourceId) || internallyProducedIds.has(input.resourceId)) continue;

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

      return [getOutputDemandRatio(
        line,
        output.resourceId,
        capacity,
        internallyProduced,
      )];
    });

    ratio = outputDemandRatios.length > 0
      ? Math.min(ratio, Math.max(...outputDemandRatios))
      : 0;

    applyRegularLine(line, ratio, currentRatio > 0);
  }

  const applyLowerPriorityLines = (linesToApply: ProductionLine[]) => {
    for (const line of linesToApply) {
      if (line.activeBuildings === 0) {
        applyRegularLine(line, 0);
        continue;
      }

      const currentRatio = allocationRatios.get(line) ?? 0;
      const factor = lineFactor(line);
      let ratio = Math.min(
        Math.max(0, 1 - currentRatio),
        capacityTracker.availableRatio(line),
      );

      for (const input of line.recipe.inputs) {
        const explicitlyInputBalanced = line.recipe.balanceInputIds?.includes(input.resourceId) ?? false;

        if (
          line.recipe.balanceInputIds
          && !explicitlyInputBalanced
          && internallyProducedIds.has(input.resourceId)
        ) {
          continue;
        }

        const available = getAvailableInput(line, input.resourceId);
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

          return [getOutputDemandRatio(
            line,
            output.resourceId,
            capacity,
            internallyProduced,
          )];
        });

        ratio = outputDemandRatios.length > 0
          ? Math.min(ratio, Math.max(...outputDemandRatios))
          : 0;
      }

      applyRegularLine(line, ratio, currentRatio > 0);
    }
  };
  const cloneFlows = (source: FlowMap): FlowMap => {
    const clone: FlowMap = new Map();

    for (const [resourceId, flow] of source) {
      clone.set(resourceId, {
        consumed: flow.consumed,
        produced: flow.produced,
        recyclableSourcesConsumed: new Map(flow.recyclableSourcesConsumed),
        recyclableSourcesProduced: new Map(flow.recyclableSourcesProduced),
      });
    }

    return clone;
  };
  const cloneModuleFlows = (
    source: ReadonlyMap<string, { consumed: number; produced: number }>,
  ) => {
    const clone = new Map<string, { consumed: number; produced: number }>();

    for (const [key, flow] of source) clone.set(key, { ...flow });

    return clone;
  };
  const cloneLineResourceMaps = (
    source: ReadonlyMap<ProductionLine, Map<ResourceId, number>>,
  ) => {
    const clone = new Map<ProductionLine, Map<ResourceId, number>>();

    for (const [line, quantities] of source) {
      clone.set(line, new Map(quantities));
    }

    return clone;
  };
  const snapshotAllocationState = () => ({
    flows: cloneFlows(flows),
    actualModuleFlows: cloneModuleFlows(actualModuleFlows),
    allocationRatios: new Map(allocationRatios),
    surplusOnlyConsumption: new Map(surplusOnlyConsumption),
    surplusOnlyModuleConsumption: new Map(surplusOnlyModuleConsumption),
    capacity: capacityTracker.snapshot(),
    createdRecyclableSources: cloneLineResourceMaps(createdRecyclableSources),
    sortedRecyclableSources: cloneLineResourceMaps(sortedRecyclableSources),
  });
  const restoreAllocationState = (
    state: ReturnType<typeof snapshotAllocationState>,
  ) => {
    flows = cloneFlows(state.flows);
    getFlow = makeGetFlow(flows);
    actualModuleFlows = cloneModuleFlows(state.actualModuleFlows);
    allocationRatios = new Map(state.allocationRatios);
    surplusOnlyConsumption = new Map(state.surplusOnlyConsumption);
    surplusOnlyModuleConsumption = new Map(state.surplusOnlyModuleConsumption);
    createdRecyclableSources = cloneLineResourceMaps(state.createdRecyclableSources);
    sortedRecyclableSources = cloneLineResourceMaps(state.sortedRecyclableSources);
    capacityTracker.restore(state.capacity);
  };
  const hasNewDeficit = <Key extends string>(
    before: ReadonlyMap<Key, { consumed: number; produced: number }>,
    after: ReadonlyMap<Key, { consumed: number; produced: number }>,
    isIgnored: (key: Key) => boolean = () => false,
  ) => {
    const keys = new Set([...before.keys(), ...after.keys()]);

    for (const key of keys) {
      if (isIgnored(key)) continue;

      const beforeFlow = before.get(key);
      const afterFlow = after.get(key);
      const beforeAvailable = (beforeFlow?.produced ?? 0) - (beforeFlow?.consumed ?? 0);
      const afterAvailable = (afterFlow?.produced ?? 0) - (afterFlow?.consumed ?? 0);

      if (afterAvailable < Math.min(0, beforeAvailable) - 1e-7) return true;
    }

    return false;
  };
  const getDeficitIncrease = (
    before: { consumed: number; produced: number } | undefined,
    after: { consumed: number; produced: number } | undefined,
  ) => {
    const beforeDeficit = Math.max(
      0,
      (before?.consumed ?? 0) - (before?.produced ?? 0),
    );
    const afterDeficit = Math.max(
      0,
      (after?.consumed ?? 0) - (after?.produced ?? 0),
    );

    return Math.max(0, afterDeficit - beforeDeficit);
  };
  const allocationIntroducedDeficit = (
    baseline: ReturnType<typeof snapshotAllocationState>,
  ) => {
    const resourceIds = new Set([...baseline.flows.keys(), ...flows.keys()]);

    for (const resourceId of resourceIds) {
      const globalIncrease = getDeficitIncrease(
        baseline.flows.get(resourceId),
        flows.get(resourceId),
      );

      if (globalIncrease <= 1e-7) continue;
      if (!plannedSupportingIds.has(resourceId)) return true;

      const supportedIncrease = [...effectivePlannedSupportingResourceIds]
        .reduce((total, [moduleId, supportingIds]) => {
          if (!supportingIds.has(resourceId)) return total;

          const key = moduleResourceKey(moduleId, resourceId);

          return total + getDeficitIncrease(
            baseline.actualModuleFlows.get(key),
            actualModuleFlows.get(key),
          );
        }, 0);

      if (globalIncrease > supportedIncrease + 1e-7) return true;
    }

    return hasNewDeficit(
      baseline.actualModuleFlows,
      actualModuleFlows,
      key => (
        plannedSupportingModuleKeys.has(key)
        || [...suppliedIds].some(resourceId => key.endsWith(`:${resourceId}`))
      ),
    );
  };
  const applyAdditionalSurplusConsumption = () => {
    for (const line of surplusConsumerLines) {
      const currentRatio = allocationRatios.get(line) ?? 0;
      const remainingLineRatio = Math.max(0, 1 - currentRatio);

      if (remainingLineRatio <= 1e-9) continue;

      const surplusInputIds = new Set(line.recipe.consumeSurplusInputIds);
      const factor = lineFactor(line);
      let ratio = Math.min(
        remainingLineRatio,
        capacityTracker.availableRatio(line),
      );

      for (const input of line.recipe.inputs) {
        const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

        if (needed <= 0) continue;

        if (surplusInputIds.has(input.resourceId)) {
          const flow = line.recipe.consumeSurplusInputScope === "module"
            ? getActualModuleFlow(line.moduleId, input.resourceId)
            : getFlow(input.resourceId);
          const available = flow.produced - flow.consumed;

          ratio = Math.min(ratio, Math.max(0, available / needed));
          continue;
        }

        // Supporting internal production is demand-propagated after this pass.
        // External materials must already be available; do not invent imports
        // merely to eliminate a preferred surplus resource.
        if (
          internallyProducedIds.has(input.resourceId)
          || isPlannedSupportingResource(line.moduleId, input.resourceId)
        ) {
          continue;
        }

        const flow = getFlow(input.resourceId);
        const available = flow.produced - flow.consumed;

        ratio = Math.min(ratio, Math.max(0, available / needed));
      }

      if (ratio <= 1e-9) continue;

      const baseline = snapshotAllocationState();

      applyRegularLine(line, ratio, true);
      propagateAdditionalDemand();

      if (!allocationIntroducedDeficit(baseline)) continue;

      let feasibleRatio = 0;
      let infeasibleRatio = ratio;

      for (let iteration = 0; iteration < 24; iteration += 1) {
        const candidateRatio = (feasibleRatio + infeasibleRatio) / 2;

        restoreAllocationState(baseline);
        applyRegularLine(line, candidateRatio, true);
        propagateAdditionalDemand();

        if (allocationIntroducedDeficit(baseline)) {
          infeasibleRatio = candidateRatio;
        } else {
          feasibleRatio = candidateRatio;
        }
      }

      restoreAllocationState(baseline);

      if (feasibleRatio > 1e-9) {
        applyRegularLine(line, feasibleRatio, true);
        propagateAdditionalDemand();
      }
    }
  };
  const propagateAdditionalDemand = () => {
    for (let iteration = 0; iteration < demandBalancedLines.length; iteration += 1) {
      let changed = false;

      for (const line of demandBalancedLines) {
        if (line.activeBuildings === 0) continue;

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
            const available = getAvailableInput(line, input.resourceId);
            const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

            if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
            continue;
          }
          if (ownedModuleSupplyKeysByResource.has(input.resourceId)) {
            const available = getAvailableInput(line, input.resourceId);
            const needed = getRecipeInputQuantity(input, outputModifiers) * factor;

            if (needed > 0) ratio = Math.min(ratio, Math.max(0, available / needed));
            continue;
          }
          if (!hardSuppliedIds.has(input.resourceId) || internallyProducedIds.has(input.resourceId)) continue;

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

          return [getOutputDemandRatio(
            line,
            output.resourceId,
            capacity,
            internallyProduced,
          )];
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

  const settleFallbackDemand = () => {
    for (let iteration = 0; iteration <= fallbackLines.length; iteration += 1) {
      const priorFallbackLoad = fallbackLines.reduce(
        (total, line) => total + (allocationRatios.get(line) ?? 0),
        0,
      );

      applyLowerPriorityLines(fallbackLines);
      propagateAdditionalDemand();

      const settledFallbackLoad = fallbackLines.reduce(
        (total, line) => total + (allocationRatios.get(line) ?? 0),
        0,
      );

      if (settledFallbackLoad - priorFallbackLoad <= 1e-9) break;
    }
  };

  const reservePlannedSourceInputs = () => {
    const remainingGlobalDemand = new Map<ResourceId, number>();
    const remainingModuleDemand = new Map<string, number>();
    const moduleSourceCapacities = new Map<string, number>();

    for (const line of sourceLines) {
      if (!isModuleScopedSourceMode(line.recipe.sourceMode)) continue;

      for (const output of line.recipe.outputs) {
        const key = moduleResourceKey(line.moduleId, output.resourceId);

        moduleSourceCapacities.set(
          key,
          (moduleSourceCapacities.get(key) ?? 0)
            + (sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0),
        );
      }
    }

    for (const line of sourceLines) {
      for (const output of line.recipe.outputs) {
        if (!remainingGlobalDemand.has(output.resourceId)) {
          const flow = getFlow(output.resourceId);
          const internallyProduced = flow.produced
            - (totalSourceCapacityByResource.get(output.resourceId) ?? 0);

          remainingGlobalDemand.set(
            output.resourceId,
            Math.max(0, flow.consumed - internallyProduced),
          );
        }

        if (isModuleScopedSourceMode(line.recipe.sourceMode)) {
          const key = moduleResourceKey(line.moduleId, output.resourceId);

          if (!remainingModuleDemand.has(key)) {
            const flow = getActualModuleFlow(line.moduleId, output.resourceId);
            const internallyProduced = flow.produced
              - (moduleSourceCapacities.get(key) ?? 0);

            remainingModuleDemand.set(
              key,
              Math.max(0, flow.consumed - internallyProduced),
            );
          }
        }
      }
    }

    for (const line of sourceLines) {
      const plannedOutputs = new Map<ResourceId, number>();

      for (const output of line.recipe.outputs) {
        const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;
        const key = moduleResourceKey(line.moduleId, output.resourceId);
        const moduleScoped = isModuleScopedSourceMode(line.recipe.sourceMode);
        const remaining = moduleScoped
          ? remainingModuleDemand.get(key) ?? 0
          : remainingGlobalDemand.get(output.resourceId) ?? 0;
        const planned = Math.min(capacity, remaining);

        plannedOutputs.set(output.resourceId, planned);
        remainingGlobalDemand.set(
          output.resourceId,
          Math.max(
            0,
            (remainingGlobalDemand.get(output.resourceId) ?? 0) - planned,
          ),
        );
        if (moduleScoped) {
          remainingModuleDemand.set(key, remaining - planned);
        }
      }

      const sourceScale = getSourceScale(line, plannedOutputs);
      const reservedInputs = new Map<ResourceId, number>();

      for (const input of line.recipe.inputs) {
        const quantity = getRecipeInputQuantity(input, outputModifiers) * sourceScale;

        getFlow(input.resourceId).consumed += quantity;
        getActualModuleFlow(line.moduleId, input.resourceId).consumed += quantity;
        reservedInputs.set(input.resourceId, quantity);
      }

      reservedSourceInputs.set(line, reservedInputs);
    }
  };

  // Fallbacks may create supporting demand (for example Sour Water recovery
  // needs Steam). Resolve that demand before final surplus converters run.
  settleFallbackDemand();
  reservePlannedSourceInputs();
  applyLowerPriorityLines(surplusLines);
  propagateAdditionalDemand();
  applyAdditionalSurplusConsumption();
  propagateAdditionalDemand();

  // Regular results
  const regularResults: RegularResult[] = regularLines.map((line) => ({
    recipe: line.recipe,
    moduleId: line.moduleId,
    dataSource: line.dataSource,
    capacityPoolId: line.capacityPoolId,
    capacityPoolActiveBuildings: line.capacityPoolActiveBuildings,
    capacityPoolBuiltBuildings: line.capacityPoolBuiltBuildings,
    capacityPoolCurrentActiveBuildings: line.capacityPoolCurrentActiveBuildings,
    capacityPoolConstructionGhosts: line.capacityPoolConstructionGhosts,
    capacityPoolUnplacedPlannedBuildings: line.capacityPoolUnplacedPlannedBuildings,
    activeBuildings: line.activeBuildings,
    currentActiveBuildings: line.currentActiveBuildings,
    builtBuildings: line.builtBuildings,
    constructionGhosts: line.constructionGhosts,
    unplacedPlannedBuildings: line.unplacedPlannedBuildings,
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
  const remainingModuleSourceDemand = new Map<string, number>();

  for (const line of sourceLines) {
    if (!isModuleScopedSourceMode(line.recipe.sourceMode)) continue;

    for (const output of line.recipe.outputs) {
      const key = moduleResourceKey(line.moduleId, output.resourceId);

      if (remainingModuleSourceDemand.has(key)) continue;

      const moduleConsumed = regularResults.reduce((total, result) => (
        result.moduleId === line.moduleId
          ? total + result.actualInputs.reduce((inputTotal, input) => (
              input.resourceId === output.resourceId
                ? inputTotal + input.quantity
                : inputTotal
            ), 0)
          : total
      ), moduleFixedDemands.get(line.moduleId)?.[output.resourceId] ?? 0);
      const moduleProduced = regularResults.reduce((total, result) => (
        result.moduleId === line.moduleId
          ? total + result.actualOutputs.reduce((outputTotal, actualOutput) => (
              actualOutput.resourceId === output.resourceId
                ? outputTotal + actualOutput.quantity
                : outputTotal
            ), 0)
          : total
      ), 0);

      remainingModuleSourceDemand.set(
        key,
        Math.max(0, moduleConsumed - moduleProduced),
      );
    }
  }

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
      const moduleKey = moduleResourceKey(line.moduleId, output.resourceId);
      const moduleScoped = isModuleScopedSourceMode(line.recipe.sourceMode);
      const remaining = moduleScoped
        ? remainingModuleSourceDemand.get(moduleKey) ?? 0
        : remainingSourceDemand.get(output.resourceId) ?? 0;
      const actualUsed = Math.min(capacity, remaining);

      flow.produced -= capacity - actualUsed;
      getActualModuleFlow(line.moduleId, output.resourceId).produced -= capacity - actualUsed;
      if (moduleScoped) {
        remainingModuleSourceDemand.set(moduleKey, remaining - actualUsed);
        remainingSourceDemand.set(
          output.resourceId,
          Math.max(
            0,
            (remainingSourceDemand.get(output.resourceId) ?? 0) - actualUsed,
          ),
        );
      } else {
        remainingSourceDemand.set(output.resourceId, remaining - actualUsed);
      }

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
      const reserved = reservedSourceInputs.get(line)?.get(input.resourceId) ?? 0;

      getFlow(input.resourceId).consumed += quantity - reserved;
      getActualModuleFlow(line.moduleId, input.resourceId).consumed += quantity - reserved;

      return { resourceId: input.resourceId, quantity };
    });

    return {
      recipe: line.recipe,
      moduleId: line.moduleId,
      dataSource: line.dataSource,
      capacityPoolId: line.capacityPoolId,
      capacityPoolActiveBuildings: line.capacityPoolActiveBuildings,
      capacityPoolBuiltBuildings: line.capacityPoolBuiltBuildings,
      capacityPoolCurrentActiveBuildings: line.capacityPoolCurrentActiveBuildings,
      capacityPoolConstructionGhosts: line.capacityPoolConstructionGhosts,
      capacityPoolUnplacedPlannedBuildings: line.capacityPoolUnplacedPlannedBuildings,
      activeBuildings: line.activeBuildings,
      currentActiveBuildings: line.currentActiveBuildings,
      builtBuildings: line.builtBuildings,
      constructionGhosts: line.constructionGhosts,
      unplacedPlannedBuildings: line.unplacedPlannedBuildings,
      supplyRatio: line.activeBuildings > 0
        ? Math.min(1, sourceScale / line.activeBuildings)
        : 0,
      actualInputs,
      actualOutputs,
    };
  });

  // Recovery sinks such as Cooling Towers can produce useful resources after
  // demand sources have already been allocated. Displace those fallback
  // sources immediately so a later disposal sink cannot consume recovered
  // material while an avoidable source is still running.
  const displaceDemandSources = () => {
    for (const [resourceId, flow] of flows) {
      let excess = Math.max(0, flow.produced - flow.consumed);

      if (excess <= 1e-9) continue;

      // Reverse order preserves declaration priority: later fallback sources
      // (Groundwater Pumps) are reduced before earlier sources.
      for (const result of sourceResults.toReversed()) {
        if (
          !result.recipe.sourceMode
          || isModuleScopedSourceMode(result.recipe.sourceMode)
          || excess <= 1e-9
        ) continue;

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
        getActualModuleFlow(result.moduleId, resourceId).produced -= reduction;
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

        result.supplyRatio = result.activeBuildings > 0
          ? Math.min(1, nextScale / result.activeBuildings)
          : 0;

        if (nextScale >= previousScale) continue;

        for (const actualInput of result.actualInputs) {
          const declared = result.recipe.inputs.find(
            (input) => input.resourceId === actualInput.resourceId,
          );

          if (!declared) continue;

          const nextQuantity = getRecipeInputQuantity(declared, outputModifiers) * nextScale;
          const inputReduction = actualInput.quantity - nextQuantity;

          getFlow(actualInput.resourceId).consumed -= inputReduction;
          getActualModuleFlow(result.moduleId, actualInput.resourceId).consumed -= inputReduction;
          actualInput.quantity = nextQuantity;
        }
      }
    }
  };

  // Sinks absorb excess (sequential priority)
  const sinkResults: PassiveResult[] = [];
  const sinkCapacityTracker = createCapacityTracker(sinkLines);

  const orderedSinkLines = orderSharedCapacity(sinkLines).toSorted((a, b) => (
    (a.recipe.sinkPriority ?? 0) - (b.recipe.sinkPriority ?? 0)
  ));
  const getModuleExcess = (moduleId: string, resourceId: ResourceId) => {
    let produced = 0;
    let consumed = 0;

    for (const result of [...regularResults, ...sourceResults, ...sinkResults]) {
      if (result.moduleId !== moduleId) continue;

      produced += result.actualOutputs.reduce((total, output) => (
        output.resourceId === resourceId ? total + output.quantity : total
      ), 0);
      consumed += result.actualInputs.reduce((total, input) => (
        input.resourceId === resourceId ? total + input.quantity : total
      ), 0);
    }

    return Math.max(0, produced - consumed);
  };

  for (const line of orderedSinkLines) {
    if (line.activeBuildings === 0) {
      sinkResults.push({
        recipe: line.recipe,
        moduleId: line.moduleId,
        dataSource: line.dataSource,
        capacityPoolId: line.capacityPoolId,
        capacityPoolActiveBuildings: line.capacityPoolActiveBuildings,
        capacityPoolBuiltBuildings: line.capacityPoolBuiltBuildings,
        capacityPoolCurrentActiveBuildings: line.capacityPoolCurrentActiveBuildings,
        capacityPoolConstructionGhosts: line.capacityPoolConstructionGhosts,
        capacityPoolUnplacedPlannedBuildings: line.capacityPoolUnplacedPlannedBuildings,
        activeBuildings: 0,
        currentActiveBuildings: line.currentActiveBuildings,
        builtBuildings: line.builtBuildings,
        constructionGhosts: line.constructionGhosts,
        unplacedPlannedBuildings: line.unplacedPlannedBuildings,
        supplyRatio: 0,
        actualInputs: [],
        actualOutputs: [],
      });
      continue;
    }

    const capacity = lineFactor(line);
    let utilizationRatio = line.recipe.sinkMode === "unbounded" && !line.capacityPoolId
      ? Number.POSITIVE_INFINITY
      : sinkCapacityTracker.availableRatio(line);

    for (const input of line.recipe.inputs) {
      const f = getFlow(input.resourceId);
      const factoryExcess = f.produced - f.consumed;
      const excess = line.recipe.sinkScope === "module"
        ? Math.min(factoryExcess, getModuleExcess(line.moduleId, input.resourceId))
        : factoryExcess;

      if (excess <= 0) { utilizationRatio = 0; break; }
      utilizationRatio = Math.min(
        utilizationRatio,
        excess / (getRecipeInputQuantity(input, outputModifiers) * capacity),
      );
    }

    if (utilizationRatio <= 1e-9) utilizationRatio = 0;
    sinkCapacityTracker.use(line, utilizationRatio);

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

    sinkResults.push({
      recipe: line.recipe,
      moduleId: line.moduleId,
      dataSource: line.dataSource,
      capacityPoolId: line.capacityPoolId,
      capacityPoolActiveBuildings: line.capacityPoolActiveBuildings,
      capacityPoolBuiltBuildings: line.capacityPoolBuiltBuildings,
      capacityPoolCurrentActiveBuildings: line.capacityPoolCurrentActiveBuildings,
      capacityPoolConstructionGhosts: line.capacityPoolConstructionGhosts,
      capacityPoolUnplacedPlannedBuildings: line.capacityPoolUnplacedPlannedBuildings,
      activeBuildings: line.activeBuildings,
      currentActiveBuildings: line.currentActiveBuildings,
      builtBuildings: line.builtBuildings,
      constructionGhosts: line.constructionGhosts,
      unplacedPlannedBuildings: line.unplacedPlannedBuildings,
      supplyRatio: utilizationRatio,
      actualInputs,
      actualOutputs,
    });

    if (actualOutputs.length > 0) displaceDemandSources();
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

    if (suppliedIds.has(resourceId)) {
      // Supplied resources only report demand beyond the declared supply.
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
