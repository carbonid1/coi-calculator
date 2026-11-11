# Plan 009: A rejected Bridge reply says whether the Bridge, the calculator or the game version is the mismatch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/game-state.ts app/game-state.test.ts app/server/read-game-state-snapshot.ts app/server/read-game-state-snapshot.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The calculator reads factory data from a game mod called CoI Calculator Bridge
and validates it with `normalizeGameStateSnapshot`, which returns `null` for
any problem. The server then always answers "Update CoI Calculator Bridge for
this version of the calculator and game." That advice is right in only one of
four cases:

1. the Bridge is older than the calculator expects (advice is right);
2. the Bridge is newer than the calculator (the calculator needs updating);
3. the game was patched to a version the calculator does not accept yet (no
   Bridge update exists; nothing the player installs will help);
4. the data failed a consistency check (neither side is out of date).

After a game patch, the player is told to update a mod that has no newer
release. This plan makes the message match the cause. It adds no UI: the
sentence appears in the existing sync status line and server log, which
already display whatever error string the server returns.

## Current state

- `app/game-state.ts` — snapshot types and validation.
  - Line 318: `export const CURRENT_GAME_STATE_SCHEMA_VERSION = 56 as const`
  - Line 378: `const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>` (module-private helper)
  - Lines 1107–1113 and 1126:

    ```ts
    export const normalizeGameStateSnapshot = (value: unknown): GameStateSnapshot | null => {
      if (!isUnknownRecord(value)) return null

      const snapshot = value
      const schemaVersion = snapshot.schemaVersion

      if (schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION) return null
    ```

    ```ts
      if (typeof snapshot.gameVersion !== 'string' || !/^0\.8\.8[a-z]?$/.test(snapshot.gameVersion)) return null
    ```

  About 30 further checks follow, each returning `null`.
- `app/server/read-game-state-snapshot.ts` — server-side reader. Lines 62–74:

  ```ts
    const [bridge, catalog, inventory, rawHistory, afterResponse] = await Promise.all([
      response.json().then(normalizeGameStateSnapshot).catch(() => null),
      catalogResponse.json().catch(() => null),
      inventoryResponse.json().catch(() => null),
      historyResponse.json().catch(() => null),
      fetchGameWebApi('/api/v1/game-info', signal),
    ])
    const after: unknown = afterResponse.ok ? await afterResponse.json().catch(() => null) : null
    const products = normalizeNativeProducts(catalog, inventory, before)

    if (!bridge) {
      return unavailable(422, 'Update CoI Calculator Bridge for this version of the calculator and game.')
    }
  ```

  Line 3 imports: `import { normalizeGameStateSnapshot, type GameStateSnapshot } from '../game-state'`
- `app/server/read-game-state-snapshot.test.ts` — mocks the whole
  `../game-state` module (lines 4–8):

  ```ts
  const { normalize, revision } = vi.hoisted(() => ({ normalize: vi.fn(), revision: vi.fn() }))

  vi.mock('server-only', () => ({}))
  vi.mock('../game-state', () => ({ normalizeGameStateSnapshot: normalize }))
  vi.mock('./game-state-snapshot-revision', () => ({ calculateGameStateSnapshotRevision: revision }))
  ```

  and has this test (lines 127–132):

  ```ts
  it('rejects malformed JSON and incompatible game data', async () => {
    bridgeReply.mockReturnValueOnce(new Response('<html>wrong endpoint</html>'))
    expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
    normalize.mockReturnValueOnce(null)
    expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
  })
  ```

  The default Bridge reply in that file is `Response.json({ raw: 'game' })`.
- `app/game-state.test.ts` imports from `./game-state` at the top, including
  `CURRENT_GAME_STATE_SCHEMA_VERSION` and `isGameStateSnapshot`, and uses plain
  `it(...)` / `expect(...)` from vitest.
- Conventions:
  - Around line 1107, `app/game-state.ts` uses single quotes and no
    semicolons. `app/server/*.ts` uses single quotes and no semicolons.
  - Player-facing copy rules (from the repository's `player-facing-copy`
    skill): write like a concise human maintainer; use exact game and mod
    names ("CoI Calculator Bridge"); do not use internal terms such as
    "snapshot" or "schema"; do not explain familiar mechanics.
  - The string 'Update CoI Calculator Bridge for this version of the calculator and game.'
    appears nowhere else in the repository (tests do not assert on it).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Focused tests | `pnpm exec vitest run app/server app/game-state.test.ts` | all pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Suggested executor toolkit

