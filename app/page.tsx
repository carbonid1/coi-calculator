import { Calculator } from "./calculator";
import { type GameStateResult } from "./hooks/use-game-state";
import { readGameStateSnapshot } from "./server/read-game-state-snapshot";

export const dynamic = "force-dynamic";

const Page = async () => {
  const result = await readGameStateSnapshot();
  const initialGameState: GameStateResult = result.snapshot
    ? {
        isFresh: result.isFresh,
        snapshot: result.snapshot,
        source: "live",
        status: "available",
      }
    : {
        isFresh: false,
        snapshot: null,
        source: "none",
        status: result.status,
      };

  return <Calculator initialGameState={initialGameState} />;
};

export default Page;
