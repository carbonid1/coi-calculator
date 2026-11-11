import { useCallback, useEffect, useRef, useState } from "react";

import {
  normalizeGameStateSnapshot,
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";
import { startGameStatePolling } from "../helpers/game-state-polling/game-state-polling";

export interface GameStateResult {
  error: string | null;
  exportedAtUtc: string | null;
  isFresh: boolean;
  revision: string | null;
  snapshot: GameStateSnapshot | null;
  source: GameStateDataSource;
  status: GameStateConnectionStatus;
}

const GAME_STATE_CACHE_KEY = "coi-game-state-last-valid-v1";
const FRESHNESS_WINDOW_MS = 20_000;

const isSnapshotFresh = (exportedAtUtc: string) => (
  Date.now() - Date.parse(exportedAtUtc) < FRESHNESS_WINDOW_MS
);

type SnapshotCacheIdentity = Pick<GameStateSnapshot, "exportedAtUtc" | "saveId">;

export const shouldPersistInitialSnapshot = (
  snapshot: SnapshotCacheIdentity,
  cachedSnapshot: SnapshotCacheIdentity | null,
) => (
  !cachedSnapshot
  || cachedSnapshot.saveId !== snapshot.saveId
  || cachedSnapshot.exportedAtUtc !== snapshot.exportedAtUtc
);

const readCachedSnapshot = (): GameStateSnapshot | null => {
  try {
    const cached = window.localStorage.getItem(GAME_STATE_CACHE_KEY);

    return cached ? normalizeGameStateSnapshot(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
};
const writeCachedSnapshot = (snapshot: GameStateSnapshot) => {
  try {
    window.localStorage.setItem(GAME_STATE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
  }
};

const readErrorMessage = async (response: Response): Promise<string | null> => {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" && body !== null && "error" in body
      && typeof body.error === "string" && body.error.length > 0
      ? body.error.slice(0, 200)
      : null;
  } catch {
    return null;
  }
};

export const useGameState = (initialResult: GameStateResult) => {
  const [result, setResult] = useState(initialResult);
  const [isSyncing, setIsSyncing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof startGameStatePolling> | null>(null);
  const initialSnapshotRef = useRef(initialResult.snapshot);
  const revisionRef = useRef(initialResult.revision);
  const syncNow = useCallback(() => pollingRef.current?.refreshNow(), []);

  useEffect(() => {
    const lifecycle = {
      isActive: true,
    };
    const cachedSnapshot = readCachedSnapshot();
    const initialSnapshot = initialSnapshotRef.current;
    const initialCacheWriteTimer = initialSnapshot
      && shouldPersistInitialSnapshot(initialSnapshot, cachedSnapshot)
      ? window.setTimeout(() => {
          if (lifecycle.isActive) writeCachedSnapshot(initialSnapshot);
        }, 0)
      : undefined;
    const cacheTimer = cachedSnapshot
      ? window.setTimeout(() => {
          if (!lifecycle.isActive) return;

          setResult(current => current.snapshot
            ? current
            : {
                error: null,
                exportedAtUtc: cachedSnapshot.exportedAtUtc,
                isFresh: false,
                revision: null,
                snapshot: cachedSnapshot,
                source: "cached",
                status: "loading",
              });
        }, 0)
      : undefined;

    const setUnavailable = (status: "missing" | "error", error: string | null = null) => {
      if (!lifecycle.isActive) return;

      setResult(current => ({
        error,
        exportedAtUtc: current.exportedAtUtc,
        isFresh: false,
        revision: current.revision,
        snapshot: current.snapshot,
        source: current.snapshot ? "cached" : "none",
        status,
      }));
    };

    const refresh = async (signal: AbortSignal) => {
      try {
        const currentRevision = revisionRef.current;
        const response = await fetch("/api/game-state", {
          cache: "no-store",
          headers: currentRevision
            ? { "If-None-Match": JSON.stringify(currentRevision) }
            : undefined,
          signal,
        });

        if (!lifecycle.isActive || signal.aborted) return;

        if (response.status === 304) {
          const exportedAtUtc = response.headers.get("X-CoI-Exported-At-Utc");

          if (!exportedAtUtc || Number.isNaN(Date.parse(exportedAtUtc))) {
            setUnavailable("error");
            return;
          }

          if (lifecycle.isActive) {
            const isFresh = isSnapshotFresh(exportedAtUtc);

            setResult(current => {
              if (!current.snapshot) return current;
              if (
                current.error === null
                && current.exportedAtUtc === exportedAtUtc
                && current.isFresh === isFresh
                && current.source === "live"
                && current.status === "available"
              ) return current;

              return {
                ...current,
                error: null,
                exportedAtUtc,
                isFresh,
                source: "live",
                status: "available",
              };
            });
          }
          return;
        }

        if (response.status === 404) {
          setUnavailable("missing", await readErrorMessage(response));
          return;
        }

        if (!response.ok) {
          setUnavailable("error", await readErrorMessage(response));
          return;
        }

        const value: unknown = await response.json();

        if (!lifecycle.isActive || signal.aborted) return;
        const snapshot = normalizeGameStateSnapshot(value);

        if (!snapshot) {
          setUnavailable("error");
          return;
        }

        const revision = response.headers.get("X-CoI-Snapshot-Revision")
          ?? snapshot.exportedAtUtc;
        const snapshotChanged = revisionRef.current !== revision;

        revisionRef.current = revision;
        if (snapshotChanged) writeCachedSnapshot(snapshot);
        if (lifecycle.isActive) {
          const isFresh = isSnapshotFresh(snapshot.exportedAtUtc);

          setResult(current => {
            if (
              current.error === null
              && current.exportedAtUtc === snapshot.exportedAtUtc
              && current.isFresh === isFresh
              && current.revision === revision
              && current.source === "live"
              && current.status === "available"
            ) return current;

            return {
              error: null,
              exportedAtUtc: snapshot.exportedAtUtc,
              isFresh,
              revision,
              snapshot: current.revision === revision && current.snapshot
                ? current.snapshot
                : snapshot,
              source: "live",
              status: "available",
            };
          });
        }
      } catch {
        if (!lifecycle.isActive || signal.aborted) return;
        setUnavailable("error");
      }
    };

    const polling = startGameStatePolling({
      refresh,
      isVisible: () => document.visibilityState !== "hidden",
      onError: () => setUnavailable("error"),
      onRefreshingChange: setIsSyncing,
    });

    pollingRef.current = polling;
    document.addEventListener("visibilitychange", polling.visibilityChanged);

    return () => {
      lifecycle.isActive = false;
      pollingRef.current = null;
      polling.dispose();
      document.removeEventListener("visibilitychange", polling.visibilityChanged);
      if (initialCacheWriteTimer !== undefined) window.clearTimeout(initialCacheWriteTimer);
      if (cacheTimer !== undefined) window.clearTimeout(cacheTimer);
    };
  }, []);

  return { ...result, isSyncing, syncNow };
};
