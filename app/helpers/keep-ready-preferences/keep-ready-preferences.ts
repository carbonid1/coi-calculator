export type KeepReadyPreferences = Readonly<Record<string, boolean>>;

// Live-area recipe IDs gain this suffix when a separate shared machine uses
// the same recipe. Both IDs refer to the same dedicated building group.
export const getKeepReadyPreferenceKey = (diagnosticKey: string) => (
  diagnosticKey.endsWith(":dedicated")
    ? diagnosticKey.slice(0, -":dedicated".length)
    : diagnosticKey
);

export const getKeepReadyStorageKey = (saveId: string | null | undefined) => (
  saveId ? `coi-keep-ready-v1:${encodeURIComponent(saveId)}` : null
);

export const parseKeepReadyPreferences = (value: string | null): KeepReadyPreferences => {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed)
      .filter(([, enabled]) => typeof enabled === "boolean")
      .map(([key, enabled]) => [getKeepReadyPreferenceKey(key), enabled]));
  } catch {
    return {};
  }
};
