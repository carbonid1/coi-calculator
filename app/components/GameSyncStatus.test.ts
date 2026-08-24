import { expect, it } from "vitest";

import { formatSnapshotTime } from "./GameSyncStatus";

it("formats game sync timestamps with the Ukrainian 24-hour clock", () => {
  const localTimestamp = new Date(2026, 7, 24, 22, 42, 43).toISOString();

  expect(formatSnapshotTime(localTimestamp)).toBe("22:42:43");
});
