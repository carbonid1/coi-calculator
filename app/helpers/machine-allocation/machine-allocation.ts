import { type PlanMismatchAction } from "../../db/modules/modules";
import { type SyncedMachineInventoryItem } from "../../game-state";

export interface SharedMachineClaim {
  id: string;
  moduleId: string;
  moduleName: string;
  recipeId: string;
  machineName: string;
  kind: SyncedMachineInventoryItem["kind"];
  target: number;
}

export type MachineZoneAssignments = Readonly<Record<number, string | undefined>>;

export interface SharedMachineClaimResolution {
  claim: SharedMachineClaim;
  built: number;
  running: number;
  suggestedBuilt: number;
  suggestedRunning: number;
  machines: SyncedMachineInventoryItem[];
  suggestedMachines: SyncedMachineInventoryItem[];
  actions: PlanMismatchAction[];
}

export interface MachineAllocationIssue {
  id: string;
  machineName: string;
  count: number;
  message: string;
}

export interface MachineInventorySummary {
  kind: SyncedMachineInventoryItem["kind"];
  machineName: string;
  built: number;
  running: number;
  paused: number;
  assigned: number;
  unresolved: number;
}

export interface MachineZoneSummary {
  id: number;
  name: string | null;
  machineName: string;
  built: number;
  running: number;
  paused: number;
  assignedClaimId: string | null;
  manuallyAssigned: boolean;
  needsAssignment: boolean;
}

export interface SharedMachineAllocation {
  claims: Record<string, SharedMachineClaimResolution>;
  inventory: MachineInventorySummary[];
  zones: MachineZoneSummary[];
  issues: MachineAllocationIssue[];
}

const pluralize = (name: string, count: number) => `${name}${count === 1 ? "" : "s"}`;
const DEFAULT_ZONE_ID = -1;
const defaultZone: SyncedMachineInventoryItem["zones"][number] = {
  id: DEFAULT_ZONE_ID,
  name: "Default",
};
const normalizeZoneName = (value: string) => value
  .toLocaleLowerCase("en-US")
  .replaceAll(/[^a-z0-9]+/g, " ")
  .trim();

/**
 * Assigns a machine when its live vehicle-zone membership resolves to exactly
 * one calculator claim. Multiple overlapping zones may point to the same claim;
 * zones pointing to different claims stay unresolved as an explicit conflict.
 */
