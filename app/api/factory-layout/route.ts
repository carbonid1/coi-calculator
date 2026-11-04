import { createHash } from 'node:crypto';

import { normalizeFactoryLayout } from '../../factory-layout';
import { fetchGameWebApi } from '../../server/game-web-api';

export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const parameters = new URL(request.url).searchParams;
  const gameId = parameters.get('gameId');
  const sessionId = parameters.get('sessionId');
  const unavailable = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!gameId || !sessionId || gameId.length > 100 || sessionId.length > 100) return unavailable(400);
  try {
    const response = await fetchGameWebApi('/api/mods/CoiCalculatorExporter/factory-layout', AbortSignal.timeout(8_000));

    if (!response.ok) return unavailable(response.status === 404 ? 404 : 502);
    const layout = normalizeFactoryLayout(await response.json());

    if (!layout) return unavailable(502);
    if (layout.gameId !== gameId || layout.sessionId !== sessionId) return unavailable(409);
    const body = JSON.stringify(layout);
    const etag = JSON.stringify(createHash('sha256').update(body).digest('base64url'));
    const headers = { ETag: etag, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

    return request.headers.get('If-None-Match') === etag ? new Response(null, { status: 304, headers })
      : new Response(body, { headers });
  } catch { return unavailable(503); }
};
