import { useEffect, useState } from 'react';

import { startGameStatePolling } from '../helpers/game-state-polling/game-state-polling';

export const useMapLayer = <Layer extends { gameId: string; sessionId: string }>(
  path: string, normalize: (value: unknown) => Layer | null, gameId: string, sessionId: string,
) => {
  const [result, setResult] = useState<Layer | null>(null);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const identity = `${path}:${gameId}:${sessionId}`;

  useEffect(() => {
    const cache: { etag: string | null; supported: boolean } = { etag: null, supported: true };
    const refresh = async (signal: AbortSignal) => {
      try {
        const response = await fetch(`${path}?${new URLSearchParams({ gameId, sessionId })}`, {
          cache: 'no-store', signal,
          headers: cache.etag ? { 'If-None-Match': cache.etag } : undefined,
        });

        // Optional map routes do not require upgrading the running Bridge.
        if (response.status === 404) cache.supported = false;
        if (response.status === 200) {
          const layer = normalize(await response.json());

          if (!signal.aborted && layer?.gameId === gameId && layer.sessionId === sessionId) {
            cache.etag = response.headers.get('ETag');
            setResult(layer);
          }
        }
      } finally { if (!signal.aborted) setReadyFor(identity); }
    };
    const polling = startGameStatePolling({ refresh,
      isVisible: () => document.visibilityState !== 'hidden' && cache.supported,
      onError: () => setReadyFor(identity) });

    document.addEventListener('visibilitychange', polling.visibilityChanged);
    return () => { polling.dispose(); document.removeEventListener('visibilitychange', polling.visibilityChanged); };
  }, [gameId, sessionId, identity, path, normalize]);

  return { data: result?.gameId === gameId && result.sessionId === sessionId ? result : null, loading: readyFor !== identity };
};