export const allocateSharedMachines = (
  inventory: readonly SyncedMachineInventoryItem[],
  claims: readonly SharedMachineClaim[],
  zoneAssignments: MachineZoneAssignments = {},
  zoneDataAvailable = true,
): SharedMachineAllocation => {
  const claimById = new Map(claims.map(claim => [claim.id, claim]));
  const matchingMachines = inventory.filter(machine => (
    claims.some(claim => claim.kind === machine.kind)
  ));
  const explicitByClaim = new Map<string, SyncedMachineInventoryItem[]>();
  const unresolved: SyncedMachineInventoryItem[] = [];
  const conflicting: SyncedMachineInventoryItem[] = [];
  const effectiveZonesByEntity = new Map(matchingMachines.map(machine => [
    machine.entityId,
    zoneDataAvailable && machine.zones.length === 0 ? [defaultZone] : machine.zones,
  ]));
  const getAssignedClaimId = (
    zone: SyncedMachineInventoryItem["zones"][number],
    machine: SyncedMachineInventoryItem,
  ) => {
    const manuallyAssignedClaimId = zoneAssignments[zone.id];
    const manuallyAssignedClaim = manuallyAssignedClaimId
      ? claimById.get(manuallyAssignedClaimId)
      : undefined;

    if (manuallyAssignedClaim?.kind === machine.kind) return manuallyAssignedClaim.id;

    const normalizedZoneName = normalizeZoneName(zone.name ?? "");
    const automaticMatches = claims.filter(claim => (
      claim.kind === machine.kind
      && (
        (zone.id === DEFAULT_ZONE_ID && normalizeZoneName(claim.moduleName) === "default")
        || (
          normalizedZoneName.length > 0
          && normalizedZoneName === normalizeZoneName(claim.moduleName)
        )
      )
    ));

    return automaticMatches.length === 1 ? automaticMatches[0]?.id : undefined;
  };

  for (const machine of matchingMachines) {
    const assignedClaimIds = new Set((effectiveZonesByEntity.get(machine.entityId) ?? []).flatMap(
      zone => {
        const claimId = getAssignedClaimId(zone, machine);

        return claimId ? [claimId] : [];
      },
    ));

    if (assignedClaimIds.size === 1) {
      const claimId = [...assignedClaimIds][0];

      if (!claimId) continue;

      const allocated = explicitByClaim.get(claimId) ?? [];

      allocated.push(machine);
      explicitByClaim.set(claimId, allocated);
    } else if (assignedClaimIds.size > 1) {
      conflicting.push(machine);
    } else {
      unresolved.push(machine);
    }
  }

  const suggestionPool = [...unresolved, ...conflicting].toSorted((left, right) => (
    Number(right.running) - Number(left.running) || left.entityId - right.entityId
  ));
  const suggestionGroups: SyncedMachineInventoryItem[][] = [];
  const ungroupedSuggestions = [...suggestionPool];

  while (ungroupedSuggestions.length > 0) {
    const seed = ungroupedSuggestions.shift();

    if (!seed) break;

    const group = [seed];
    const groupZoneIds = new Set(
      (effectiveZonesByEntity.get(seed.entityId) ?? []).map(zone => zone.id),
    );
    let addedToGroup = true;

    while (addedToGroup && groupZoneIds.size > 0) {
      addedToGroup = false;

      for (let index = ungroupedSuggestions.length - 1; index >= 0; index--) {
        const candidate = ungroupedSuggestions[index];

        if (!candidate) continue;

        const candidateZones = effectiveZonesByEntity.get(candidate.entityId) ?? [];

        if (!candidateZones.some(zone => groupZoneIds.has(zone.id))) continue;

        group.push(candidate);
        for (const zone of candidateZones) groupZoneIds.add(zone.id);
        ungroupedSuggestions.splice(index, 1);
        addedToGroup = true;
      }
    }

    suggestionGroups.push(group.toSorted((left, right) => left.entityId - right.entityId));
  }

  const resolutions: Record<string, SharedMachineClaimResolution> = {};
  let suggestionGroupIndex = 0;

  for (const claim of claims) {
    const explicit = explicitByClaim.get(claim.id) ?? [];
    const suggested: SyncedMachineInventoryItem[] = [];

    while (
      explicit.length + suggested.length < claim.target
      && suggestionGroupIndex < suggestionGroups.length
    ) {
      suggested.push(...(suggestionGroups[suggestionGroupIndex] ?? []));
      suggestionGroupIndex++;
    }

    const running = explicit.filter(machine => machine.running).length;
    const suggestedRunning = suggested.filter(machine => machine.running).length;
    const pausedAvailable = explicit.length - running + suggested.length - suggestedRunning;
    const unpauseCount = Math.min(
      pausedAvailable,
      Math.max(0, claim.target - running - suggestedRunning),
    );
    const buildCount = Math.max(
      0,
      claim.target - running - suggestedRunning - unpauseCount,
    );
    const actions: PlanMismatchAction[] = [
      ...(suggested.length > 0
        ? [{
            type: "assign" as const,
            label: `Map ${suggested.length} existing ${pluralize(claim.machineName, suggested.length)} to ${claim.moduleName} by vehicle zone`,
          }]
        : []),
      ...(unpauseCount > 0
        ? [{
            type: "unpause" as const,
            label: `Unpause ${unpauseCount} ${pluralize(claim.machineName, unpauseCount)} for ${claim.moduleName}`,
          }]
        : []),
      ...(buildCount > 0
        ? [{
            type: "build" as const,
            label: `Build ${buildCount} ${pluralize(claim.machineName, buildCount)} for ${claim.moduleName}`,
          }]
        : []),
    ];

    resolutions[claim.id] = {
      claim,
      built: explicit.length,
      running,
      suggestedBuilt: suggested.length,
      suggestedRunning,
      machines: explicit,
      suggestedMachines: suggested,
      actions,
    };
  }

  const issues: MachineAllocationIssue[] = [];

  if (unresolved.length > 0) {
    issues.push({
      id: "unassigned-groundwater-pumps",
      machineName: claims[0]?.machineName ?? "Machine",
      count: unresolved.length,
      message: zoneDataAvailable ? [
        `${unresolved.length} live ${pluralize(claims[0]?.machineName ?? "machine", unresolved.length)} are not mapped to a module.`,
        "Assign the vehicle zones listed below once; machines in them will follow automatically.",
      ].filter(Boolean).join(" ") : [
        `${unresolved.length} live ${pluralize(claims[0]?.machineName ?? "machine", unresolved.length)} are not mapped to a module.`,
        "Restart the game with the pending exporter update to load vehicle-zone membership.",
      ].join(" "),
    });
  }

  if (conflicting.length > 0) {
    issues.push({
      id: "conflicting-groundwater-pump-zones",
      machineName: claims[0]?.machineName ?? "Machine",
      count: conflicting.length,
      message: `${conflicting.length} live ${pluralize(claims[0]?.machineName ?? "machine", conflicting.length)} are covered by vehicle zones mapped to different modules. Clear one mapping or remove the overlap.`,
    });
  }

  const zonesById = new Map<number, MachineZoneSummary>();

  for (const machine of matchingMachines) {
    const needsAssignment = unresolved.includes(machine) || conflicting.includes(machine);

    for (const zone of effectiveZonesByEntity.get(machine.entityId) ?? []) {
      const existing = zonesById.get(zone.id);
      const manuallyAssignedClaimId = zoneAssignments[zone.id];
      const manuallyAssignedClaim = manuallyAssignedClaimId
        ? claimById.get(manuallyAssignedClaimId)
        : undefined;
      const manuallyAssigned = manuallyAssignedClaim?.kind === machine.kind;

      if (existing) {
        existing.built++;
        if (machine.running) existing.running++;
        existing.paused = existing.built - existing.running;
        existing.manuallyAssigned ||= manuallyAssigned;
        existing.needsAssignment ||= needsAssignment;
        continue;
      }

      const assignedClaimId = getAssignedClaimId(zone, machine);

      zonesById.set(zone.id, {
        id: zone.id,
        name: zone.name,
        machineName: claims[0]?.machineName ?? "Machine",
        built: 1,
        running: machine.running ? 1 : 0,
        paused: machine.running ? 0 : 1,
        assignedClaimId: assignedClaimId ?? null,
        manuallyAssigned,
        needsAssignment,
      });
    }
  }

  const running = matchingMachines.filter(machine => machine.running).length;
  const assigned = [...explicitByClaim.values()].reduce(
    (total, machines) => total + machines.length,
    0,
  );
  const firstClaim = claims[0];
  const inventorySummary = firstClaim
    ? [{
        kind: firstClaim.kind,
        machineName: firstClaim.machineName,
        built: matchingMachines.length,
        running,
        paused: matchingMachines.length - running,
        assigned,
        unresolved: unresolved.length + conflicting.length,
      }]
    : [];

  return {
    claims: resolutions,
    inventory: inventorySummary,
    zones: [...zonesById.values()].toSorted((left, right) => (
      (left.name ?? "").localeCompare(right.name ?? "") || left.id - right.id
    )),
    issues,
  };
};
