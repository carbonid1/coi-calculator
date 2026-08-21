import {
  CURRENT_GAME_STATE_SCHEMA_VERSION,
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";

interface Props {
  isFresh: boolean;
  snapshot: GameStateSnapshot | null;
  source: GameStateDataSource;
  status: GameStateConnectionStatus;
}

const formatSnapshotTime = (value: string) => new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
}).format(new Date(value));

const getStatusLabel = (
  hasSnapshot: boolean,
  isLive: boolean,
  status: GameStateConnectionStatus,
) => {
  if (hasSnapshot) return isLive ? "Game sync: Live" : "Game sync: Last sync";
  if (status === "loading") return "Checking game sync";
  if (status === "missing") return "No game snapshot";

  return "Game sync unavailable";
};

export const GameSyncStatus: React.FC<Props> = ({ isFresh, snapshot, source, status }) => {
  const isLive = source === "live" && isFresh;
  const updatePending = snapshot
    ? snapshot.schemaVersion < CURRENT_GAME_STATE_SCHEMA_VERSION
    : false;
  const label = getStatusLabel(Boolean(snapshot), isLive, status);

  return (
    <p
      className={isLive
        ? "min-h-4 whitespace-nowrap text-xs font-medium tabular-nums text-success sm:text-right"
        : "min-h-4 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:text-right"}
    >
      {label}
      {updatePending && " · Exporter update pending"}
      {snapshot && (
        <>
          {" · "}
          <time dateTime={snapshot.exportedAtUtc}>
            {formatSnapshotTime(snapshot.exportedAtUtc)}
          </time>
        </>
      )}
    </p>
  );
};
