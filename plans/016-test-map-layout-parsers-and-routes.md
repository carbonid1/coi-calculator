# Plan 016: The map and layout parsers and the three data routes have fast unit tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- app/factory-layout.ts app/island-map.ts app/api`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (tests only)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

The calculator validates everything the game mod ("CoI Calculator Bridge")
sends before using it. Two validators — for the island map and for the factory
layout — and three of the four API routes are exercised only by
`tests/browser.smoke.mjs`, a browser test that takes several minutes and that
nobody runs on every change. Each validator has a dozen rejection rules
(duplicate ids, out-of-range indexes, overlapping runs) and the browser test
tries one bad input per validator. A regression in the other rules would go
unnoticed. The repository's policy keeps "focused regressions for … data-boundary
failures that the smoke scenarios do not cover"; these are exactly that.

## Current state

- `app/factory-layout.ts` exports `normalizeFactoryLayout(value: unknown): FactoryLayout | null`
  and `buildFactoryFootprintPath(rectangles)`. Rules, in order:
  - `schemaVersion` must be `1`; `gameId` and `sessionId` non-empty strings.
  - each area: integer `id ≥ 0`, `outline` of 3–4096 points, each point
    `[x, y]` with integer coordinates in −65536…65536; area ids unique.
  - each shape: a non-empty array of rectangles `[minX, minY, maxX, maxY]`
    with `minX < maxX` and `minY < maxY`.
  - each building: integer `id`, non-empty `prototypeId`, coordinates,
    `shape` an index into `shapes`, boolean `constructed`, `areas` a list of
    known area ids without duplicates; building ids unique.
  - `buildFactoryFootprintPath` (line 74–75):

    ```ts
    export const buildFactoryFootprintPath = (rectangles: readonly FactoryRect[]) => rectangles
      .map(([minX, minY, maxX, maxY]) => `M${minX},${-minY}H${maxX}V${-maxY}H${minX}Z`).join('');
    ```

- `app/island-map.ts` exports `normalizeIslandMap(value: unknown): IslandMap | null`
  and `buildIslandOutline(map: IslandMap): string`. Rules:
  - `schemaVersion` `1`; non-empty `gameId`, `sessionId`; integer `revision ≥ 0`;
    `width`, `height` in 1…32768; `cellSize` in 1…256.
  - `columns = ceil(width / cellSize)`, `rows = ceil(height / cellSize)`, both
    at most 256; `landRows` must have exactly `rows` entries.
  - each row is a flat list of pairs `[start, end, start, end, …]`: even
    length, every value an integer in 0…columns, each `start` not before the
    previous `end`, each `end` strictly after its `start`.
  - Row zero is the south edge. `buildIslandOutline` returns an SVG path with
    one closed sub-path (`M…Z`) per coastline, with y negated.
- `app/api/island-map/route.ts` and `app/api/factory-layout/route.ts` have the
  same shape. From `app/api/factory-layout/route.ts`:

  ```ts
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
      // … builds an ETag and returns 304 when If-None-Match equals it, else 200 …
    } catch { return unavailable(503); }
  };
  ```

  The island-map route fetches `/api/mods/CoiCalculatorExporter/island-map`
  and uses `normalizeIslandMap`.
- `app/api/game-state/route.ts` calls `readGameStateSnapshot()` from
  `app/server/read-game-state-snapshot.ts`. With a snapshot it returns 200 with
  an `ETag` header (or 304 when the request's `if-none-match` matches); without
  one it returns `{ error }` with the result's `httpStatus`.
- `fetchGameWebApi` (`app/server/game-web-api.ts`) imports `'server-only'` and
  calls the global `fetch` against `process.env.COI_WEB_API_URL` or
  `http://127.0.0.1:3073`.
- The pattern to copy is `app/api/game-icons/[id]/route.test.ts` (whole file):

  ```ts
  import { afterEach, beforeEach, expect, it, vi } from 'vitest'

  vi.mock('server-only', () => ({}))

  import { GET } from './route'

  const fetchMock = vi.fn<typeof fetch>()
  const get = (id = 'Product_Salt', query = '?v=456') => GET(new Request(`http://localhost:3000/api/game-icons/${id}${query}`), {
    params: Promise.resolve({ id }),
  })

  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('COI_WEB_API_URL', 'http://127.0.0.1:3073') })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('keeps missing icons and unavailable games as errors, without caching a fallback', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    const missing = await get()

    expect(missing.status).toBe(404)
    // …
    fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
    expect((await get()).status).toBe(503)
  })
  ```

- Conventions: tests sit beside the file they test as `<name>.test.ts`; test
  files use single quotes and no semicolons; the lint rules forbid `as` type
  assertions other than `as const`, and forbid a local variable named `module`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| New tests | `pnpm exec vitest run app/factory-layout.test.ts app/island-map.test.ts app/api` | all pass |
| Lint (check only) | `pnpm lint` | exit 0 |

## Scope

**In scope** (all new files):
- `app/factory-layout.test.ts`
- `app/island-map.test.ts`
- `app/api/island-map/route.test.ts`
- `app/api/factory-layout/route.test.ts`
- `app/api/game-state/route.test.ts`

**Out of scope** (do NOT touch):
- Every non-test file. If a test you were told to write fails, that is a
  finding to report, not something to fix in the source.
- `tests/browser.smoke.mjs`.

## Git workflow

- Branch: `advisor/016-test-map-layout-parsers-and-routes`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Stabilise test discovery and smoke test timeouts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Factory layout parser

Create `app/factory-layout.test.ts`:

```ts
import { expect, it } from 'vitest'

