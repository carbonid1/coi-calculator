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

  return <Calculator initialGameState={initialGameState} />;
};

export default Page;
