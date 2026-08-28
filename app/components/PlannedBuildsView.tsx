import { Button, Tooltip } from "@carbonid1/design-system";
import {
  Boxes,
  CircleMinus,
  CirclePlus,
  Hammer,
  MapPin,
  Pause,
  Play,
  Settings2,
  Tags,
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
import { getDataSourceSurfaceClassName } from "./DataSourceState";

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
}) => planned.recipeName === planned.buildingName
  ? planned.moduleName
  : planned.recipeName;
const getChecklistLocation = (planned: {
  buildingName: string;
  moduleName: string;
  recipeName: string;
}) => planned.recipeName === planned.buildingName
  ? `in ${planned.moduleName}`
  : `for ${planned.recipeName} in ${planned.moduleName}`;

const mismatchIcons = {
  assign: Tags,
  build: Hammer,
  pause: Pause,
  unpause: Play,
  upgrade: Hammer,
  configure: Settings2,
  "add-animals": CirclePlus,
  "remove-animals": CircleMinus,
} as const;

const formatMismatchState = (mismatch: {
  current: number;
  currentSource: "default" | "modeled" | "synced";
  target: number;
  direction: "at-least" | "at-most";
  format: "count" | "level" | "animals" | "configuration";
  currentLabel?: string;
  targetLabel?: string;
}) => {
  const source = mismatch.currentSource === "synced" ? "Synced" : "Modeled";
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

  return `${source} ${current} · planned ${target}`;
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
  const plannedConfigurations = getPlannedConfigurationSummaries(diagnostics)
    .filter(({ key }) => !mismatchKeys.has(key));
  const plannedFollowUps = getPlannedFollowUpSummaries(modules, diagnostics);
  const actionableMachineZones = machineZones.filter(zone => zone.needsAssignment);
  const hasMachineOwnershipActions = machineAllocationIssues.length > 0
    || actionableMachineZones.length > 0;

  if (
    planMismatches.length === 0
    && plannedBuilds.length === 0
    && plannedConfigurations.length === 0
    && plannedFollowUps.length === 0
    && !hasMachineOwnershipActions
  ) return null;

  return (
    <section className={getDataSourceSurfaceClassName(
      "planned",
      { className: "rounded-lg border p-3" },
    )}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Plan checklist
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Complete these changes to make the projected Factory Total achievable.
      </p>
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
                  <span className="block">
                    {machine.running} running · {machine.paused} paused
                  </span>
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
              const assignedClaim = machineZoneClaims.find(
                claim => claim.id === zone.assignedClaimId,
              );

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
                        {` · ${zone.running} running · ${zone.paused} paused`}
                      </span>
                    </span>
                  </span>
                  {zone.needsAssignment && (
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
                  )}
                  {!zone.needsAssignment && assignedClaim && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      → {assignedClaim.moduleName}
                    </span>
                  )}
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
      {planMismatches.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">
            Plan mismatches
          </h5>
          <div className="mt-1 grid gap-1">
            {planMismatches.map((mismatch) => {
              const primaryAction = mismatch.actions[0];
              const Icon = mismatchIcons[primaryAction?.type ?? "configure"];
              const actionLabel = mismatch.actions.map(({ label }) => label).join(" · ");

              return (
                <Tooltip
                  key={mismatch.key}
                  label={`Factory Total keeps the planned target until the live value is ${mismatch.direction === "at-least" ? "at least" : "at most"} ${mismatch.target}. ${actionLabel}.`}
                  maxWidth={320}
                >
                  <Button
                    variant="ghost"
                    size="small"
                    fullWidth
                    className="h-auto justify-between px-2 py-1.5 text-left"
                    onClick={() => onOpenBuilding(mismatch.diagnostic)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-highlight-foreground"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {mismatch.buildingName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {getChecklistDetail(mismatch)}
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 shrink text-right">
                      <span className="block text-xs font-medium text-highlight-foreground">
                        {actionLabel}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {formatMismatchState(mismatch)}
                      </span>
                    </span>
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
      {plannedBuilds.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">Buildings to construct</h5>
          <div className="mt-1 grid gap-1 md:grid-cols-2">
            {plannedBuilds.map((planned) => {
              return (
                <Tooltip
                  key={planned.key}
                  label={`Factory Total assumes this capacity is available. Remaining to build: ${planned.count} × ${planned.buildingName} ${getChecklistLocation(planned)}.`}
                  maxWidth={320}
                >
                  <Button
                    variant="ghost"
                    size="small"
                    fullWidth
                    className="h-auto justify-between px-2 py-1.5 text-left"
                    onClick={() => onOpenBuilding(planned.diagnostic)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Hammer
                        aria-hidden="true"
                        className="size-4 shrink-0 text-highlight-foreground"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {planned.buildingName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {getChecklistDetail(planned)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-medium text-highlight-foreground">
                        {planned.count} to build
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {formatCount(planned.built)} built · {formatCount(planned.target)} target
                      </span>
                    </span>
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
      {plannedConfigurations.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">Buildings to configure</h5>
          <div className="mt-1 grid gap-1 md:grid-cols-2">
            {plannedConfigurations.map((planned) => (
              <Tooltip
                key={planned.key}
                label={`Factory Total uses planned settings for ${planned.count} × ${planned.buildingName} ${getChecklistLocation(planned)}.`}
                maxWidth={320}
              >
                <Button
                  variant="ghost"
                  size="small"
                  fullWidth
                  className="h-auto justify-between px-2 py-1.5 text-left"
                  onClick={() => onOpenBuilding(planned.diagnostic)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Settings2
                      aria-hidden="true"
                      className="size-4 shrink-0 text-highlight-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {planned.buildingName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {getChecklistDetail(planned)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-medium text-highlight-foreground">
                      {planned.count} to configure
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Planned settings
                    </span>
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
      {plannedFollowUps.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">
            Later operating changes
          </h5>
          <div className="mt-1 grid gap-1 md:grid-cols-2">
            {plannedFollowUps.map((planned) => (
              <Tooltip key={planned.key} label={planned.note} maxWidth={320}>
                <Button
                  variant="ghost"
                  size="small"
                  fullWidth
                  className="h-auto justify-between px-2 py-1.5 text-left"
                  onClick={() => onOpenBuilding(planned.diagnostic)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Pause
                      aria-hidden="true"
                      className="size-4 shrink-0 text-highlight-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {planned.buildingName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {getChecklistDetail(planned)}
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 shrink text-right">
                    <span className="block text-xs font-medium text-highlight-foreground">
                      Pause {planned.count} later
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {planned.note}
                    </span>
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