import { buildFactoryFootprintPath, normalizeFactoryLayout } from './factory-layout'

const layout = () => ({
  schemaVersion: 1, gameId: 'game', sessionId: 'session',
  areas: [{ id: 1, outline: [[0, 0], [10, 0], [10, 10]] }, { id: 2, outline: [[0, 0], [-10, 0], [-10, -10]] }],
  shapes: [[[-1, -1, 1, 1]], [[-2, -1, 2, 1], [-1, 1, 1, 2]]],
  buildings: [
    { id: 7, prototypeId: 'Smelter', x: 5, y: 5, shape: 0, constructed: true, areas: [1] },
    { id: 8, prototypeId: 'Depot', x: -5, y: -5, shape: 1, constructed: false, areas: [1, 2] },
  ],
})

it('accepts a well-formed layout unchanged', () => {
  expect(normalizeFactoryLayout(layout())).toEqual(layout())
})

it.each([
  { name: 'a different schema version', change: { schemaVersion: 2 } },
  { name: 'an empty game id', change: { gameId: '' } },
  { name: 'an empty session id', change: { sessionId: '' } },
  { name: 'duplicate area ids', change: { areas: [layout().areas[0], layout().areas[0]] } },
  { name: 'an outline with two points', change: { areas: [{ id: 1, outline: [[0, 0], [1, 1]] }] } },
  { name: 'a coordinate outside the map', change: { areas: [{ id: 1, outline: [[0, 0], [70000, 0], [0, 10]] }] } },
  { name: 'a fractional coordinate', change: { areas: [{ id: 1, outline: [[0, 0], [1.5, 0], [0, 10]] }] } },
  { name: 'an empty shape', change: { shapes: [[]] } },
  { name: 'a rectangle with no width', change: { shapes: [[[1, -1, 1, 1]]] } },
  { name: 'a rectangle with no height', change: { shapes: [[[-1, 1, 1, 1]]] } },
])('rejects $name', ({ change }) => {
  expect(normalizeFactoryLayout({ ...layout(), ...change })).toBeNull()
})

it.each([
  { name: 'a shape index past the end', change: { shape: 2 } },
  { name: 'an unknown area', change: { areas: [3] } },
  { name: 'the same area twice', change: { areas: [1, 1] } },
  { name: 'an empty prototype id', change: { prototypeId: '' } },
  { name: 'a non-boolean construction flag', change: { constructed: 1 } },
  { name: 'a duplicate building id', change: { id: 8 } },
])('rejects a building with $name', ({ change }) => {
  const [first, second] = layout().buildings

  expect(normalizeFactoryLayout({ ...layout(), buildings: [{ ...first, ...change }, second] })).toBeNull()
})

it.each([null, 'text', [], 42])('rejects a reply that is not an object: %s', value => {
  expect(normalizeFactoryLayout(value)).toBeNull()
})

it('draws footprints north-up by negating y', () => {
  expect(buildFactoryFootprintPath([[-1, -2, 3, 4]])).toBe('M-1,2H3V-4H-1Z')
  expect(buildFactoryFootprintPath([[0, 1, 2, 3], [4, 5, 6, 7]])).toBe('M0,-1H2V-3H0ZM4,-5H6V-7H4Z')
})
```

**Verify**: `pnpm exec vitest run app/factory-layout.test.ts` → all pass.

### Step 2: Island map parser

Create `app/island-map.test.ts`:

```ts
import { expect, it } from 'vitest'