- If a `player-facing-copy` skill exists under `.claude/skills/` or
  `.agents/skills/`, read it before changing any of the four sentences in
  step 2. The sentences given in this plan already follow it; use them as
  written unless the skill clearly contradicts one.

## Scope

**In scope**:
- `app/game-state.ts` (one new exported type, one new exported function, one extracted constant)
- `app/game-state.test.ts` (one new test)
- `app/server/read-game-state-snapshot.ts`
- `app/server/read-game-state-snapshot.test.ts`

**Out of scope** (do NOT touch):
- The return type of `normalizeGameStateSnapshot` — it stays
  `GameStateSnapshot | null`. About 100 call sites and tests depend on it.
- Which game versions are accepted. Do not widen the pattern.
- `app/hooks/use-game-state.ts`, `app/components/GameSyncStatus.tsx`,
  `app/page.tsx` — they already display the server's error string.
- Anything under `game-mod/`.
- The HTTP status: it stays 422 for all four cases.

## Git workflow

- Branch: `advisor/009-name-the-snapshot-rejection-reason`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Show the game sync failure reason in the status line`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the reason function to `app/game-state.ts`

1. Directly above `export const normalizeGameStateSnapshot` (line 1107), add:

   ```ts
   const SUPPORTED_GAME_VERSION = /^0\.8\.8[a-z]?$/

   export type GameStateSnapshotRejection = 'bridge-outdated' | 'calculator-outdated' | 'game-version' | 'invalid'

   /** Names why a Bridge reply failed normalizeGameStateSnapshot, so the status line can give the right advice. */
   export const describeGameStateSnapshotRejection = (value: unknown): GameStateSnapshotRejection => {
     if (!isUnknownRecord(value) || typeof value.schemaVersion !== 'number') return 'invalid'
     if (value.schemaVersion < CURRENT_GAME_STATE_SCHEMA_VERSION) return 'bridge-outdated'
     if (value.schemaVersion > CURRENT_GAME_STATE_SCHEMA_VERSION) return 'calculator-outdated'
     if (typeof value.gameVersion === 'string' && !SUPPORTED_GAME_VERSION.test(value.gameVersion)) return 'game-version'
     return 'invalid'
   }
   ```

2. In `normalizeGameStateSnapshot`, change the game-version line (line 1126)
   to use the constant, with no change in behaviour:

   ```ts
     if (typeof snapshot.gameVersion !== 'string' || !SUPPORTED_GAME_VERSION.test(snapshot.gameVersion)) return null
   ```

**Verify**: `pnpm ts` exits 0. `git grep -c "SUPPORTED_GAME_VERSION" -- app/game-state.ts`
prints `app/game-state.ts:3` (the definition and its two uses).

### Step 2: Use it in the server reader

In `app/server/read-game-state-snapshot.ts`:

1. Change the import on line 3 to:

   ```ts
   import {
     describeGameStateSnapshotRejection, normalizeGameStateSnapshot,
     type GameStateSnapshot, type GameStateSnapshotRejection,
   } from '../game-state'
   ```

2. Below the `requests` constant (line 32), add:

   ```ts
   const rejectionMessages: Record<GameStateSnapshotRejection, string> = {
     'bridge-outdated': 'Update CoI Calculator Bridge for this version of the calculator.',
     'calculator-outdated': 'Update the calculator for this version of CoI Calculator Bridge.',
     'game-version': 'This game version is not supported yet.',
     invalid: 'The calculator could not read this factory.',
   }
   ```

3. Keep the raw Bridge reply next to the validated one. Replace the first
   element of the `Promise.all` array and the destructuring target:

   ```ts
     const [{ raw, bridge }, catalog, inventory, rawHistory, afterResponse] = await Promise.all([
       response.json()
         .then((raw: unknown) => ({ raw, bridge: normalizeGameStateSnapshot(raw) }))
         .catch(() => ({ raw: null, bridge: null })),
       catalogResponse.json().catch(() => null),
       inventoryResponse.json().catch(() => null),
       historyResponse.json().catch(() => null),
       fetchGameWebApi('/api/v1/game-info', signal),
     ])
   ```

4. Replace the `if (!bridge)` block with:

   ```ts
     if (!bridge) {
       return unavailable(422, rejectionMessages[describeGameStateSnapshotRejection(raw)])
     }
   ```

**Verify**: `pnpm ts` exits 0.
`git grep -n "for this version of the calculator and game" -- app` prints nothing.

### Step 3: Update and extend the reader tests

In `app/server/read-game-state-snapshot.test.ts`:

1. Add a third hoisted mock and expose it from the module mock:

   ```ts
   const { normalize, rejection, revision } = vi.hoisted(() => ({ normalize: vi.fn(), rejection: vi.fn(), revision: vi.fn() }))
   ```

   ```ts
   vi.mock('../game-state', () => ({
     describeGameStateSnapshotRejection: rejection, normalizeGameStateSnapshot: normalize,
   }))
   ```

2. In `beforeEach`, after `normalize.mockReturnValue(snapshot)`, add
   `rejection.mockReturnValue('invalid')`.

3. Directly after the existing test `rejects malformed JSON and incompatible game data`, add:

   ```ts
   it.each([
     ['bridge-outdated', 'Update CoI Calculator Bridge for this version of the calculator.'],
     ['calculator-outdated', 'Update the calculator for this version of CoI Calculator Bridge.'],
     ['game-version', 'This game version is not supported yet.'],
     ['invalid', 'The calculator could not read this factory.'],
   ])('names the mismatch behind a rejected Bridge reply: %s', async (reason, error) => {
     normalize.mockReturnValueOnce(null)
     rejection.mockReturnValueOnce(reason)
     expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null, status: 'error', error })
     expect(rejection).toHaveBeenCalledWith({ raw: 'game' })
   })
   ```

**Verify**: `pnpm exec vitest run app/server` → all pass, including 4 new cases.

### Step 4: Test the reason function itself

In `app/game-state.test.ts`, add `describeGameStateSnapshotRejection` to the
existing import from `./game-state`, and add this test at the end of the file
(outside any `describe` block if the file ends inside one, place it as the
last test of the last block instead):

```ts
it('names why a Bridge reply is rejected', () => {
  const current = { schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION, gameVersion: '0.8.8' }

  expect(describeGameStateSnapshotRejection({ ...current, schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION - 1 })).toBe('bridge-outdated')
  expect(describeGameStateSnapshotRejection({ ...current, schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION + 1 })).toBe('calculator-outdated')
  expect(describeGameStateSnapshotRejection({ ...current, gameVersion: '0.8.9' })).toBe('game-version')
  expect(describeGameStateSnapshotRejection(current)).toBe('invalid')
  for (const value of [null, 'text', [], {}, { schemaVersion: '56' }]) {
    expect(describeGameStateSnapshotRejection(value)).toBe('invalid')
  }
})
```

**Verify**: `pnpm exec vitest run app/game-state.test.ts` → all pass,
including the new test.

### Step 5: Full checks

**Verify**: `pnpm ts`, `pnpm lint` and `pnpm build` exit 0.
`pnpm exec vitest run app/server app/hooks app/game-state.test.ts` → all pass.

## Test plan

- `app/server/read-game-state-snapshot.test.ts`: four new parametrised cases,
  one per reason, asserting the exact sentence and that the raw reply is what
  gets classified. Modelled on the existing tests in the same file.
- `app/game-state.test.ts`: one new test covering each reason and malformed
  input.
- The existing test `rejects malformed JSON and incompatible game data` must
  still pass unchanged (status stays 422).

## Done criteria

- [ ] `git grep -n "for this version of the calculator and game" -- app` prints nothing
- [ ] `git grep -c "describeGameStateSnapshotRejection" -- app/server/read-game-state-snapshot.ts` → `2`
- [ ] `pnpm exec vitest run app/server app/game-state.test.ts` passes with 5 new test cases
- [ ] `pnpm ts`, `pnpm lint`, `pnpm build` exit 0
- [ ] `git status --short` lists only the four in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any test outside the four in-scope files fails after your change.
- `app/game-state.ts` already contains a function that reports a rejection
  reason, or `normalizeGameStateSnapshot` no longer returns `null` on failure.
- `[]` in the step 4 loop does not classify as `'invalid'` (the private
  `isUnknownRecord` helper accepts arrays, and an array has no numeric
  `schemaVersion`, so it should). Report the actual value.
- You find a test or script that asserts on the old sentence.

## Maintenance notes

- When the supported game version changes, update `SUPPORTED_GAME_VERSION` in
  `app/game-state.ts` only; both the validator and the reason function read it.
- `'invalid'` still covers about 30 distinct consistency checks. If one of
  them starts firing for real players, the next step is to have the Bridge or
  the validator name the failing section — deliberately not done here because
  it would change `normalizeGameStateSnapshot`'s return type.
- Related, not done here: when a Bridge collector throws inside the game, the
  game returns an error and the calculator shows "The game could not provide
  calculator data. Check the game log." Naming the failing section needs a
  change in `game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs` and a
  machine with the game installed.
