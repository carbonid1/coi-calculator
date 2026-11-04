export interface IslandMap {
  schemaVersion: 1;
  gameId: string;
  sessionId: string;
  revision: number;
  width: number;
  height: number;
  cellSize: number;
  /** Row zero is south. Each pair is a half-open run of land cells. */
  landRows: number[][];
}

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeIslandMap = (value: unknown): IslandMap | null => {
  if (!record(value)) return null;
  const map = value;

  if (map.schemaVersion !== 1 || typeof map.gameId !== 'string' || !map.gameId
    || typeof map.sessionId !== 'string' || !map.sessionId || !integer(map.revision, 0, Number.MAX_SAFE_INTEGER)
    || !integer(map.width, 1, 32768) || !integer(map.height, 1, 32768) || !integer(map.cellSize, 1, 256)) return null;
  const columns = Math.ceil(map.width / map.cellSize);
  const rows = Math.ceil(map.height / map.cellSize);

  if (columns > 256 || rows > 256 || !Array.isArray(map.landRows) || map.landRows.length !== rows) return null;
  const landRows: number[][] = [];

  for (const row of map.landRows) {
    if (!Array.isArray(row) || row.length % 2 !== 0 || row.length > columns * 2) return null;
    const cursor = { end: 0 };
    const validated: number[] = [];

    for (const [index, start] of row.entries()) {
      if (!integer(start, 0, columns)) return null;
      validated.push(start);
      if (index % 2 === 0) {
        if (start < cursor.end) return null;
        cursor.end = start;
      } else {
        if (start <= cursor.end) return null;
        cursor.end = start;
      }
    }
    landRows.push(validated);
  }
  return { schemaVersion: 1, gameId: map.gameId, sessionId: map.sessionId, revision: map.revision,
    width: map.width, height: map.height, cellSize: map.cellSize, landRows };
};

/** Trace cell boundaries once, preserving bays, separate islands and inland water. */
export const buildIslandOutline = (map: IslandMap): string => {
  const columns = Math.ceil(map.width / map.cellSize);
  const rows = map.landRows.length;
  const land = new Uint8Array(columns * rows);

  map.landRows.forEach((runs, y) => {
    for (const index of runs.keys()) {
      const start = runs[index];
      const end = runs[index + 1];

      if (index % 2 === 0 && start !== undefined && end !== undefined) land.fill(1, y * columns + start, y * columns + end);
    }
  });
  const edges = new Map<number, number[]>();
  const stride = columns + 1;
  const edge = (x: number, y: number, toX: number, toY: number) => {
    const start = y * stride + x;
    const targets = edges.get(start) ?? [];

    targets.push(toY * stride + toX);
    edges.set(start, targets);
  };

  land.forEach((filled, index) => {
    if (!filled) return;
    const x = index % columns;
    const y = Math.floor(index / columns);

    if (y === 0 || !land[index - columns]) edge(x, y, x + 1, y);
    if (x === columns - 1 || !land[index + 1]) edge(x + 1, y, x + 1, y + 1);
    if (y === rows - 1 || !land[index + columns]) edge(x + 1, y + 1, x, y + 1);
    if (x === 0 || !land[index - 1]) edge(x, y + 1, x, y);
  });
  const point = (vertex: number) => `${Math.min(map.width, vertex % stride * map.cellSize)},${-Math.min(map.height, Math.floor(vertex / stride) * map.cellSize)}`;
  const paths: string[] = [];

  while (edges.size > 0) {
    const start = edges.keys().next().value;

    if (start === undefined) break;
    const trace = { vertex: start, path: `M${point(start)}` };

    do {
      const targets = edges.get(trace.vertex);
      const next = targets?.pop();

      if (!targets?.length) edges.delete(trace.vertex);
      if (next === undefined) break;
      trace.vertex = next;
      trace.path += `L${point(next)}`;
    } while (trace.vertex !== start);
    paths.push(`${trace.path}Z`);
  }
  return paths.join('');
};
