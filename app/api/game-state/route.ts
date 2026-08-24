import { readGameStateSnapshot } from "../../server/read-game-state-snapshot";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const result = await readGameStateSnapshot();

  if (result.snapshot) {
    return Response.json(result.snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    { error: result.error },
    { status: result.httpStatus },
  );
};
