import { type ResourceId } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";
import {
  type CapacityPool,
  getCapacityActions,
  getCapacityPools,
  type PoolResult,
} from "../capacity-pools/capacity-pools";
import { type ContractResourceFlow } from "../contracts/contract-resource-flows";
import { type DiagnosticMessage, formatDiagnosticMessages } from "../diagnostic-display/diagnostic-display";
import { isModuleInput } from "../recipe-input-scope/recipe-input-scope";

const BALANCE_THRESHOLD = 0.001;

export interface DeficitRootCause {
  /**
   * `no-producer`: nothing in the model makes the resource. `at-capacity`:
   * every producer pool is saturated or paused. `input-limited`: a producer
   * has room but its own inputs hold it back. `import-limited`: contracts
   * supply the resource but their imports do not cover demand.
   */
  kind: "no-producer" | "at-capacity" | "input-limited" | "import-limited";
  detail: string;
}

const getProducerLines = (resourceId: ResourceId, pool: CapacityPool) => (
  pool.members.filter(({ recipe, activeBuildings, builtBuildings }) => (
    (activeBuildings > 0 || builtBuildings > 0)
    && recipe.outputs.some(output => output.resourceId === resourceId)
  ))
);

/** A factory deficit is relevant only if that input can limit this producer. */
const getShortInputs = (
  resourceId: ResourceId,
  pool: CapacityPool,
  flows: ResourceFlow[],
) => (
  getProducerLines(resourceId, pool).flatMap(({ recipe }) => (
    // Input-driven recovery requests its supporting reagents on demand. Their
    // deficits do not explain spare capacity once its feedstock is exhausted.
    recipe.inputs.filter(input => (
      recipe.balanceBy !== "input"
      || recipe.balanceInputIds == null
      || recipe.balanceInputIds.includes(input.resourceId)
    ))
  ))
    .filter((input) => input.resourceId !== resourceId)
    .filter((input) => {
      const flow = flows.find((candidate) => candidate.resourceId === input.resourceId);

      return flow != null && flow.net < -BALANCE_THRESHOLD;
    })
    .map((input) => input.resourceId)
);

const getInputPriorities = (
  resourceId: ResourceId,
  producers: CapacityPool[],
  results: PoolResult[],
  flows: ResourceFlow[],
) => {
  const preferredProducts = new Map<ResourceId, Set<ResourceId>>();

  for (const producer of producers.flatMap(pool => getProducerLines(resourceId, pool))) {
    if (!producer.recipe.yieldToSurplus) continue;

    for (const input of producer.recipe.inputs) {
      const flow = flows.find(flow => flow.resourceId === input.resourceId);

      if (flow && Math.abs(flow.net) > BALANCE_THRESHOLD) continue;

      for (const consumer of results) {
        if (consumer.recipe.group === "sink" || consumer.recipe.yieldToSurplus) continue;
        if (
          isModuleInput(producer.recipe, input.resourceId)
          && producer.moduleId !== consumer.moduleId
        ) continue;
        if (!consumer.actualInputs.some(actual => (
          actual.resourceId === input.resourceId && actual.quantity > BALANCE_THRESHOLD
        ))) continue;

        const products = preferredProducts.get(input.resourceId) ?? new Set<ResourceId>();

        for (const output of consumer.actualOutputs) {
          if (output.resourceId === resourceId || output.quantity <= BALANCE_THRESHOLD) continue;
          if (
            consumer.recipe.balanceOutputIds?.length
            && !consumer.recipe.balanceOutputIds.includes(output.resourceId)
          ) continue;
          products.add(output.resourceId);
        }
        if (products.size > 0) preferredProducts.set(input.resourceId, products);
      }
    }
  }

  return [...preferredProducts].map(([inputId, productIds]): DiagnosticMessage => ({
    kind: "priority", inputId, productIds: [...productIds],
  }));
};

export const getDeficitRootCause = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  flows: ResourceFlow[],
  passiveResults: PassiveResult[] = [],
  contractFlows: readonly ContractResourceFlow[] = [],
): DeficitRootCause => {
  const flow = flows.find((candidate) => candidate.resourceId === resourceId);
  const results = [...regularResults, ...passiveResults];
  const recipeConsumption = results.reduce((total, result) => (
    total + (result.actualInputs.find((input) => input.resourceId === resourceId)?.quantity ?? 0)
  ), 0);
  // Consumption no line accounts for: vehicle fuel, contracts, boundary loads.
  const exchanges = contractFlows.filter(flow => flow.resourceId === resourceId);
  const imported = exchanges.filter(flow => flow.kind === "import").reduce((sum, flow) => sum + flow.quantity, 0);
  const exported = exchanges.filter(flow => flow.kind === "export").reduce((sum, flow) => sum + flow.quantity, 0);
  const fuel = exchanges.filter(flow => flow.kind === "fuel").reduce((sum, flow) => sum + flow.quantity, 0);
  const hasContract = exchanges.some(flow => flow.kind === "import");
  const outsideRecipes = (flow?.consumed ?? 0) - recipeConsumption - exported - fuel;
  const suffix: DiagnosticMessage[] = [];

  for (const exchange of exchanges) {
    if (exchange.importLimit) suffix.push({ kind: "contract-limit", limit: exchange.importLimit });
  }
  if (exported > BALANCE_THRESHOLD) suffix.push({ kind: "contract-export", quantity: exported });
  if (fuel > BALANCE_THRESHOLD) suffix.push({ kind: "contract-fuel", quantity: fuel });
  if (outsideRecipes > BALANCE_THRESHOLD) suffix.push({ kind: "outside-recipes", quantity: outsideRecipes });
  const allProducers = getCapacityPools(resourceId, results, "outputs");
  // A byproduct producer is sized by its main product, so its spare room
  // cannot be spent on this resource.
  const dedicated = allProducers.filter((pool) => (
    getProducerLines(resourceId, pool).some(({ recipe }) => (
      recipe.balanceOutputIds?.includes(resourceId) ?? true
    ))
  ));
  const producers = dedicated.length > 0 ? dedicated : allProducers;

  if (producers.length === 0) {
    if (hasContract) return {
      kind: "import-limited",
      detail: formatDiagnosticMessages([{
        kind: "contract-import", quantity: imported, needed: imported + Math.max(0, -(flow?.net ?? 0)),
      }, ...suffix]),
    };

    return { kind: "no-producer", detail: formatDiagnosticMessages([{ kind: "no-producer" }, ...suffix]) };
  }

  if (hasContract) suffix.unshift({ kind: "contract-import", quantity: imported });

  if (producers.every((producer) => producer.atCapacity)) {
    const deficit = Math.max(0, -(flow?.net ?? 0));

    return {
      kind: "at-capacity",
      detail: formatDiagnosticMessages([
        { kind: "capacity", actions: getCapacityActions(producers, resourceId, "outputs", deficit) },
        ...suffix,
      ]),
    };
  }

  const limitedProducers = producers.filter(producer => !producer.atCapacity);
  const shortInputs = [...new Set(limitedProducers.flatMap(producer => (
    getShortInputs(resourceId, producer, flows)
  )))];
  const details: DiagnosticMessage[] = [];

  if (shortInputs.length > 0) details.push({ kind: "shortage", resourceIds: shortInputs });
  details.push(...getInputPriorities(resourceId, limitedProducers, results, flows));
  if (details.length === 0) details.push({ kind: "input-limited" });

  return {
    kind: "input-limited",
    detail: formatDiagnosticMessages([...details, ...suffix]),
  };
};
