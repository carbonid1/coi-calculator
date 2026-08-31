import { useEffect, useRef, useState } from "react";

import {
  normalizeGameStateSnapshot,
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";

export interface GameStateResult {
  exportedAtUtc: string | null;
  isFresh: boolean;
  revision: string | null;
  snapshot: GameStateSnapshot | null;
  source: GameStateDataSource;
  status: GameStateConnectionStatus;
}

const GAME_STATE_CACHE_KEY = "coi-game-state-last-valid-v1";
const REFRESH_INTERVAL_MS = 5_000;
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

export const useGameState = (initialResult: GameStateResult): GameStateResult => {
  const [result, setResult] = useState(initialResult);
  const initialSnapshotRef = useRef(initialResult.snapshot);
  const revisionRef = useRef(initialResult.revision);

  useEffect(() => {
    let isActive = true;
    let refreshTimer: number | undefined;
    const abortController = new AbortController();
    const cachedSnapshot = readCachedSnapshot();
    const initialSnapshot = initialSnapshotRef.current;
    const initialCacheWriteTimer = initialSnapshot
      && shouldPersistInitialSnapshot(initialSnapshot, cachedSnapshot)
      ? window.setTimeout(() => {
          if (isActive) writeCachedSnapshot(initialSnapshot);
        }, 0)
      : undefined;
    const cacheTimer = cachedSnapshot
      ? window.setTimeout(() => {
          if (!isActive) return;

          setResult(current => current.snapshot
            ? current
            : {
                exportedAtUtc: cachedSnapshot.exportedAtUtc,
                isFresh: false,
                revision: null,
                snapshot: cachedSnapshot,
                source: "cached",
                status: "loading",
              });
        }, 0)
      : undefined;

    const setUnavailable = (status: "missing" | "error") => {
      if (!isActive) return;

      setResult(current => ({
        exportedAtUtc: current.exportedAtUtc,
        isFresh: false,
        revision: current.revision,
        snapshot: current.snapshot,
        source: current.snapshot ? "cached" : "none",
        status,
      }));
    };

    const refresh = async () => {
      try {
        const currentRevision = revisionRef.current;
        const response = await fetch("/api/game-state", {
          cache: "no-store",
          headers: currentRevision
            ? { "If-None-Match": JSON.stringify(currentRevision) }
            : undefined,
          signal: abortController.signal,
        });

        if (response.status === 304) {
          const exportedAtUtc = response.headers.get("X-CoI-Exported-At-Utc");

          if (!exportedAtUtc || Number.isNaN(Date.parse(exportedAtUtc))) {
            setUnavailable("error");
            return;
          }

          if (isActive) {
            const isFresh = isSnapshotFresh(exportedAtUtc);

            setResult(current => {
              if (!current.snapshot) return current;
              if (
                current.exportedAtUtc === exportedAtUtc
                && current.isFresh === isFresh
                && current.source === "live"
                && current.status === "available"
              ) return current;

              return {
                ...current,
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
          setUnavailable("missing");
          return;
        }

        if (!response.ok) {
          setUnavailable("error");
          return;
        }

        const value: unknown = await response.json();
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
        if (isActive) {
          const isFresh = isSnapshotFresh(snapshot.exportedAtUtc);

          setResult(current => {
            if (
              current.exportedAtUtc === snapshot.exportedAtUtc
              && current.isFresh === isFresh
              && current.revision === revision
              && current.source === "live"
              && current.status === "available"
            ) return current;

            return {
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
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setUnavailable("error");
      }
    };

    const poll = async () => {
      await refresh();
      if (isActive) {
        refreshTimer = window.setTimeout(() => void poll(), REFRESH_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      isActive = false;
      abortController.abort();
      if (initialCacheWriteTimer !== undefined) window.clearTimeout(initialCacheWriteTimer);
      if (cacheTimer !== undefined) window.clearTimeout(cacheTimer);
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, []);

  return result;
};