import { buildIslandOutline, normalizeIslandMap } from './island-map'

// 4 columns by 2 rows; row zero is the south edge.
const map = () => ({
  schemaVersion: 1, gameId: 'game', sessionId: 'session', revision: 3,
  width: 4, height: 2, cellSize: 1, landRows: [[0, 2], [1, 3]],
})

it('accepts a well-formed map unchanged', () => {
  expect(normalizeIslandMap(map())).toEqual(map())
  expect(normalizeIslandMap({ ...map(), landRows: [[], [0, 1, 2, 4]] })).not.toBeNull()
})

it.each([
  { name: 'a different schema version', change: { schemaVersion: 2 } },
  { name: 'an empty game id', change: { gameId: '' } },
  { name: 'a negative revision', change: { revision: -1 } },
  { name: 'a zero cell size', change: { cellSize: 0 } },
  { name: 'more than 256 columns', change: { width: 300 } },
  { name: 'a missing row', change: { landRows: [[0, 2]] } },
  { name: 'an extra row', change: { landRows: [[0, 2], [1, 3], [0, 1]] } },
  { name: 'an unpaired run boundary', change: { landRows: [[0], [1, 3]] } },
  { name: 'a run past the last column', change: { landRows: [[0, 5], [1, 3]] } },
  { name: 'an empty run', change: { landRows: [[2, 2], [1, 3]] } },
  { name: 'overlapping runs', change: { landRows: [[0, 2, 1, 3], [1, 3]] } },
  { name: 'a fractional boundary', change: { landRows: [[0, 1.5], [1, 3]] } },
])('rejects $name', ({ change }) => {
  expect(normalizeIslandMap({ ...map(), ...change })).toBeNull()
})

it.each([null, 'text', [], 42])('rejects a reply that is not an object: %s', value => {
  expect(normalizeIslandMap(value)).toBeNull()
})

it('traces one closed coastline per island and one more per inland water', () => {
  const outline = (landRows: number[][], width: number, height: number) => {
    const parsed = normalizeIslandMap({ ...map(), width, height, landRows })

    if (!parsed) throw new Error('Test map is invalid')
    return buildIslandOutline(parsed)
  }
  const closedPaths = (path: string) => path.split('M').length - 1

  expect(outline([[0, 1]], 1, 1)).toBe('M0,0L1,0L1,-1L0,-1L0,0Z')
  expect(closedPaths(outline([[0, 1, 2, 3]], 3, 1))).toBe(2)
  expect(closedPaths(outline([[0, 3], [0, 1, 2, 3], [0, 3]], 3, 3))).toBe(2)
  expect(outline([[]], 1, 1)).toBe('')
})
```

**Verify**: `pnpm exec vitest run app/island-map.test.ts` → all pass. If only
the exact single-cell path string differs, see STOP conditions.

### Step 3: Island map and factory layout routes

Create `app/api/island-map/route.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GET } from './route'

const fetchMock = vi.fn<typeof fetch>()
const map = {
  schemaVersion: 1, gameId: 'game', sessionId: 'session', revision: 3,
  width: 4, height: 2, cellSize: 1, landRows: [[0, 2], [1, 3]],
}
const get = (query = '?gameId=game&sessionId=session', headers: Record<string, string> = {}) => (
  GET(new Request(`http://localhost:3000/api/island-map${query}`, { headers }))
)

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('COI_WEB_API_URL', 'http://127.0.0.1:3073') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })

it('returns the validated map and answers a matching ETag with 304', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(map)))
  const response = await get()

  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3073/api/mods/CoiCalculatorExporter/island-map')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(map)
  const etag = response.headers.get('etag')

  expect(etag).toBeTruthy()
  expect((await get(undefined, { 'If-None-Match': etag ?? '' })).status).toBe(304)
})

