import { type ResourceId } from "../../db/resources";
import { type RegularResult } from "../calculate/calculate";

const BALANCE_THRESHOLD = 0.001;
const formatBuildingCapacity = (value: number) => parseFloat(value.toFixed(3));

export const getSurplusCapacityLimit = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
) => {
  const surplusConsumers = regularResults.filter((result) => (
    result.activeBuildings > 0
    && (
      result.recipe.allocation === "fallback"
      || result.recipe.allocation === "surplus"
    )
    && result.recipe.balanceBy === "input"
    && result.recipe.balanceInputIds?.includes(resourceId)
  ));

  if (surplusConsumers.length === 0) return null;

  const consumersByCapacity = new Map<string, RegularResult>();

  for (const consumer of surplusConsumers) {
    consumersByCapacity.set(
      consumer.capacityPoolId ?? `${consumer.moduleId}:${consumer.recipe.id}`,
      consumer,
    );
  }

  const limits = [...consumersByCapacity.values()].map((consumer) => {
    const capacityResults = consumer.capacityPoolId
      ? regularResults.filter((result) => result.capacityPoolId === consumer.capacityPoolId)
      : [consumer];
    const capacity = consumer.capacityPoolId
      ? Math.max(...capacityResults.map((result) => result.activeBuildings))
      : consumer.activeBuildings;
    const used = capacityResults.reduce((total, result) => (
      total + result.activeBuildings * result.supplyRatio
    ), 0);

    return {
      atCapacity: capacity > 0 && capacity - used <= BALANCE_THRESHOLD,
      capacity,
      label: consumer.recipe.sharedCapacity?.label ?? consumer.recipe.building,
      used,
    };
  });

  if (limits.some((limit) => !limit.atCapacity)) return null;

  return limits
    .map((limit) => (
      `${limit.label} · at capacity ${formatBuildingCapacity(limit.used)}/${formatBuildingCapacity(limit.capacity)}`
    ))
    .join(", ");
};
