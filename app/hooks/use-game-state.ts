import { useEffect, useState } from "react";

import {
  normalizeGameStateSnapshot,
  type GameStateConnectionStatus,
  type GameStateDataSource,
  type GameStateSnapshot,
} from "../game-state";

interface GameStateResult {
  isFresh: boolean;
  snapshot: GameStateSnapshot | null;
  source: GameStateDataSource;
  status: GameStateConnectionStatus;
}

const GAME_STATE_CACHE_KEY = "coi-game-state-last-valid-v1";

const initialResult: GameStateResult = {
  isFresh: false,
  snapshot: null,
  source: "none",
  status: "loading",
};

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

export const useGameState = (): GameStateResult => {
  const [result, setResult] = useState(initialResult);

  useEffect(() => {
    let isActive = true;
    const cachedSnapshot = readCachedSnapshot();
    const cacheTimer = cachedSnapshot
      ? window.setTimeout(() => {
          if (!isActive) return;

          setResult(current => current.snapshot
            ? current
            : {
                isFresh: false,
                snapshot: cachedSnapshot,
                source: "cached",
                status: "loading",
              });
        }, 0)
      : undefined;

    const setUnavailable = (status: "missing" | "error") => {
      if (!isActive) return;

      setResult(current => ({
        isFresh: false,
        snapshot: current.snapshot,
        source: current.snapshot ? "cached" : "none",
        status,
      }));
    };

    const refresh = async () => {
      try {
        const response = await fetch("/api/game-state", { cache: "no-store" });

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

        writeCachedSnapshot(snapshot);
        if (isActive) setResult({
          isFresh: Date.now() - Date.parse(snapshot.exportedAtUtc) < 20_000,
          snapshot,
          source: "live",
          status: "available",
        });
      } catch {
        setUnavailable("error");
      }
    };

    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 5_000);

    return () => {
      isActive = false;
      if (cacheTimer !== undefined) window.clearTimeout(cacheTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  return result;
};
