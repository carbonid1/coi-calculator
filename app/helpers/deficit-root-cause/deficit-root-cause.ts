import { type ResourceId, resources } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";
import {
  type CapacityPool,
  describeCapacityFix,
  formatQuantity,
  getCapacityPools,
  type PoolResult,
} from "../capacity-pools/capacity-pools";

const BALANCE_THRESHOLD = 0.001;

export interface DeficitRootCause {
  /**
   * `no-producer`: nothing in the model makes the resource. `at-capacity`:
   * every producer pool is saturated or paused. `input-limited`: a producer
   * has room but its own inputs hold it back.
   */
  kind: "no-producer" | "at-capacity" | "input-limited";
  detail: string;
}

/** Confirmed deficits, rather than balanced inputs that could be produced on demand. */
const getShortInputs = (
  resourceId: ResourceId,
  pool: CapacityPool,
  flows: ResourceFlow[],
) => (
  pool.lead.recipe.inputs
    .filter((input) => input.resourceId !== resourceId)
    .filter((input) => {
      const flow = flows.find((candidate) => candidate.resourceId === input.resourceId);

      return flow != null && flow.net < -BALANCE_THRESHOLD;
    })
    .map((input) => resources[input.resourceId].name)
);

const getInputPriorities = (
  resourceId: ResourceId,
  producers: CapacityPool[],
  results: PoolResult[],
  flows: ResourceFlow[],
) => {
  const preferredProducts = new Map<ResourceId, Set<ResourceId>>();

  for (const producer of producers) {
    if (!producer.lead.recipe.yieldToSurplus) continue;

    for (const input of producer.lead.recipe.inputs) {
      const flow = flows.find(flow => flow.resourceId === input.resourceId);

      if (flow && Math.abs(flow.net) > BALANCE_THRESHOLD) continue;

      for (const consumer of results) {
        if (consumer.recipe.group === "sink" || consumer.recipe.yieldToSurplus) continue;
        if (
          producer.lead.recipe.balanceInputScope === "module"
          && producer.lead.moduleId !== consumer.moduleId
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

  return [...preferredProducts].map(([inputId, productIds]) => (
    `${resources[inputId].name} prioritized for ${[...productIds].map(id => resources[id].name).join(", ")}`
  ));
};

export const getDeficitRootCause = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  flows: ResourceFlow[],
  passiveResults: PassiveResult[] = [],
): DeficitRootCause => {
  const flow = flows.find((candidate) => candidate.resourceId === resourceId);
  const results = [...regularResults, ...passiveResults];
  const recipeConsumption = results.reduce((total, result) => (
    total + (result.actualInputs.find((input) => input.resourceId === resourceId)?.quantity ?? 0)
  ), 0);
  // Consumption no line accounts for: vehicle fuel, contracts, boundary loads.
  const outsideRecipes = (flow?.consumed ?? 0) - recipeConsumption;
  const suffix = outsideRecipes > BALANCE_THRESHOLD
    ? ` · ${formatQuantity(outsideRecipes)} outside recipes`
    : "";
  const allProducers = getCapacityPools(resourceId, results, "outputs");
  // A byproduct producer is sized by its main product, so its spare room
  // cannot be spent on this resource.
  const dedicated = allProducers.filter((pool) => (
    pool.lead.recipe.balanceOutputIds?.includes(resourceId) ?? true
  ));
  const producers = dedicated.length > 0 ? dedicated : allProducers;

  if (producers.length === 0) return { kind: "no-producer", detail: `No producer${suffix}` };

  if (producers.every((producer) => producer.atCapacity)) {
    const deficit = Math.max(0, -(flow?.net ?? 0));

    return {
      kind: "at-capacity",
      detail: describeCapacityFix(producers, resourceId, "outputs", deficit) + suffix,
    };
  }

  const limitedProducers = producers.filter(producer => !producer.atCapacity);
  const shortInputs = [...new Set(limitedProducers.flatMap(producer => (
    getShortInputs(resourceId, producer, flows)
  )))];
  const details = [
    ...(shortInputs.length > 0 ? [`${shortInputs.join(", ")} short`] : []),
    ...getInputPriorities(resourceId, limitedProducers, results, flows),
  ];

  return {
    kind: "input-limited",
    detail: (details.length > 0 ? details.join(" · ") : "Input supply limited") + suffix,
  };
};
