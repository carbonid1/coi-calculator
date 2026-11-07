import { Button, Tooltip } from "@carbonid1/design-system";
import { RefreshCw } from "lucide-react";

import {
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";

interface Props {
  exportedAtUtc: string | null;
  isSyncing: boolean;
  onSync: () => void;
  snapshot: GameStateSnapshot | null;
  source: GameStateDataSource;
  status: GameStateConnectionStatus;
}

export const formatSnapshotTime = (value: string) => new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
}).format(new Date(value));

const getStatusLabel = (
  hasSnapshot: boolean,
  hasCurrentSync: boolean,
  status: GameStateConnectionStatus,
  isSyncing: boolean,
) => {
  if (isSyncing) return "Syncing game…";
  if (hasSnapshot) return hasCurrentSync ? "Synced" : "Last sync";
  if (status === "loading") return "Checking game…";
  if (status === "missing") return "Bridge unavailable";

  return "Game data unavailable";
};

export const GameSyncStatus: React.FC<Props> = ({
  exportedAtUtc,
  isSyncing,
  onSync,
  snapshot,
  source,
  status,
}) => {
  const label = getStatusLabel(Boolean(snapshot), source === "live" && status === "available", status, isSyncing);

  return (
    <div className="flex items-center gap-1 sm:justify-end">
      <p
        role="status"
        data-game-sync={isSyncing ? "syncing" : status}
        className="min-h-4 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:text-right"
      >
        {label}
        {snapshot && exportedAtUtc && (
          <>
            {" · "}
            <time dateTime={exportedAtUtc} suppressHydrationWarning>
              {formatSnapshotTime(exportedAtUtc)}
            </time>
          </>
        )}
      </p>
      <Tooltip label="Sync now · Automatic sync every minute" position="bottom">
        <Button type="button" variant="ghost" size="smallIcon" aria-label="Sync now"
          loading={isSyncing} onClick={onSync} className="text-muted-foreground">
          <RefreshCw aria-hidden="true" className="size-4" />
        </Button>
      </Tooltip>
    </div>
  );
};
