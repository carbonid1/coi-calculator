import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  normalizeGameStateSnapshot,
  type GameStateSnapshot,
} from "../game-state";
import { calculateGameStateSnapshotRevision } from "./game-state-snapshot-revision";

interface AvailableResult {
  error: null;
  httpStatus: 200;
  isFresh: boolean;
  revision: string;
  snapshot: GameStateSnapshot;
  status: "available";
}

interface UnavailableResult {
  error: string;
  httpStatus: 404 | 422 | 500 | 503;
  isFresh: false;
  revision: null;
  snapshot: null;
  status: "error" | "missing";
}

export type GameStateSnapshotReadResult = AvailableResult | UnavailableResult;

let cached: {
  key: string;
  value: Promise<{ snapshot: GameStateSnapshot; revision: string } | null>;
} | null = null;

const readSnapshot = async (snapshotPath: string) => {
  const metadata = await stat(/* turbopackIgnore: true */ snapshotPath);
  const key = JSON.stringify([
    snapshotPath, metadata.dev, metadata.ino, metadata.size, metadata.mtimeMs, metadata.ctimeMs,
  ]);

  // Share the in-flight read too, so several tabs cannot parse the same export
  // concurrently. Keep freshness outside this cache: an unchanged file ages.
  if (cached?.key !== key) {
    cached = {
      key,
      value: (async () => {
        const value: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ snapshotPath, "utf8"));
        const snapshot = normalizeGameStateSnapshot(value);

        return snapshot ? { snapshot, revision: calculateGameStateSnapshotRevision(snapshot) } : null;
      })(),
    };
  }

  return cached.value;
};

const getSnapshotPath = () => {
  if (process.env.COI_CALCULATOR_STATE_PATH) {
    return process.env.COI_CALCULATOR_STATE_PATH;
  }

  if (!process.env.APPDATA) return null;

  return path.join(
    /* turbopackIgnore: true */
    process.env.APPDATA,
    "Captain of Industry",
    "Mods",
    "CoiCalculatorExporter",
    "coi-calculator-state.json",
  );
};

export const readGameStateSnapshot = async (): Promise<GameStateSnapshotReadResult> => {
  const snapshotPath = getSnapshotPath();

  if (!snapshotPath) {
    return {
      error: "Captain of Industry app-data directory is unavailable.",
      httpStatus: 503,
      isFresh: false,
      revision: null,
      snapshot: null,
      status: "error",
    };
  }

  try {
    const result = await readSnapshot(snapshotPath);

    if (!result) {
      return {
        error: "The game snapshot has an unsupported or invalid format.",
        httpStatus: 422,
        isFresh: false,
        revision: null,
        snapshot: null,
        status: "error",
      };
    }

    const { snapshot, revision } = result;

    return {
      error: null,
      httpStatus: 200,
      isFresh: Date.now() - Date.parse(snapshot.exportedAtUtc) < 20_000,
      revision,
      snapshot,
      status: "available",
    };
  } catch (error) {
    cached = null;
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

    if (code === "ENOENT") {
      return {
        error: "No game snapshot has been exported yet.",
        httpStatus: 404,
        isFresh: false,
        revision: null,
        snapshot: null,
        status: "missing",
      };
    }

    return {
      error: "The game snapshot could not be read.",
      httpStatus: 500,
      isFresh: false,
      revision: null,
      snapshot: null,
      status: "error",
    };
  }
};
