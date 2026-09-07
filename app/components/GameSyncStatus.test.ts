import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { createCacheTestModel } from "../test-fixtures/factory-calculation-cache";
import { formatSnapshotTime, GameSyncStatus } from "./GameSyncStatus";

it("formats game sync timestamps with the Ukrainian 24-hour clock", () => {
  const localTimestamp = new Date(2026, 7, 24, 22, 42, 43).toISOString();

  expect(formatSnapshotTime(localTimestamp)).toBe("22:42:43");
});

it("keeps saved results neutral while a newer live snapshot is being calculated", () => {
  const snapshot = createCacheTestModel().snapshot;
  const html = renderToStaticMarkup(createElement(GameSyncStatus, {
    calculationStatus: "updating", snapshot, exportedAtUtc: snapshot.exportedAtUtc,
    isFresh: true, source: "live", status: "available",
  }));

  expect(html).toContain("Last result");
  expect(html).toContain("Updating…");
  expect(html).toContain(snapshot.exportedAtUtc);
  expect(html).not.toContain("text-success");
  expect(html).not.toContain("Game sync: Live");
});

it("does not report a failed first calculation as loading or as a saved result", () => {
  const html = renderToStaticMarkup(createElement(GameSyncStatus, {
    calculationStatus: "error", snapshot: null, exportedAtUtc: null,
    isFresh: true, source: "live", status: "available",
  }));

  expect(html).toContain("Factory unavailable");
  expect(html).not.toContain("Last result");
  expect(html).not.toContain("text-success");
});
