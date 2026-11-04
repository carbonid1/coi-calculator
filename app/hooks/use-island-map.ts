import { normalizeIslandMap } from '../island-map';
import { useMapLayer } from './use-map-layer';

export const useIslandMap = (gameId: string, sessionId: string) => {
  const { data: map, loading } = useMapLayer('/api/island-map', normalizeIslandMap, gameId, sessionId);

  return { map, loading };
};
