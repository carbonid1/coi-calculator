import { type ResourceId, resources } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";
import {
  type CapacityPool,
  describeCapacity,
  formatQuantity,
  getCapacityPools,
  getPoolLabels,
} from "../capacity-pools/capacity-pools";

const BALANCE_THRESHOLD = 0.001;

export interface DeficitRootCause {
  /**
   * `no-producer`: nothing in the model makes the resource. `at-capacity`:
   * every producer pool is saturated. `input-limited`: a producer has room but
   * its own inputs hold it back.
   */
  kind: "no-producer" | "at-capacity" | "input-limited";
  detail: string;
}

/** Inputs of a producer with room that the factory leaves nothing spare of. */
const getShortInputs = (
  resourceId: ResourceId,
  pool: CapacityPool,
  flows: ResourceFlow[],
) => (
  pool.lead.recipe.inputs
    .filter((input) => input.resourceId !== resourceId)
    .filter((input) => {
      const flow = flows.find((candidate) => candidate.resourceId === input.resourceId);

      return flow == null || flow.net <= BALANCE_THRESHOLD;
    })
    .map((input) => resources[input.resourceId].name)
);

export const getDeficitRootCause = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  flows: ResourceFlow[],
  passiveResults: PassiveResult[] = [],
): DeficitRootCause => {
  const flow = flows.find((candidate) => candidate.resourceId === resourceId);
  const recipeConsumption = [...regularResults, ...passiveResults].reduce((total, result) => (
    total + (result.actualInputs.find((input) => input.resourceId === resourceId)?.quantity ?? 0)
  ), 0);
  // Consumption no line accounts for: vehicle fuel, contracts, boundary loads.
  const outsideRecipes = (flow?.consumed ?? 0) - recipeConsumption;
  const suffix = outsideRecipes > BALANCE_THRESHOLD
    ? ` · ${formatQuantity(outsideRecipes)} outside recipes`
    : "";
  const allProducers = getCapacityPools(resourceId, regularResults, "outputs");
  // A byproduct producer is sized by its main product, so its spare room
  // cannot be spent on this resource.
  const dedicated = allProducers.filter((pool) => (
    pool.lead.recipe.balanceOutputIds?.includes(resourceId) ?? true
  ));
  const producers = dedicated.length > 0 ? dedicated : allProducers;

  if (producers.length === 0) return { kind: "no-producer", detail: `No producer${suffix}` };

  const labels = getPoolLabels(producers);

  if (producers.every((producer) => producer.atCapacity)) {
    const deficit = Math.max(0, -(flow?.net ?? 0));
    // Buildings of this pool that would close the gap on their own.
    const coversWith = (producer: CapacityPool) => {
      const output = producer.members.reduce((total, result) => (
        total + (result.actualOutputs.find((candidate) => candidate.resourceId === resourceId)?.quantity ?? 0)
      ), 0);
      const perBuilding = producer.used > 0 ? output / producer.used : 0;

      return perBuilding > 0 ? Math.ceil(deficit / perBuilding - BALANCE_THRESHOLD) : 0;
    };

    return {
      kind: "at-capacity",
      detail: producers
        .map((producer, index) => {
          const more = coversWith(producer);
          const covers = more > 0 ? ` · +${more} covers it` : "";

          return `${labels[index]} · ${describeCapacity(producer)}${covers}`;
        })
        .join(", ") + suffix,
    };
  }

  return {
    kind: "input-limited",
    detail: producers
      .map((producer, index) => {
        if (producer.atCapacity) return `${labels[index]} · ${describeCapacity(producer)}`;

        const shortInputs = getShortInputs(resourceId, producer, flows);
        const usage = `${formatQuantity(producer.used)}/${formatQuantity(producer.capacity)}`;

        return shortInputs.length > 0
          ? `${labels[index]} · ${shortInputs.join(", ")} short, ${usage}`
          : `${labels[index]} · ${usage}`;
      })
      .join(", ") + suffix,
  };
};
