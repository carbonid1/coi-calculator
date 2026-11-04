import { cn } from '@carbonid1/design-system';
import { ArrowUp } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import { buildIslandOutline, type IslandMap } from '../island-map';

interface Point {
  x: number;
  y: number;
}

interface Props {
  label: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  className?: string;
  interactive?: boolean;
  terrain?: IslandMap | null;
  loading?: boolean;
  children: (project: (point: Point) => Point) => ReactNode;
}

// CoI's ground plane is XY (+Y north); SVG Y increases down. Project points
// individually so map labels remain upright in the shared north-up viewport.
const project = ({ x, y }: Point): Point => ({ x, y: -y });

export const MapFrame = ({ label, bounds, className, interactive = false, terrain, loading, children }: Props) => {
  const outline = useMemo(() => terrain ? buildIslandOutline(terrain) : '', [terrain]);

  return <figure aria-busy={loading || undefined} className={cn('min-w-0 self-start rounded-lg bg-surface-inset p-2 inset-shadow-surface', className)}>
    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground" aria-label="North">
      <ArrowUp className="h-4 w-4" aria-hidden="true" /><span>N</span>
    </div>
    <svg viewBox={`${bounds.minX} ${-bounds.maxY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
      className={cn('h-64 w-full', loading && 'invisible')} role={interactive ? 'group' : 'img'} aria-label={label}>
      {outline && <path data-island-outline="" d={outline} fill="currentColor" fillOpacity={0.1} fillRule="evenodd"
        stroke="currentColor" strokeOpacity={0.3} strokeWidth={1} vectorEffect="non-scaling-stroke"
        className="pointer-events-none text-muted-foreground" aria-hidden="true" />}
      {children(project)}
    </svg>
  </figure>;
};
