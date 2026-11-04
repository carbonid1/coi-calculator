import { normalizeIslandMap } from '../../island-map';
import { fetchGameWebApi } from '../../server/game-web-api';

export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const parameters = new URL(request.url).searchParams;
  const gameId = parameters.get('gameId');
  const sessionId = parameters.get('sessionId');
  const unavailable = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!gameId || !sessionId || gameId.length > 100 || sessionId.length > 100) return unavailable(400);
  try {
    const response = await fetchGameWebApi('/api/mods/CoiCalculatorExporter/island-map', AbortSignal.timeout(8_000));

    if (!response.ok) return unavailable(response.status === 404 ? 404 : 502);
    const map = normalizeIslandMap(await response.json());

    if (!map) return unavailable(502);
    if (map.gameId !== gameId || map.sessionId !== sessionId) return unavailable(409);
    const etag = JSON.stringify(`${gameId}:${sessionId}:${map.revision}`);
    const headers = { ETag: etag, 'Cache-Control': 'no-store' };

    return request.headers.get('If-None-Match') === etag ? new Response(null, { status: 304, headers })
      : Response.json(map, { headers });
  } catch { return unavailable(503); }
};
