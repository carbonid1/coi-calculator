import { Button, Item, Tooltip } from "@carbonid1/design-system";
import {
  Boxes,
  ChevronRight,
  CircleMinus,
  CirclePause,
  CirclePlus,
  Hammer,
  MapPin,
  Play,
  Settings2,
  Tags,
  type LucideIcon,
} from "lucide-react";

import { type Module } from "../db/modules/modules";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  type MachineAllocationIssue,
  type MachineInventorySummary,
  type MachineZoneSummary,
  type SharedMachineClaim,
} from "../helpers/machine-allocation/machine-allocation";
import {
  getPlannedBuildSummaries,
  getPlannedConfigurationSummaries,
  getPlannedFollowUpSummaries,
  getPlanMismatchSummaries,
} from "../helpers/planned-builds/planned-builds";
import { BuildingStateCounts } from "./BuildingStateCounts";
import { getDataSourceSurfaceClassName } from "./DataSourceState";
import { ResourceToken } from "./ResourceToken";

interface Props {
  diagnostics: BuildingDiagnostic[];
  machineAllocationIssues?: MachineAllocationIssue[];
  machineInventory?: MachineInventorySummary[];
  machineZoneClaims?: readonly SharedMachineClaim[];
  machineZones?: MachineZoneSummary[];
  modules: Module[];
  onAssignMachineZone?: (zoneId: number, claimId: string | null) => void;
  onOpenBuilding: (diagnostic: BuildingDiagnostic) => void;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));
const getChecklistDetail = (planned: {
  buildingName: string;
  moduleName: string;
  recipeName: string;
}) => planned.recipeName === planned.buildingName || planned.recipeName === planned.moduleName
  ? null
  : planned.recipeName;

const mismatchIcons = {
  assign: Tags,
  build: Hammer,
  "cancel-build": CircleMinus,
  pause: CirclePause,
  unpause: Play,
  upgrade: Hammer,
  configure: Settings2,
  "add-animals": CirclePlus,
  "remove-animals": CircleMinus,
} as const;

const formatMismatchState = (mismatch: {
  current: number;
  target: number;
  direction: "at-least" | "at-most";
  format: "count" | "level" | "animals" | "configuration";
  currentLabel?: string;
  targetLabel?: string;
}) => {
  const operator = mismatch.direction === "at-least" ? "≥" : "≤";
  const unit = {
    count: "",
    level: "",
    animals: " chickens",
    configuration: " matching",
  }[mismatch.format];
  const formattedCurrent = mismatch.format === "level"
    ? `level ${formatCount(mismatch.current)}`
    : `${formatCount(mismatch.current)}${unit}`;
  const formattedTarget = mismatch.format === "level"
    ? `level ${operator}${formatCount(mismatch.target)}`
    : `${operator}${formatCount(mismatch.target)}${unit}`;
  const current = mismatch.currentLabel ?? formattedCurrent;
  const target = mismatch.targetLabel ?? formattedTarget;

  return `Synced ${current} · planned ${target}`;
};

interface ChecklistEntry {
  key: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  diagnostic: BuildingDiagnostic;
  icon: LucideIcon;
  action: string;
  state?: string;
  note?: string;
  later?: boolean;
}

