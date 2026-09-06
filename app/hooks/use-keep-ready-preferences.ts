import { useEffect, useState } from "react";

import {
  getKeepReadyPreferenceKey,
  getKeepReadyStorageKey,
  type KeepReadyPreferences,
  parseKeepReadyPreferences,
} from "../helpers/keep-ready-preferences/keep-ready-preferences";

const emptyPreferences: KeepReadyPreferences = {};
const readPreferences = (key: string) => {
  try {
    return parseKeepReadyPreferences(window.localStorage.getItem(key));
  } catch {
    return emptyPreferences;
  }
};

export const useKeepReadyPreferences = (saveId: string | null | undefined) => {
  const storageKey = getKeepReadyStorageKey(saveId);
  const [saved, setSaved] = useState<Record<string, KeepReadyPreferences>>({});

  useEffect(() => {
    if (!storageKey) return;

    const refresh = () => setSaved(current => ({
      ...current,
      [storageKey]: readPreferences(storageKey),
    }));
    const frame = window.requestAnimationFrame(refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) refresh();
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey]);

  const setKeepReady = (key: string, enabled: boolean) => {
    if (!storageKey) return false;

    const next = { ...readPreferences(storageKey), [getKeepReadyPreferenceKey(key)]: enabled };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      return false;
    }

    setSaved(current => ({ ...current, [storageKey]: next }));
    return true;
  };

  return {
    preferences: storageKey ? saved[storageKey] ?? emptyPreferences : emptyPreferences,
    canSave: storageKey !== null,
    setKeepReady,
  };
};
