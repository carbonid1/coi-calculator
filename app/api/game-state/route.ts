import {
  formatGameStateSnapshotEtag,
  matchesGameStateSnapshotEtag,
} from "../../server/game-state-snapshot-revision";
import { readGameStateSnapshot } from "../../server/read-game-state-snapshot";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const result = await readGameStateSnapshot();

  if (result.snapshot) {
    const headers = {
      "Cache-Control": "no-store",
      ETag: formatGameStateSnapshotEtag(result.revision),
      "X-CoI-Exported-At-Utc": result.snapshot.exportedAtUtc,
      "X-CoI-Snapshot-Revision": result.revision,
    };

    if (matchesGameStateSnapshotEtag(
      request.headers.get("if-none-match"),
      result.revision,
    )) {
      return new Response(null, { headers, status: 304 });
    }

    return Response.json(result.snapshot, { headers });
  }

  return Response.json(
    { error: result.error },
    { status: result.httpStatus },
  );
};
