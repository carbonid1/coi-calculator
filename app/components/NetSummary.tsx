import { cropProductResourceIds } from "../db/crop-farming";
import { type ResourceId, resources } from "../db/resources";
import {
  type RegularResult,
  type ResourceFlow,
} from "../helpers/calculate/calculate";
import { typedEntries } from "../helpers/typed-entries/typed-entries";

interface Props {
  flows: ResourceFlow[];
  externalInputs?: Partial<Record<ResourceId, number>>;
  workers?: number;
  electricityConsumptionKw?: number;
  electricityGenerationCapacityMw?: number;
  populationCapacity?: number;
  groupByBalance?: boolean;
  regularResults?: RegularResult[];
}

const BALANCE_THRESHOLD = 0.001;
const formatNet = (net: number) => {
  if (Math.abs(net) <= BALANCE_THRESHOLD) return "0";

  const rounded = parseFloat(net.toFixed(2));

  return net > 0 ? `+${rounded}` : `${rounded}`;
};
const formatPower = (megawatts: number) => {
  if (Math.abs(megawatts) <= BALANCE_THRESHOLD) return "0 MW";
  if (Math.abs(megawatts) < 0.1) return `${parseFloat((megawatts * 1000).toFixed(0))} kW`;

  return `${parseFloat(megawatts.toFixed(1))} MW`;
};

const formatCapacity = (value: number) => parseFloat(value.toFixed(2));

const getCapacityLimit = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
) => {
  const producers = regularResults.filter((result) => (
    result.buildingCount > 0
    && result.recipe.outputs.some((output) => output.resourceId === resourceId)
  ));

  if (producers.length === 0) return null;

  const producersByCapacity = new Map<string, RegularResult>();

  for (const producer of producers) {
    producersByCapacity.set(
      producer.capacityPoolId ?? `${producer.moduleId}:${producer.recipe.id}`,
      producer,
    );
  }

  const limits = [...producersByCapacity.values()].map((producer) => {
    const capacityResults = producer.capacityPoolId
      ? regularResults.filter((result) => result.capacityPoolId === producer.capacityPoolId)
      : [producer];
    const capacity = producer.capacityPoolId
      ? Math.max(...capacityResults.map((result) => result.buildingCount))
      : producer.buildingCount;
    const used = capacityResults.reduce((total, result) => (
      total + result.buildingCount * result.supplyRatio
    ), 0);

    return {
      atCapacity: capacity > 0 && capacity - used <= BALANCE_THRESHOLD,
      capacity,
      label: producer.recipe.sharedCapacity?.label ?? producer.recipe.building,
    };
  });

  if (limits.some((limit) => !limit.atCapacity)) return null;

  return limits
    .map((limit) => (
      `${limit.label} · at capacity ${formatCapacity(limit.capacity)}/${formatCapacity(limit.capacity)}`
    ))
    .join(", ");
};

