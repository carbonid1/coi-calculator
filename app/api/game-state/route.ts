import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeGameStateSnapshot } from "../../game-state";

export const dynamic = "force-dynamic";

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

export const GET = async () => {
  const snapshotPath = getSnapshotPath();

  if (!snapshotPath) {
    return Response.json(
      { error: "Captain of Industry app-data directory is unavailable." },
      { status: 503 },
    );
  }

  try {
    const value: unknown = JSON.parse(await readFile(
      /* turbopackIgnore: true */
      snapshotPath,
      "utf8",
    ));
    const snapshot = normalizeGameStateSnapshot(value);

    if (!snapshot) {
      return Response.json(
        { error: "The game snapshot has an unsupported or invalid format." },
        { status: 422 },
      );
    }

    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

    if (code === "ENOENT") {
      return Response.json(
        { error: "No game snapshot has been exported yet." },
        { status: 404 },
      );
    }

    return Response.json(
      { error: "The game snapshot could not be read." },
      { status: 500 },
    );
  }
};
