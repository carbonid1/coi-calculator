import { type MachineZoneAssignments } from "./machine-allocation";

/** Stored pump choices for one save: area id to claim id. Malformed entries are dropped. */
export const parseStoredMachineZoneAssignments = (value: string | null): Record<number, string> => {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const assignments: Record<number, string> = {};

    for (const [zoneId, claimId] of Object.entries(parsed)) {
      if (/^-?\d+$/.test(zoneId) && typeof claimId === "string") assignments[Number(zoneId)] = claimId;
    }
    return assignments;
  } catch {
    return {};
  }
};

/**
 * Only claims the current factory offers take effect. The rest stay in
 * storage, so an area that loses its name for a while keeps its choice.
 */
export const selectActiveMachineZoneAssignments = (
  stored: Readonly<Record<number, string>>,
  availableClaimIds: ReadonlySet<string>,
): MachineZoneAssignments => Object.fromEntries(
  Object.entries(stored).filter(([, claimId]) => availableClaimIds.has(claimId)),
);

/** The stored map after one choice; `null` clears the area's choice. */
export const withMachineZoneAssignment = (
  stored: Readonly<Record<number, string>>,
  zoneId: number,
  claimId: string | null,
): Record<number, string> => {
  const next = { ...stored };

  if (claimId) {
    next[zoneId] = claimId;
  } else {
    delete next[zoneId];
  }
  return next;
};
