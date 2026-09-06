import { expect, it } from "vitest";

import { getKeepReadyPreferenceKey, getKeepReadyStorageKey, parseKeepReadyPreferences } from "./keep-ready-preferences";

it("isolates preferences by game save and requires a save identity", () => {
  expect(getKeepReadyStorageKey("save-a")).not.toBe(getKeepReadyStorageKey("save-b"));
  expect(getKeepReadyStorageKey("save-a")).toBe(getKeepReadyStorageKey("save-a"));
  expect(getKeepReadyStorageKey(null)).toBeNull();
  expect(getKeepReadyStorageKey("")).toBeNull();
});

it("retains explicit off choices while discarding malformed values", () => {
  expect(parseKeepReadyPreferences(JSON.stringify({
    "general:rail": false,
    "general:crew": true,
    "general:other": "true",
    "general:null": null,
  }))).toEqual({ "general:rail": false, "general:crew": true });
});

it("migrates previously saved dedicated keys and writes subsequent choices to the same entry", () => {
  const key = "live-area-16:live-area-16:AssemblyRoboticT2:RailPartsAssembly";
  const sharedKey = "live-area-16:AssemblyRoboticT2:RailPartsAssembly+VehicleParts1Assembly";
  const saved = parseKeepReadyPreferences(JSON.stringify({
    [`${key}:dedicated`]: false,
    [sharedKey]: true,
  }));

  expect(saved).toEqual({ [key]: false, [sharedKey]: true });
  expect(getKeepReadyPreferenceKey(key)).toBe(key);
  expect({ ...saved, [getKeepReadyPreferenceKey(`${key}:dedicated`)]: true })
    .toEqual({ [key]: true, [sharedKey]: true });
});

it.each([null, "{", "null", "[]", "true"])("recovers from invalid stored preferences: %s", value => {
  expect(parseKeepReadyPreferences(value)).toEqual({});
});
