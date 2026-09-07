import {
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";

interface Props {
  calculationStatus?: "loading" | "updating" | "error" | "ready";
  exportedAtUtc: string | null;
  isFresh: boolean;
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
  isLive: boolean,
  status: GameStateConnectionStatus,
) => {
  if (hasSnapshot) return isLive ? "Game sync: Live" : "Game sync: Last sync";
  if (status === "loading") return "Checking game sync";
  if (status === "missing") return "No game snapshot";

  return "Game sync unavailable";
};

export const GameSyncStatus: React.FC<Props> = ({
  calculationStatus = "ready",
  exportedAtUtc,
  isFresh,
  snapshot,
  source,
  status,
}) => {
  const isLive = source === "live" && isFresh && calculationStatus === "ready";
  let label = getStatusLabel(Boolean(snapshot), isLive, status);

  if (calculationStatus === "loading") label = "Loading factory";
  if (calculationStatus === "updating" || calculationStatus === "error") label = "Last result";
  if (calculationStatus === "error" && !snapshot) label = "Factory unavailable";

  return (
    <p
      role="status"
      className={isLive
        ? "min-h-4 whitespace-nowrap text-xs font-medium tabular-nums text-success sm:text-right"
        : "min-h-4 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:text-right"}
    >
      {label}
      {calculationStatus !== "loading" && snapshot && exportedAtUtc && (
        <>
          {" · "}
          <time dateTime={exportedAtUtc} suppressHydrationWarning>
            {formatSnapshotTime(exportedAtUtc)}
          </time>
        </>
      )}
      {calculationStatus === "updating" && " · Updating…"}
      {calculationStatus === "error" && snapshot && " · Update failed"}
    </p>
  );
};
