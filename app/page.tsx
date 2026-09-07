import { getCalculationVersion } from "../scripts/calculation-version";

import { Calculator } from "./calculator";
import { type GameStateResult } from "./hooks/use-game-state";
import { readGameStateSnapshot } from "./server/read-game-state-snapshot";

export const dynamic = "force-dynamic";

const Page = async () => {
  const result = await readGameStateSnapshot();
  const initialGameState: GameStateResult = result.snapshot
    ? {
        exportedAtUtc: result.snapshot.exportedAtUtc,
        isFresh: result.isFresh,
        revision: result.revision,
        snapshot: result.snapshot,
        source: "live",
        status: "available",
      }
    : {
        exportedAtUtc: null,
        isFresh: false,
        revision: null,
        snapshot: null,
        source: "none",
        status: result.status,
      };

  // Development edits must invalidate the cache without restarting Next.js.
  const calculationVersion = process.env.NODE_ENV === "development"
    ? getCalculationVersion()
    : process.env.CALCULATION_CACHE_VERSION;

  if (!calculationVersion) throw new Error("Missing calculation cache version.");

  return <Calculator initialGameState={initialGameState} calculationVersion={calculationVersion} />;
};

export default Page;