it('requires both identifiers without asking the game', async () => {
  expect((await get('')).status).toBe(400)
  expect((await get('?gameId=game')).status).toBe(400)
  expect((await get(`?gameId=${'g'.repeat(101)}&sessionId=session`)).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('maps game-side failures to distinct statuses', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect((await get()).status).toBe(404)
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
  expect((await get()).status).toBe(502)
  fetchMock.mockResolvedValueOnce(Response.json({ ...map, landRows: [[0, 2]] }))
  expect((await get()).status).toBe(502)
  fetchMock.mockResolvedValueOnce(Response.json({ ...map, sessionId: 'other' }))
  expect((await get()).status).toBe(409)
  fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
  expect((await get()).status).toBe(503)
})
```

Create `app/api/factory-layout/route.test.ts` the same way, with these
differences: the URL path is `/api/factory-layout`; the expected upstream URL
ends in `/api/mods/CoiCalculatorExporter/factory-layout`; the valid body is

```ts
const layout = {
  schemaVersion: 1, gameId: 'game', sessionId: 'session',
  areas: [{ id: 1, outline: [[0, 0], [10, 0], [10, 10]] }],
  shapes: [[[-1, -1, 1, 1]]],
  buildings: [{ id: 7, prototypeId: 'Smelter', x: 5, y: 5, shape: 0, constructed: true, areas: [1] }],
}
```

and the invalid body for the 502 case is `{ ...layout, shapes: [[[1, 1, 0, 0]]] }`.
Add one more assertion to its first test: after changing the upstream reply to
a layout with a second building
(`{ id: 8, prototypeId: 'Depot', x: 1, y: 1, shape: 0, constructed: false, areas: [1] }`),
a request carrying the old ETag returns 200, not 304.

**Verify**: `pnpm exec vitest run app/api/island-map app/api/factory-layout` → all pass.

### Step 4: Game state route

Create `app/api/game-state/route.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('../../server/read-game-state-snapshot', () => ({ readGameStateSnapshot: read }))

import { GET } from './route'

const available = (revision: string) => ({
  error: null, httpStatus: 200, isFresh: true, revision, status: 'available',
  snapshot: { exportedAtUtc: '2026-11-02T12:00:00.000Z', saveId: 'island' },
})
const get = (headers: Record<string, string> = {}) => GET(new Request('http://localhost:3000/api/game-state', { headers }))

beforeEach(() => { vi.resetAllMocks() })

it('returns the snapshot with its revision and answers a matching ETag with 304', async () => {
  read.mockResolvedValue(available('revision-a'))
  const response = await get()

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(available('revision-a').snapshot)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-coi-snapshot-revision')).toBe('revision-a')
  const etag = response.headers.get('etag') ?? ''

  expect(etag).not.toBe('')
  expect((await get({ 'If-None-Match': etag })).status).toBe(304)
  read.mockResolvedValue(available('revision-b'))
  expect((await get({ 'If-None-Match': etag })).status).toBe(200)
})

it.each([404, 422, 502, 503])('passes a %s failure through with its reason', async httpStatus => {
  read.mockResolvedValue({ error: 'Reason for the player.', httpStatus, isFresh: false, revision: null, snapshot: null, status: 'error' })
  const response = await get()

  expect(response.status).toBe(httpStatus)
  expect(await response.json()).toEqual({ error: 'Reason for the player.' })
})
```

**Verify**: `pnpm exec vitest run app/api/game-state` → all pass.

### Step 5: Everything together

**Verify**: `pnpm exec vitest run app/factory-layout.test.ts app/island-map.test.ts app/api`
→ all pass. `pnpm lint` exits 0. `git status --short` lists only the five new
files.

## Test plan

This plan is the test plan: five new test files, about 50 cases, all in
vitest and all running in well under a second each. They follow
`app/api/game-icons/[id]/route.test.ts`.

## Done criteria

- [ ] The five files in "Scope" exist
- [ ] `pnpm exec vitest run app/factory-layout.test.ts app/island-map.test.ts app/api` passes
- [ ] `pnpm lint` exits 0
- [ ] `git diff --stat 29c10d9 -- app ":(exclude)app/**/*.test.ts"` shows no change from this plan
- [ ] `git status --short` lists only the five new files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise, and do not weaken, reorder or delete a
case to get a pass) if:

- A "rejects …" case fails because the validator accepts the input. That is a
  real finding: report the case name and input. Do not edit the validator.
- A status code differs from the one the plan expects. Report the case, the
  expected and the received status.
- The exact single-cell outline `'M0,0L1,0L1,-1L0,-1L0,0Z'` differs. Report the
  string received; replace that one assertion with
  `expect(closedPaths(outline([[0, 1]], 1, 1))).toBe(1)` and continue, noting
  it in your report. (The exact vertex order is not a contract.)
- `pnpm lint` rejects code taken verbatim from this plan. Report the rule and
  line; do not add disable comments or `as` assertions.
- A route test cannot import its route because of a missing mock. Report the
  import error.

## Maintenance notes

- When a validator gains a rule, add a row to the matching `it.each` table.
- The browser smoke keeps one bad-input case per route; it still proves the
  wiring end to end, and these tests carry the detailed rules.
