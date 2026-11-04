import { useId, useMemo } from 'react';

import { buildFactoryFootprintPath, type FactoryLayout } from '../factory-layout';
import { type SyncedAreaEntity } from '../game-state';

interface Props {
  layout: FactoryLayout | null;
  entities: readonly SyncedAreaEntity[];
  areaIds: readonly number[];
  worldUnitsPerPixel: number;
}

export const FactoryMapLayer = ({ layout, entities, areaIds, worldUnitsPerPixel }: Props) => {
  const id = useId();
  const visible = useMemo(() => {
    const selected = new Set(areaIds);
    const areas = layout?.areas.filter(area => selected.has(area.id)) ?? [];
    const buildings = layout?.buildings.filter(building => building.areas.some(area => selected.has(area))) ?? [];
    const usedShapes = new Set(buildings.map(building => building.shape));
    const shapes = layout?.shapes.flatMap((rectangles, index) => usedShapes.has(index)
      ? [{ index, path: buildFactoryFootprintPath(rectangles) }] : []) ?? [];
    const footprintIds = new Set(buildings.map(building => building.id));
    // Preserve real centres for static entities an older Bridge did not include.
    const points = entities.filter(entity => !footprintIds.has(entity.entityId) && entity.zones.some(zone => selected.has(zone.id)));

    return { areas, buildings, shapes, points };
  }, [layout, entities, areaIds]);

  return <g data-factory-layer="" aria-hidden="true" className="pointer-events-none">
    <defs>{visible.shapes.map(shape => <path key={shape.index} data-factory-shape={shape.index} id={`${id}-${shape.index}`} d={shape.path} vectorEffect="non-scaling-stroke" />)}</defs>
    {visible.areas.map(area => <polygon key={area.id} data-factory-area={area.id}
      points={area.outline.map(([x, y]) => `${x},${-y}`).join(' ')}
      className="text-primary" fill="currentColor" fillOpacity={0.035} stroke="currentColor" strokeOpacity={0.4}
      strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />)}
    {visible.buildings.map(building => <use key={building.id} data-factory-building={building.id}
      data-constructed={building.constructed} href={`#${id}-${building.shape}`} transform={`translate(${building.x},${-building.y})`}
      className="text-muted-foreground" fill={building.constructed ? 'currentColor' : 'none'} fillOpacity={0.4}
      stroke={building.constructed ? 'none' : 'currentColor'} strokeOpacity={0.6} strokeWidth={0.75} strokeDasharray="2 2" />)}
    {visible.points.map(entity => <circle key={entity.entityId} data-factory-building-point={entity.entityId}
      cx={entity.tile.x} cy={-entity.tile.y} r={worldUnitsPerPixel}
      className="text-muted-foreground" fill="currentColor" fillOpacity={0.6} />)}
  </g>;
};