const ChecklistRow = ({ entry, onOpenBuilding }: {
  entry: ChecklistEntry;
  onOpenBuilding: Props["onOpenBuilding"];
}) => {
  const Icon = entry.icon;
  const detail = getChecklistDetail(entry);
  const label = [entry.buildingName, detail, entry.action, entry.state, entry.note].filter(Boolean).join(" · ");

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={400} render={
        <Button
          variant="ghost"
          size="small"
          fullWidth
          aria-label={label}
          className="grid h-auto min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 px-2 py-1.5 text-left whitespace-normal sm:grid-cols-[1rem_minmax(0,2fr)_minmax(0,3fr)]"
          onClick={() => onOpenBuilding(entry.diagnostic)}
        />
      }>
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-highlight-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{entry.buildingName}</span>
          {(entry.diagnostic.outputResourceIds?.length ?? 0) > 0 && (
            <span data-checklist-outputs aria-hidden="true" className="mt-0.5 flex flex-wrap items-center gap-1">
              {entry.diagnostic.outputResourceIds?.map(resourceId => (
                <ResourceToken key={resourceId} resourceId={resourceId} interactive={false} />
              ))}
            </span>
          )}
        </span>
        <span className="col-start-2 min-w-0 sm:col-start-auto">
          <span className="block text-xs font-medium text-highlight-foreground">{entry.action}</span>
          {entry.state && <span className="block text-xs text-muted-foreground tabular-nums">{entry.state}</span>}
          {entry.note && <span className="block text-xs text-muted-foreground">{entry.note}</span>}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup className="max-w-[min(26rem,calc(100vw-1rem))] whitespace-normal">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export const PlannedBuildsView: React.FC<Props> = ({
  diagnostics,
  machineAllocationIssues = [],
  machineInventory = [],
  machineZoneClaims = [],
  machineZones = [],
  modules,
  onAssignMachineZone,
  onOpenBuilding,
}) => {
  const planMismatches = getPlanMismatchSummaries(modules, diagnostics);
  const mismatchKeys = new Set(planMismatches.map(({ key }) => key));
  const plannedBuilds = getPlannedBuildSummaries(diagnostics)
    .filter(({ key }) => !mismatchKeys.has(key));
  const plannedConfigurations = getPlannedConfigurationSummaries(modules, diagnostics)
    .filter(({ key }) => !mismatchKeys.has(key));
  const plannedFollowUps = getPlannedFollowUpSummaries(modules, diagnostics);
  const actionableMachineZones = machineZones.filter(zone => zone.needsAssignment);
  const hasMachineOwnershipActions = machineAllocationIssues.length > 0
    || actionableMachineZones.length > 0;
  const entries: ChecklistEntry[] = [
    ...planMismatches.map(mismatch => ({
      ...mismatch,
      icon: mismatchIcons[mismatch.actions[0]?.type ?? "configure"],
      action: mismatch.actions.map(({ label }) => label).join(" · "),
      state: formatMismatchState(mismatch),
    })),
    ...plannedBuilds.map(planned => ({
      ...planned,
      icon: Hammer,
      action: `${planned.count} to build`,
      state: `${formatCount(planned.built)} built · ${formatCount(planned.target)} target`,
    })),
    ...plannedConfigurations.map(planned => ({
      ...planned,
      icon: Settings2,
      action: `${planned.count} to configure`,
    })),
    ...plannedFollowUps.map(planned => ({
      ...planned,
      icon: CirclePause,
      action: `Pause ${planned.count} later`,
      later: true,
    })),
  ];
  const entriesByModule = Map.groupBy(entries, entry => entry.diagnostic.moduleId);
  const moduleGroups = [...entriesByModule].map(([moduleId, items]) => ({
    moduleId,
    moduleName: items[0]?.moduleName ?? moduleId,
    items: items.toSorted((left, right) => (
      Number(Boolean(left.later)) - Number(Boolean(right.later))
      || left.buildingName.localeCompare(right.buildingName)
      || left.recipeName.localeCompare(right.recipeName)
    )),
  })).toSorted((left, right) => left.moduleName.localeCompare(right.moduleName));

  if (entries.length === 0 && !hasMachineOwnershipActions) return null;

  return (
    <section aria-label="Plan checklist" className={getDataSourceSurfaceClassName(
      "planned",
      { className: "rounded-lg border p-3" },
    )}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Plan checklist
        </h4>
        {moduleGroups.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {entries.length} {entries.length === 1 ? "item" : "items"} · {moduleGroups.length} {moduleGroups.length === 1 ? "module" : "modules"}
          </span>
        )}
      </div>
      {moduleGroups.length > 0 && (
        <div className="mt-2 space-y-1">
          {moduleGroups.map(group => (
            <Item.Root
              as="details"
              key={group.moduleId}
              surface="inset"
              className="group/checklist-module block p-0"
              data-checklist-module={group.moduleId}
            >
              <Item.Root as="summary" interactive className="cursor-pointer list-none gap-2 px-2 py-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-open/checklist-module:rotate-90" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{group.moduleName}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"}
                </span>
              </Item.Root>
              <div className="space-y-1 px-1 pb-1">
                {group.items.filter(entry => !entry.later).map(entry => (
                  <ChecklistRow key={entry.key} entry={entry} onOpenBuilding={onOpenBuilding} />
                ))}
                {group.items.some(entry => entry.later) && (
                  <div className="space-y-1 pt-2">
                    <h5 className="px-2 text-xs font-medium text-muted-foreground">Later</h5>
                    {group.items.filter(entry => entry.later).map(entry => (
                      <ChecklistRow key={entry.key} entry={entry} onOpenBuilding={onOpenBuilding} />
                    ))}
                  </div>
                )}
              </div>
            </Item.Root>
          ))}
        </div>
      )}
      {hasMachineOwnershipActions && machineInventory.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">
            Unresolved machine inventory
          </h5>
          <div className="mt-1 grid gap-1">
            {machineInventory.map(machine => (
              <div
                key={machine.kind}
                className="flex items-center justify-between gap-3 rounded px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Boxes
                    aria-hidden="true"
                    className="size-4 shrink-0 text-success"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {machine.machineName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {machine.assigned} assigned · {machine.unresolved} unresolved
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs text-muted-foreground">
                  <span className="block font-medium text-foreground">
                    {machine.built} built
                  </span>
                  <BuildingStateCounts
                    active={machine.running}
                    paused={machine.paused}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {actionableMachineZones.length > 0 && onAssignMachineZone && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">
            Vehicle zones to assign
          </h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign each ambiguous zone once. Current and future machines inside it will follow.
          </p>
          <div className="mt-1 grid gap-1">
            {actionableMachineZones.map(zone => {
              const zoneLabel = zone.name?.trim() || `Vehicle zone ${zone.id}`;
              const zoneIdentifier = zone.id < 0 ? "Default zone" : `Zone ${zone.id}`;

              return (
                <div
                  key={zone.id}
                  className="flex flex-col gap-2 rounded px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin
                      aria-hidden="true"
                      className="size-4 shrink-0 text-highlight-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {zoneLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {zoneIdentifier} · {zone.built} {zone.machineName}{zone.built === 1 ? "" : "s"}
                      </span>
                      <BuildingStateCounts
                        active={zone.running}
                        paused={zone.paused}
                      />
                    </span>
                  </span>
                  <span
                    aria-label={`Assign ${zoneLabel}`}
                    className="flex shrink-0 flex-wrap gap-1"
                    role="group"
                  >
                    {machineZoneClaims.map(claim => {
                      const selected = zone.assignedClaimId === claim.id;

                      return (
                        <Button
                          key={claim.id}
                          type="button"
                          variant="ghost"
                          size="small"
                          selected={selected}
                          aria-pressed={selected}
                          className="h-7 px-2"
                          onClick={() => onAssignMachineZone(
                            zone.id,
                            selected ? null : claim.id,
                          )}
                        >
                          {claim.moduleName}
                        </Button>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {machineAllocationIssues.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">
            Unresolved machine ownership
          </h5>
          <div className="mt-1 grid gap-1">
            {machineAllocationIssues.map(issue => (
              <div
                key={issue.id}
                className="flex items-start gap-2 rounded px-2 py-1.5"
              >
                <Tags
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-highlight-foreground"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {issue.count} × {issue.machineName}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {issue.message}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
