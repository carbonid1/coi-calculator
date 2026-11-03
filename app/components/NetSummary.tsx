import { Button, Tooltip } from "@carbonid1/design-system";
import { type ReactNode, type Ref } from "react";

import { type ModuleResourceTransfer } from "../db/module-resource-links";
import { type Module } from "../db/modules/modules";
import { type ResourceId } from "../db/resources";
import { type UnityBudget } from "../db/unity";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  type BlockedSurplusRoute,
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../helpers/calculate/calculate";
import { type ContractResourceFlow } from "../helpers/contracts/contract-resource-flows";
import { getDeficitRootCause } from "../helpers/deficit-root-cause/deficit-root-cause";
import {
  type MachineAllocationIssue,
  type MachineInventorySummary,
  type MachineZoneSummary,
  type SharedMachineClaim,
} from "../helpers/machine-allocation/machine-allocation";
import { getSurplusRootCause } from "../helpers/surplus-root-cause/surplus-root-cause";
import { BuildingAttentionView } from "./BuildingAttentionView";
import { type KeepReadyChange } from "./KeepReadyMenu";
import { ModuleBalance } from "./ModuleBalance";
import { PlannedBuildsView } from "./PlannedBuildsView";
import { isReportedFactoryDeficit } from "./net-summary-flows";

