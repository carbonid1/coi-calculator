export type FactoryPoint = [number, number];
export type FactoryRect = [number, number, number, number];

export interface FactoryLayout {
  schemaVersion: 1;
  gameId: string;
  sessionId: string;
  areas: { id: number; outline: FactoryPoint[] }[];
  shapes: FactoryRect[][];
  buildings: { id: number; prototypeId: string; x: number; y: number; shape: number; constructed: boolean; areas: number[] }[];
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const coordinate = (value: unknown): value is number => integer(value, -65536, 65536);

export const normalizeFactoryLayout = (value: unknown): FactoryLayout | null => {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.gameId !== 'string' || !value.gameId
    || typeof value.sessionId !== 'string' || !value.sessionId || !Array.isArray(value.areas) || value.areas.length > 4096
    || !Array.isArray(value.shapes) || value.shapes.length > 8192 || !Array.isArray(value.buildings) || value.buildings.length > 100000) return null;
  const areas: FactoryLayout['areas'] = [];
  const shapes: FactoryLayout['shapes'] = [];
  const buildings: FactoryLayout['buildings'] = [];
  const totals = { vertices: 0, rectangles: 0 };

  for (const area of value.areas) {
    if (!record(area) || !integer(area.id) || !Array.isArray(area.outline) || area.outline.length < 3 || area.outline.length > 4096) return null;
    const outline: FactoryPoint[] = [];

    for (const point of area.outline) {
      if (!Array.isArray(point) || point.length !== 2 || !coordinate(point[0]) || !coordinate(point[1])) return null;
      outline.push([point[0], point[1]]);
    }
    totals.vertices += outline.length;
    areas.push({ id: area.id, outline });
  }
  const areaIds = new Set(areas.map(area => area.id));

  if (areaIds.size !== areas.length || totals.vertices > 100000) return null;
  for (const shape of value.shapes) {
    if (!Array.isArray(shape) || shape.length === 0 || shape.length > 65536) return null;
    const rectangles: FactoryRect[] = [];

    for (const rect of shape) {
      if (!Array.isArray(rect) || rect.length !== 4) return null;
      const [minX, minY, maxX, maxY] = rect;

      if (!coordinate(minX) || !coordinate(minY) || !coordinate(maxX) || !coordinate(maxY) || minX >= maxX || minY >= maxY) return null;
      rectangles.push([minX, minY, maxX, maxY]);
    }
    totals.rectangles += rectangles.length;
    if (totals.rectangles > 100000) return null;
    shapes.push(rectangles);
  }
  for (const building of value.buildings) {
    if (!record(building) || !integer(building.id) || typeof building.prototypeId !== 'string' || !building.prototypeId
      || !coordinate(building.x) || !coordinate(building.y) || !integer(building.shape, 0, shapes.length - 1)
      || typeof building.constructed !== 'boolean' || !Array.isArray(building.areas)) return null;
    const ids: number[] = [];

    for (const id of building.areas) {
      if (!integer(id) || !areaIds.has(id)) return null;
      ids.push(id);
    }
    if (new Set(ids).size !== ids.length) return null;
    buildings.push({ id: building.id, prototypeId: building.prototypeId, x: building.x, y: building.y,
      shape: building.shape, constructed: building.constructed, areas: ids });
  }
  if (new Set(buildings.map(building => building.id)).size !== buildings.length) return null;
  return { schemaVersion: 1, gameId: value.gameId, sessionId: value.sessionId, areas, shapes, buildings };
};

export const buildFactoryFootprintPath = (rectangles: readonly FactoryRect[]) => rectangles
  .map(([minX, minY, maxX, maxY]) => `M${minX},${-minY}H${maxX}V${-maxY}H${minX}Z`).join('');
