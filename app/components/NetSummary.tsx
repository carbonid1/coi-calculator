import { Tooltip } from "@carbonid1/design-system";
import { ArrowLeft, ArrowRight, Cpu, Sparkles } from "lucide-react";

import { cropProductResourceIds } from "../db/crop-farming";
import { type ModuleResourceTransfer } from "../db/module-resource-links";
import { type Module } from "../db/modules/modules";
import { resources, type ResourceId } from "../db/resources";
import { type UnityBudget } from "../db/unity";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  type RegularResult,
  type ResourceFlow,
} from "../helpers/calculate/calculate";
import { getSurplusCapacityLimit } from "../helpers/capacity-limit/capacity-limit";
import {
  type MachineAllocationIssue,
  type MachineInventorySummary,
  type MachineZoneSummary,
  type SharedMachineClaim,
} from "../helpers/machine-allocation/machine-allocation";
import { typedEntries } from "../helpers/typed-entries/typed-entries";
import { BuildingAttentionView } from "./BuildingAttentionView";
import { MachineZoneMappingsView } from "./MachineZoneMappingsView";
import { PlannedBuildsView } from "./PlannedBuildsView";
import { isReportedFactoryDeficit } from "./net-summary-flows";

interface Props {
  flows: ResourceFlow[];
  workers?: number;
  electricityConsumptionKw?: number;
  electricityGenerationCapacityMw?: number;
  computingConsumptionTflops?: number;
  computingGenerationCapacityTflops?: number;
  populationCapacity?: number;
  unityBudget?: UnityBudget;
  groupByBalance?: boolean;
  regularResults?: RegularResult[];
  buildingDiagnostics?: BuildingDiagnostic[];
  machineAllocationIssues?: MachineAllocationIssue[];
  machineInventory?: MachineInventorySummary[];
  machineZoneClaims?: readonly SharedMachineClaim[];
  machineZones?: MachineZoneSummary[];
  plannedModules?: Module[];
  requestedExports?: Partial<Record<ResourceId, number>>;
  moduleId?: string;
  resourceTransfers?: readonly ModuleResourceTransfer[];
  onAssignMachineZone?: (zoneId: number, claimId: string | null) => void;
  onOpenBuilding?: (diagnostic: BuildingDiagnostic) => void;
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
const formatBuildingCapacity = (value: number) => parseFloat(value.toFixed(3));

const getComputingSummary = (demand: number, capacity?: number) => {
  if (capacity == null) {
    return {
      label: "Computing demand",
      value: `${formatCapacity(demand)} TFLOPS`,
    };
  }

  if (demand > 0) {
    return {
      label: "Computing demand / capacity",
      value: `${formatCapacity(demand)} / ${formatCapacity(capacity)} TFLOPS`,
    };
  }

  return {
    label: "Computing capacity",
    value: `${formatCapacity(capacity)} TFLOPS`,
  };
};

const getCapacityLimit = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
) => {
  const producers = regularResults.filter((result) => (
    result.activeBuildings > 0
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
      ? Math.max(...capacityResults.map((result) => result.activeBuildings))
      : producer.activeBuildings;
    const used = capacityResults.reduce((total, result) => (
      total + result.activeBuildings * result.supplyRatio
    ), 0);

    return {
      atCapacity: capacity > 0 && capacity - used <= BALANCE_THRESHOLD,
      capacity,
      label: producer.recipe.sharedCapacity?.label ?? producer.recipe.building,
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

export const NetSummary: React.FC<Props> = ({
  flows,
  workers,
  electricityConsumptionKw,
  electricityGenerationCapacityMw,
  computingConsumptionTflops,
  computingGenerationCapacityTflops,
  populationCapacity,
  unityBudget,
  groupByBalance = false,
  regularResults = [],
  buildingDiagnostics = [],
  machineAllocationIssues = [],
  machineInventory = [],
  machineZoneClaims = [],
  machineZones = [],
  plannedModules = [],
  requestedExports = {},
  moduleId,
  resourceTransfers = [],
  onAssignMachineZone,
  onOpenBuilding,
}) => {
  const requestedExportRows = typedEntries(requestedExports)
    .filter(([, quantity]) => quantity > 0)
    .toSorted(([left], [right]) => (
      resources[left].name.localeCompare(resources[right].name)
    ));
  const requestedExportIds = new Set(
    requestedExportRows.map(([resourceId]) => resourceId),
  );
  const inboundTransfers = resourceTransfers
    .filter(transfer => transfer.targetModuleId === moduleId)
    .toSorted((left, right) => (
      resources[left.resourceId].name.localeCompare(resources[right.resourceId].name)
    ));
  const outboundTransfers = resourceTransfers
    .filter(transfer => transfer.sourceModuleId === moduleId)
    .toSorted((left, right) => (
      resources[left.resourceId].name.localeCompare(resources[right.resourceId].name)
    ));
  const electricityFlow = flows.find((flow) => flow.resourceId === "electricity");
  const computingFlow = flows.find((flow) => flow.resourceId === "computing");
  const materialFlows = flows.filter((flow) => (
    flow.resourceId !== "electricity" && flow.resourceId !== "computing"
  ));
  const moduleInputFlows = groupByBalance
    ? []
    : materialFlows
        .filter((flow) => (
          flow.net < -BALANCE_THRESHOLD
          && !requestedExportIds.has(flow.resourceId)
        ))
        .toSorted((a, b) => a.name.localeCompare(b.name));
  const regularFlows = groupByBalance
    ? materialFlows
    : materialFlows.filter((flow) => flow.net >= -BALANCE_THRESHOLD);
  const balanceGroups = [
    {
      label: "Deficit",
      flows: regularFlows.filter(isReportedFactoryDeficit),
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
  const capacityLimitedSurpluses = balanceGroups
    .find((group) => group.label === "Surplus")
    ?.flows.flatMap((flow) => {
      const capacityLimit = getSurplusCapacityLimit(flow.resourceId, regularResults);

      return capacityLimit ? [{ flow, capacityLimit }] : [];
    }) ?? [];
  const capacityLimitedSurplusIds = new Set(
    capacityLimitedSurpluses.map(({ flow }) => flow.resourceId),
  );
  const hasOperationalSummary = (
    electricityFlow != null
    || electricityGenerationCapacityMw != null
    || (electricityConsumptionKw ?? 0) > 0
    || computingFlow != null
    || computingGenerationCapacityTflops != null
    || (computingConsumptionTflops ?? 0) > 0
    || (workers ?? 0) > 0
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
        (flow) => (
          cropProductResourceIds.has(flow.resourceId)
          && !capacityLimitedSurplusIds.has(flow.resourceId)
        ),
      );
      const otherFlows = group.flows.filter(
        (flow) => (
          !cropProductResourceIds.has(flow.resourceId)
          && !capacityLimitedSurplusIds.has(flow.resourceId)
        ),
      );

      if (capacityLimitedSurpluses.length > 0 || farmFlows.length > 0) {
        return (
          <div className="space-y-4">
            {capacityLimitedSurpluses.length > 0 && (
              <div className="inset-shadow-surface rounded-lg bg-surface-inset p-3">
                <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                  Capacity limited
                </h5>
                <div className="space-y-1">
                  {capacityLimitedSurpluses.map(({ flow, capacityLimit }) => (
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
            )}

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

            {farmFlows.length > 0 && (
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
            )}
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

  if (
    regularFlows.length === 0
    && moduleInputFlows.length === 0
    && !electricityFlow
    && !computingFlow
    && !electricityConsumptionKw
    && !computingConsumptionTflops
    && computingGenerationCapacityTflops == null
    && !workers
    && requestedExportRows.length === 0
    && inboundTransfers.length === 0
    && outboundTransfers.length === 0
  ) return null;

  const renderTransfer = (
    transfer: ModuleResourceTransfer,
    direction: "inbound" | "outbound",
  ) => {
    const inbound = direction === "inbound";
    const counterparty = inbound
      ? transfer.sourceModuleName
      : transfer.targetModuleName;
    const requested = transfer.requestedQuantity;
    const hasShortfall = requested - transfer.quantity > BALANCE_THRESHOLD;
    let policy: string;

    if (transfer.mode === "surplus-only") {
      policy = inbound
        ? `Uses only ${transfer.sourceModuleName} surplus and does not start production there.`
        : "Transfers only surplus remaining after this module's own consumption.";
    } else {
      policy = inbound
        ? `Demand here can start production in ${transfer.sourceModuleName}.`
        : `${transfer.targetModuleName} demand can start production here.`;
    }
    const quantity = hasShortfall
      ? `${formatCapacity(transfer.quantity)} of ${formatCapacity(requested)} requested`
      : `${formatCapacity(transfer.quantity)} per production cycle`;
    const Icon = inbound ? ArrowLeft : ArrowRight;

    return (
      <Tooltip
        key={transfer.id}
        label={`Dedicated ${inbound ? "from" : "to"} ${counterparty}. ${policy} ${quantity}.`}
        maxWidth={340}
        className="flex w-full"
      >
        <div className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded px-2 py-0.5 text-sm hover:bg-accent">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-foreground">{resources[transfer.resourceId].name}</span>
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{counterparty}</span>
            </span>
          </span>
          <span className={`shrink-0 font-mono font-semibold tabular-nums ${
            hasShortfall ? "text-destructive" : "text-primary"
          }`}>
            {formatCapacity(transfer.quantity)}
          </span>
        </div>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-3 rounded-lg bg-card p-3 shadow-card">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
        {groupByBalance ? "Factory Summary" : "Net Summary"}{" "}
        <span className="text-sm font-normal text-gray-500">(per 60s)</span>
      </h3>

      {hasOperationalSummary && (() => {
        const generationMw = electricityFlow?.net ?? 0;
        const consumptionMw = (electricityConsumptionKw ?? 0) / 1000;
        const netMw = generationMw - consumptionMw;
        const showsCapacity = electricityGenerationCapacityMw != null;
        const computingDemand = computingConsumptionTflops ?? 0;
        const showsComputingCapacity = computingGenerationCapacityTflops != null;
        const computingSummary = getComputingSummary(
          computingDemand,
          computingGenerationCapacityTflops,
        );

        return (
          <div className="space-y-1 border-b border-gray-200 pb-3 dark:border-gray-700">
            {showsCapacity && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⚡ Consumption / generation cap
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {formatPower(consumptionMw)} / {formatPower(electricityGenerationCapacityMw)}
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
            {(showsComputingCapacity || computingDemand > 0) && (
              <div className="-mx-2 flex items-center justify-between rounded px-2 py-1 hover:bg-accent">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cpu aria-hidden="true" className="size-3.5 shrink-0" />
                  {computingSummary.label}
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {computingSummary.value}
                </span>
              </div>
            )}
            {unityBudget && (
              <div className="-mx-2 flex items-center justify-between rounded px-2 py-1 hover:bg-accent">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
                  Unity demand / generation
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCapacity(unityBudget.consumptionPerCycle)} / {formatCapacity(unityBudget.generationPerCycle)}
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

      {(
        requestedExportRows.length > 0
        || moduleInputFlows.length > 0
        || inboundTransfers.length > 0
        || outboundTransfers.length > 0
      ) && (
        <div className="space-y-1 border-b border-border pb-3">
          {moduleInputFlows.map((flow) => (
            <div key={flow.resourceId} className="-mx-2 flex justify-between rounded px-2 py-0.5 text-sm hover:bg-accent">
              <span className="text-muted-foreground">
                {flow.name}
              </span>
              <span className="font-mono font-semibold text-destructive">
                {parseFloat(Math.abs(flow.net).toFixed(2))}
              </span>
            </div>
          ))}
          {inboundTransfers.map(transfer => renderTransfer(transfer, "inbound"))}
          {(
            (requestedExportRows.length > 0 || outboundTransfers.length > 0)
            && (moduleInputFlows.length > 0 || inboundTransfers.length > 0)
          ) && (
            <div aria-hidden="true" className="my-2 border-t border-border" />
          )}
          {requestedExportRows.map(([resourceId, requested]) => {
            const resourceName = resources[resourceId].name;
            const deficit = Math.max(
              0,
              -(flows.find((flow) => flow.resourceId === resourceId)?.net ?? 0),
            );
            const projected = Math.max(0, requested - deficit);
            const hasShortfall = deficit > BALANCE_THRESHOLD;
            const tooltip = hasShortfall
              ? `Planned export target: ${formatCapacity(requested)} ${resourceName} per production cycle. Projected delivery: ${formatCapacity(projected)}.`
              : `Planned export target: ${formatCapacity(requested)} ${resourceName} per production cycle.`;

            return (
              <Tooltip key={resourceId} label={tooltip} maxWidth={320} className="flex w-full">
                <div
                  className="-mx-2 flex w-[calc(100%+1rem)] items-baseline justify-between rounded bg-highlight-muted px-2 py-0.5 text-sm text-highlight-foreground hover:bg-accent"
                  data-data-source="planned"
                >
                  <span>{resourceName}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCapacity(requested)}
                  </span>
                </div>
              </Tooltip>
            );
          })}
          {outboundTransfers.map(transfer => renderTransfer(transfer, "outbound"))}
        </div>
      )}

      {groupByBalance ? (
        <>
          {onOpenBuilding && (
            <>
              {onAssignMachineZone && (
                <MachineZoneMappingsView
                  claims={machineZoneClaims}
                  zones={machineZones}
                  onAssign={onAssignMachineZone}
                />
              )}
              <PlannedBuildsView
                diagnostics={buildingDiagnostics}
                machineAllocationIssues={machineAllocationIssues}
                machineInventory={machineInventory}
                machineZoneClaims={machineZoneClaims}
                machineZones={machineZones}
                modules={plannedModules}
                onAssignMachineZone={onAssignMachineZone}
                onOpenBuilding={onOpenBuilding}
              />
              <BuildingAttentionView
                diagnostics={buildingDiagnostics}
                onOpenBuilding={onOpenBuilding}
              />
            </>
          )}
          <div className="grid gap-2 lg:grid-cols-2">
            {displayedBalanceGroups.map((group) => (
              <section key={group.label} className="rounded-lg border border-border p-3">
                <h4 className="mb-3 text-sm font-semibold text-foreground">
                  {group.label}
                </h4>
                {renderBalanceGroup(group)}
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-1">
          {regularFlows.map((flow) => (
            <div
              key={flow.resourceId}
              className="flex justify-between text-sm rounded px-2 -mx-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            >
              <span className="text-foreground">
                {flow.name}
              </span>
              <span
                className={`font-mono font-semibold ${
                  flow.net > 0
                    ? "text-success"
                    : "text-destructive"
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
