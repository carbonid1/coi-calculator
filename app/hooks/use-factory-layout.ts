import { normalizeFactoryLayout } from '../factory-layout';
import { useMapLayer } from './use-map-layer';

export const useFactoryLayout = (gameId: string, sessionId: string) =>
  useMapLayer('/api/factory-layout', normalizeFactoryLayout, gameId, sessionId);