export const NetSummary: React.FC<Props> = ({ flows, externalInputs, workers, electricityConsumptionKw, electricityGenerationCapacityMw, populationCapacity, groupByBalance = false, regularResults = [] }) => {
  const externalEntries = externalInputs ? typedEntries(externalInputs).filter(([, qty]) => qty > 0) : [];

  const electricityFlow = flows.find((f) => f.resourceId === "electricity");
  const materialFlows = flows.filter((flow) => flow.resourceId !== "electricity");
  const moduleInputFlows = groupByBalance
    ? []
    : materialFlows
        .filter((flow) => flow.net < -BALANCE_THRESHOLD)
        .toSorted((a, b) => a.name.localeCompare(b.name));
  const regularFlows = groupByBalance
    ? materialFlows
    : materialFlows.filter((flow) => flow.net >= -BALANCE_THRESHOLD);
  const balanceGroups = [
    {
      label: "Deficit",
      flows: regularFlows.filter((flow) => flow.net < -BALANCE_THRESHOLD),
      valueClassName: "text-destructive",
    },
    {
      label: "Equilibrium (target)",
      flows: regularFlows.filter((flow) => Math.abs(flow.net) <= BALANCE_THRESHOLD),
      valueClassName: "text-muted-foreground",
    },
    {
      label: "Surplus",
      flows: regularFlows.filter((flow) => flow.net > BALANCE_THRESHOLD),
      valueClassName: "text-success",
    },
  ].map((group) => ({
    ...group,
    flows: group.flows.toSorted((a, b) => a.name.localeCompare(b.name)),
  }));
  // Keep calculating equilibrium flows for diagnostics, but omit the large
  // group from the current Factory Total presentation.
  const displayedBalanceGroups = balanceGroups.filter(
    (group) => group.label !== "Equilibrium (target)",
  );
  const capacityLimitedDeficits = balanceGroups
    .find((group) => group.label === "Deficit")
    ?.flows.flatMap((flow) => {
      const capacityLimit = getCapacityLimit(flow.resourceId, regularResults);

      return capacityLimit ? [{ flow, capacityLimit }] : [];
    }) ?? [];
  const capacityLimitedIds = new Set(
    capacityLimitedDeficits.map(({ flow }) => flow.resourceId),
  );
  const renderBalanceGroup = (group: (typeof displayedBalanceGroups)[number]) => {
    if (group.label === "Deficit" && capacityLimitedDeficits.length > 0) {
      return (
        <div className="space-y-4">
          <div className="inset-shadow-surface rounded-lg bg-surface-inset p-3">
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
              Capacity limited
            </h5>
            <div className="space-y-1">
              {capacityLimitedDeficits.map(({ flow, capacityLimit }) => (
                <div key={flow.resourceId} className="-mx-1 flex items-start justify-between gap-3 rounded px-1 py-1 text-sm hover:bg-accent">
                  <span className="flex flex-col text-foreground">
                    <span className="font-medium">{flow.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {capacityLimit}
                    </span>
                  </span>
                  <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                    {formatNet(flow.net)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {group.flows.some((flow) => !capacityLimitedIds.has(flow.resourceId)) && (
            <div className="space-y-1">
              <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Other deficits
              </h5>
              {group.flows
                .filter((flow) => !capacityLimitedIds.has(flow.resourceId))
                .map((flow) => (
                  <div key={flow.resourceId} className="-mx-2 flex justify-between rounded px-2 py-0.5 text-sm hover:bg-accent">
                    <span className="text-foreground">
                      {flow.name}
                    </span>
                    <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                      {formatNet(flow.net)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      );
    }

    if (group.flows.length === 0) {
      return <p className="text-sm text-muted-foreground">None</p>;
    }

    if (group.label === "Surplus") {
      const farmFlows = group.flows.filter(
        (flow) => cropProductResourceIds.has(flow.resourceId),
      );
      const otherFlows = group.flows.filter(
        (flow) => !cropProductResourceIds.has(flow.resourceId),
      );

      if (farmFlows.length > 0) {
        return (
          <div className="space-y-4">
            {otherFlows.length > 0 && (
              <div className="space-y-1">
                {otherFlows.map((flow) => (
                  <div key={flow.resourceId} className="-mx-2 flex justify-between rounded px-2 py-0.5 text-sm hover:bg-accent">
                    <span className="text-foreground">{flow.name}</span>
                    <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                      {formatNet(flow.net)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="inset-shadow-surface rounded-lg bg-surface-inset p-3">
              <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Farm surplus
              </h5>
              <div className="space-y-1">
                {farmFlows.map((flow) => (
                  <div key={flow.resourceId} className="-mx-1 flex justify-between rounded px-1 py-0.5 text-sm hover:bg-accent">
                    <span className="text-muted-foreground">{flow.name}</span>
                    <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                      {formatNet(flow.net)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
    }

    return (
      <div className="space-y-1">
        {group.flows.map((flow) => (
          <div key={flow.resourceId} className="-mx-2 flex justify-between rounded px-2 py-0.5 text-sm hover:bg-accent">
            <span className="text-foreground">
              {flow.name}
            </span>
            <span className={`font-mono font-semibold ${group.valueClassName}`}>
              {formatNet(flow.net)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (regularFlows.length === 0 && moduleInputFlows.length === 0 && externalEntries.length === 0 && !electricityFlow) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
        {groupByBalance ? "Factory Summary" : "Net Summary"}{" "}
        <span className="text-sm font-normal text-gray-500">(per 60s)</span>
      </h3>

      {(electricityFlow || electricityGenerationCapacityMw != null || (electricityConsumptionKw && electricityConsumptionKw > 0) || (workers && workers > 0)) && (() => {
        const generationMw = electricityFlow ? electricityFlow.net : 0;
        const consumptionMw = (electricityConsumptionKw ?? 0) / 1000;
        const netMw = generationMw - consumptionMw;
        const showsCapacity = electricityGenerationCapacityMw != null;

        return (
          <div className="mb-3 border-b border-gray-200 pb-3 dark:border-gray-700 space-y-1">
            {showsCapacity ? (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⚡ Consumption / generation cap
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {formatPower(consumptionMw)} / {formatPower(electricityGenerationCapacityMw)}
                </span>
              </div>
            ) : electricityFlow && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⚡ Generation
                </span>
                <span className="font-mono text-green-600 dark:text-green-400">
                  +{formatPower(generationMw)}
                </span>
              </div>
            )}
            {!showsCapacity && consumptionMw > 0 && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⚡ Consumption
                </span>
                <span className="font-mono text-red-600 dark:text-red-400">
                  {showsCapacity ? formatPower(consumptionMw) : `-${formatPower(consumptionMw)}`}
                </span>
              </div>
            )}
            {!showsCapacity && electricityFlow && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  ⚡ Net
                </span>
                <span className={`font-mono font-semibold ${netMw > 0 ? "text-yellow-500 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatPower(netMw)}
                </span>
              </div>
            )}
            {workers != null && workers > 0 && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  👷 {populationCapacity != null ? "Workers / population cap" : "Workers"}
                </span>
                <span className="font-mono font-semibold text-gray-500 dark:text-gray-400">
                  {populationCapacity != null
                    ? `${workers.toLocaleString("en-US")} / ${populationCapacity.toLocaleString("en-US")}`
                    : workers.toLocaleString("en-US")}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {externalEntries.length > 0 && (
        <div className="mb-3 space-y-1 border-b border-gray-200 pb-3 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            External Inputs
          </p>
          {externalEntries.map(([id, qty]) => (
            <div key={id} className="flex justify-between text-sm rounded px-2 -mx-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50">
              <span className="text-gray-500 dark:text-gray-400">
                {resources[id].name}
              </span>
              <span className="font-mono text-blue-500 dark:text-blue-400">
                {parseFloat(qty.toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      )}

      {moduleInputFlows.length > 0 && (
        <div className="mb-3 space-y-1 border-b border-border pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Module inputs
          </p>
          {moduleInputFlows.map((flow) => (
            <div key={flow.resourceId} className="-mx-2 flex justify-between rounded px-2 py-0.5 text-sm hover:bg-accent">
              <span className="text-muted-foreground">
                {flow.name}
              </span>
              <span className="font-mono font-semibold text-foreground">
                {parseFloat(Math.abs(flow.net).toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      )}

      {groupByBalance ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {displayedBalanceGroups.map((group) => (
            <section key={group.label} className="rounded-lg border border-border p-3">
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                {group.label}
              </h4>
              {renderBalanceGroup(group)}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {regularFlows.map((flow) => (
            <div
              key={flow.resourceId}
              className="flex justify-between text-sm rounded px-2 -mx-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            >
              <span className="text-gray-600 dark:text-gray-300">
                {flow.name}
              </span>
              <span
                className={`font-mono font-semibold ${
                  flow.net > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {flow.net > 0 ? `+${parseFloat(flow.net.toFixed(2))}` : parseFloat(flow.net.toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
