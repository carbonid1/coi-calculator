import { Button, Popover } from "@carbonid1/design-system";
import { MapPin, Settings2 } from "lucide-react";

import {
  type MachineZoneSummary,
  type SharedMachineClaim,
} from "../helpers/machine-allocation/machine-allocation";

interface Props {
  claims: readonly SharedMachineClaim[];
  zones: MachineZoneSummary[];
  onAssign: (zoneId: number, claimId: string | null) => void;
}

export const MachineZoneMappingsView: React.FC<Props> = ({
  claims,
  zones,
  onAssign,
}) => {
  const manualZones = zones.filter(zone => zone.manuallyAssigned);

  if (manualZones.length === 0) return null;

  return (
    <div className="flex justify-end">
      <Popover.Root>
        <Popover.Trigger
          render={(
            <Button type="button" variant="ghost" size="small">
              <Settings2 aria-hidden="true" className="size-4" />
              Edit machine-zone mappings
            </Button>
          )}
        />
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end">
            <Popover.Popup className="w-[min(34rem,calc(100vw-2rem))] p-3">
              <Popover.Title className="text-sm font-semibold text-foreground">
                Machine-zone mappings
              </Popover.Title>
              <Popover.Description className="mt-1 text-xs text-muted-foreground">
                Change a saved mapping, or select its current module again to clear it.
              </Popover.Description>
              <div className="mt-3 space-y-1">
                {manualZones.map(zone => {
                  const zoneLabel = zone.name?.trim() || `Vehicle zone ${zone.id}`;

                  return (
                    <div
                      key={zone.id}
                      className="flex flex-col gap-2 rounded-lg px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MapPin
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {zoneLabel}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Zone {zone.id} · {zone.built} {zone.machineName}
                            {zone.built === 1 ? "" : "s"}
                          </span>
                        </span>
                      </span>
                      <span
                        aria-label={`Map ${zoneLabel}`}
                        className="flex shrink-0 flex-wrap gap-1"
                        role="group"
                      >
                        {claims.map(claim => {
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
                              onClick={() => onAssign(
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
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