interface Props {
  headingRef?: Ref<HTMLHeadingElement>;
  hasPlannedChanges?: boolean;
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
  /** Sources and sinks; their intake is recipe-accounted consumption too. */
  passiveResults?: PassiveResult[];
  contractFlows?: readonly ContractResourceFlow[];
  blockedRoutes?: BlockedSurplusRoute[];
  buildingDiagnostics?: BuildingDiagnostic[];
  machineAllocationIssues?: MachineAllocationIssue[];
  machineInventory?: MachineInventorySummary[];
  machineZoneClaims?: readonly SharedMachineClaim[];
  machineZones?: MachineZoneSummary[];
  plannedModules?: Module[];
  requestedImports?: Partial<Record<ResourceId, number>>;
  requestedExports?: Partial<Record<ResourceId, number>>;
  moduleId?: string;
  transfersIncludedInBalance?: boolean;
  resourceTransfers?: readonly ModuleResourceTransfer[];
  onAssignMachineZone?: (zoneId: number, claimId: string | null) => void;
  onOpenBuilding?: (diagnostic: BuildingDiagnostic) => void;
  onKeepReadyChange?: KeepReadyChange;
  onInspectResource?: (resourceId: ResourceId) => void;
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

const formatPowerMargin = (value: number) => `${value > BALANCE_THRESHOLD ? "+" : ""}${formatPower(value)}`;

const SummaryMetric = ({ label, detail, breakdown, children }: {
  label: string;
  detail?: string;
  breakdown?: string;
  children: ReactNode;
}) => (
  <div className="min-w-0 rounded-lg bg-surface-inset p-2.5 inset-shadow-surface">
    <dt className="flex min-h-9 flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground sm:min-h-0">
      {label}
      {detail && <span className="text-xs font-normal text-muted-foreground">{detail}</span>}
    </dt>
    <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base">
      {breakdown ? <Tooltip label={breakdown} maxWidth={320}>
        <span tabIndex={0} className="rounded outline-hidden focus-visible:ring-2 focus-visible:ring-ring">{children}</span>
      </Tooltip> : children}
    </dd>
  </div>
);

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
  hasPlannedChanges = false,
  regularResults = [],
  passiveResults = [],
  contractFlows = [],
  blockedRoutes = [],
  buildingDiagnostics = [],
  machineAllocationIssues = [],
  machineInventory = [],
  machineZoneClaims = [],
  machineZones = [],
  plannedModules = [],
  requestedImports = {},
  requestedExports = {},
  moduleId,
  transfersIncludedInBalance = false,
  resourceTransfers = [],
  onAssignMachineZone,
  onOpenBuilding,
  onKeepReadyChange,
  onInspectResource,
  headingRef,
}) => {
  const electricityFlow = flows.find((flow) => flow.resourceId === "electricity");
  const computingFlow = flows.find((flow) => flow.resourceId === "computing");
  const materialFlows = flows.filter((flow) => (
    flow.resourceId !== "electricity" && flow.resourceId !== "computing"
  ));
  const regularFlows = materialFlows;
  const balanceGroups = [
    {
      label: "Deficit",
      flows: regularFlows.filter(isReportedFactoryDeficit),
      valueClassName: "text-foreground",
    },
    {
      label: "Surplus",
      flows: regularFlows.filter((flow) => flow.net > BALANCE_THRESHOLD),
      valueClassName: "text-foreground",
    },
  ].map((group) => ({
    ...group,
    flows: group.flows.toSorted((a, b) => a.name.localeCompare(b.name)),
  }));
  // Every factory deficit carries its reason; saturated producers are the
  // actionable case and stay in their own box.
  const explainedDeficits = groupByBalance
    ? (balanceGroups
        .find((group) => group.label === "Deficit")
        ?.flows.map((flow) => ({
          flow,
          rootCause: getDeficitRootCause(flow.resourceId, regularResults, flows, passiveResults, contractFlows),
        })) ?? [])
    : [];
  const capacityLimitedDeficits = explainedDeficits
    .filter(({ rootCause }) => rootCause.kind === "at-capacity")
    .map(({ flow, rootCause }) => ({ flow, capacityLimit: rootCause.detail }));
  const otherDeficits = explainedDeficits
    .filter(({ rootCause }) => rootCause.kind !== "at-capacity");
  // A surplus that an active line could consume is unrouted, not an end product.
  const unroutedSurpluses = balanceGroups
    .find((group) => group.label === "Surplus")
    ?.flows.flatMap((flow) => {
      const rootCause = getSurplusRootCause(
        flow.resourceId,
        regularResults,
        blockedRoutes,
        passiveResults,
        flow.net,
      );

      return rootCause.kind === "terminal" ? [] : [{ flow, detail: rootCause.detail }];
    }) ?? [];
  const unroutedSurplusIds = new Set(
    unroutedSurpluses.map(({ flow }) => flow.resourceId),
  );
  const hasOperationalSummary = (
    electricityFlow != null
    || electricityGenerationCapacityMw != null
    || (electricityConsumptionKw ?? 0) > 0
    || computingFlow != null
    || computingGenerationCapacityTflops != null
    || (computingConsumptionTflops ?? 0) > 0
    || (workers ?? 0) > 0
    || unityBudget != null
  );
  const renderResourceName = (flow: ResourceFlow) => onInspectResource ? (
    <Button variant="link" size="small" className="h-auto justify-start p-0 text-left"
      aria-label={`Inspect ${flow.name} supply`} onClick={() => onInspectResource(flow.resourceId)}>
      {flow.name}
    </Button>
  ) : <span>{flow.name}</span>;
  const renderBalanceGroup = (group: (typeof balanceGroups)[number]) => {
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
                    {renderResourceName(flow)}
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

          {otherDeficits.length > 0 && (
            <div className="space-y-1">
              <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Other deficits
              </h5>
              {otherDeficits.map(({ flow, rootCause }) => (
                <div key={flow.resourceId} className="-mx-2 flex items-start justify-between gap-3 rounded px-2 py-1 text-sm hover:bg-accent">
                  <span className="flex flex-col text-foreground">
                    {renderResourceName(flow)}
                    <span className="text-xs text-muted-foreground">
                      {rootCause.detail}
                    </span>
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

    if (group.label === "Deficit" && otherDeficits.length > 0) {
      return (
        <div className="space-y-1">
          {otherDeficits.map(({ flow, rootCause }) => (
            <div key={flow.resourceId} className="-mx-2 flex items-start justify-between gap-3 rounded px-2 py-1 text-sm hover:bg-accent">
              <span className="flex flex-col text-foreground">
                {renderResourceName(flow)}
                <span className="text-xs text-muted-foreground">
                  {rootCause.detail}
                </span>
              </span>
              <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                {formatNet(flow.net)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (group.flows.length === 0) {
      return <p className="text-sm text-muted-foreground">None</p>;
    }

    if (group.label === "Surplus" && unroutedSurpluses.length > 0) {
      const otherFlows = group.flows.filter(
        (flow) => !unroutedSurplusIds.has(flow.resourceId),
      );

      return (
        <div className="space-y-4">
          <div className="inset-shadow-surface rounded-lg bg-surface-inset p-3">
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
              Unrouted
            </h5>
            <div className="space-y-1">
              {unroutedSurpluses.map(({ flow, detail }) => (
                <div key={flow.resourceId} className="-mx-1 flex items-start justify-between gap-3 rounded px-1 py-1 text-sm hover:bg-accent">
                  <span className="flex flex-col text-foreground">
                    <span className="font-medium">{flow.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                  <span className={`font-mono font-semibold tabular-nums ${group.valueClassName}`}>
                    {formatNet(flow.net)}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
        </div>
      );
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
    materialFlows.length === 0 && !electricityFlow && !computingFlow
    && electricityGenerationCapacityMw == null && !electricityConsumptionKw
    && !computingConsumptionTflops && computingGenerationCapacityTflops == null
    && !workers && !unityBudget && Object.keys(requestedImports).length === 0
    && Object.keys(requestedExports).length === 0
    && !resourceTransfers.some(transfer => transfer.sourceModuleId === moduleId || transfer.targetModuleId === moduleId)
  ) return null;

  const consumptionMw = (electricityConsumptionKw ?? 0) / 1000;
  const computingDemand = computingConsumptionTflops ?? 0;
  const generationMw = electricityFlow?.net ?? 0;

  return (
    <div className="space-y-3 rounded-lg bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="font-semibold text-foreground outline-hidden">
          {groupByBalance ? "Factory Summary" : "Summary"}
        </h3>
        <Tooltip label={hasPlannedChanges
          ? "Includes planned buildings and operating changes. Resource flows are calculated per production cycle."
          : "Calculated from the synced configuration. Resource flows are per production cycle."} maxWidth={320}>
          <span tabIndex={0} className="rounded text-xs text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
            {hasPlannedChanges ? "Projected" : "Calculated"} · flows / cycle
          </span>
        </Tooltip>
      </div>

      {hasOperationalSummary && (
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {electricityGenerationCapacityMw != null ? (
            <SummaryMetric label="Electricity" detail="Capacity margin"
              breakdown={`${formatPower(consumptionMw)} demand / ${formatPower(electricityGenerationCapacityMw)} generation capacity.`}>
              {formatPowerMargin(electricityGenerationCapacityMw - consumptionMw)}
            </SummaryMetric>
          ) : <>
            {consumptionMw > 0 && (
              <SummaryMetric label="Electricity" detail="Demand">{formatPower(consumptionMw)}</SummaryMetric>
            )}
            {electricityFlow && (
              <SummaryMetric label="Electricity" detail="Net"
                breakdown={`${formatPower(generationMw)} generation / ${formatPower(consumptionMw)} demand.`}>
                {formatPowerMargin(generationMw - consumptionMw)}
              </SummaryMetric>
            )}
          </>}
          {(computingGenerationCapacityTflops != null || computingDemand > 0) && (
            <SummaryMetric label="Computing" detail={computingGenerationCapacityTflops != null ? "Capacity margin" : "Demand"}
              breakdown={computingGenerationCapacityTflops != null
                ? `${formatCapacity(computingDemand)} demand / ${formatCapacity(computingGenerationCapacityTflops)} TFLOPS capacity.` : undefined}>
              {computingGenerationCapacityTflops != null ? formatNet(computingGenerationCapacityTflops - computingDemand) : formatCapacity(computingDemand)} TFLOPS
            </SummaryMetric>
          )}
          {unityBudget && (
            <SummaryMetric label="Unity" detail={unityBudget.generationPerCycle == null ? "Demand" : "Net"}
              breakdown={`${formatCapacity(unityBudget.consumptionPerCycle)} demand / ${unityBudget.generationPerCycle == null ? "generation unavailable" : `${formatCapacity(unityBudget.generationPerCycle)} generation`} per production cycle.`}>
              {unityBudget.generationPerCycle == null
                ? formatCapacity(unityBudget.consumptionPerCycle)
                : formatNet(unityBudget.generationPerCycle - unityBudget.consumptionPerCycle)} / cycle
            </SummaryMetric>
          )}
          {workers != null && workers > 0 && (
            <SummaryMetric label="Workers" detail={populationCapacity != null ? "Demand / population cap" : "Demand"}>
              {populationCapacity != null
                ? `${workers.toLocaleString("en-US")} / ${populationCapacity.toLocaleString("en-US")}`
                : workers.toLocaleString("en-US")}
            </SummaryMetric>
          )}
        </dl>
      )}

      {groupByBalance ? (
        <>
          {onOpenBuilding && (
            <>
              <PlannedBuildsView diagnostics={buildingDiagnostics} machineAllocationIssues={machineAllocationIssues}
                machineInventory={machineInventory} machineZoneClaims={machineZoneClaims} machineZones={machineZones}
                modules={plannedModules} onAssignMachineZone={onAssignMachineZone} onOpenBuilding={onOpenBuilding} />
              <BuildingAttentionView diagnostics={buildingDiagnostics} onOpenBuilding={onOpenBuilding} onKeepReadyChange={onKeepReadyChange} />
            </>
          )}
          <div className="grid gap-2 lg:grid-cols-2">
            {balanceGroups.map(group => (
              <section key={group.label} className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
                <h4 className="mb-2 text-sm font-semibold text-foreground">{group.label} / cycle</h4>
                {renderBalanceGroup(group)}
              </section>
            ))}
          </div>
        </>
      ) : (
        <ModuleBalance flows={materialFlows} moduleId={moduleId} transfers={resourceTransfers}
          requestedImports={requestedImports} requestedExports={requestedExports}
          transfersIncludedInBalance={transfersIncludedInBalance}
          notes={Object.fromEntries(unroutedSurpluses.map(({ flow, detail }) => [flow.resourceId, detail]))} />
      )}
    </div>
  );
};
