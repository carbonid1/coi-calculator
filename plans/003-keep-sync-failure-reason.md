# Plan 003: A failed game sync says why, in the status line and the server log

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7c0a656..HEAD -- app/server/read-game-state-snapshot.ts app/server/read-game-state-snapshot.test.ts app/hooks/use-game-state.ts app/page.tsx app/components/GameSyncStatus.tsx app/calculator.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7c0a656`, 2026-11-11

## Why this matters

The server already works out why a sync failed and writes a specific sentence
("Update CoI Calculator Bridge…", "The loaded game changed…", "Check the game
log."). The browser throws that sentence away: every failure becomes the same
`"error"` status and the player sees either "Last sync" over stale data or
"Game data unavailable". After a calculator or game update that needs a new
Bridge build, nothing tells the player (or an AI assistant reading the page or
the server log) what to do. Two JSON reads in the server also lack a guard, so
a malformed reply from the game is mislabelled "Cannot connect to the game".

**Product constraint (from the maintainer): do not add new UI elements.** This
plan only changes the text of the existing status line, adds a `title` and a
`data-` attribute to that same element, and adds one server log line.

## Current state

- `app/server/read-game-state-snapshot.ts` — server-side reader. Builds failure
  results with `unavailable(httpStatus, error)`. Relevant excerpts:

  ```ts
  // :43-46
  const beforeResponse = await fetchGameWebApi('/api/v1/game-info', signal)
  const before: unknown = beforeResponse.ok ? await beforeResponse.json() : null

  if (!isGameIdentity(before)) return unavailable(502, 'The game could not provide calculator data. Check the game log.')
  ```

  ```ts
  // :61-73
  const [bridge, catalog, inventory, rawHistory, afterResponse] = await Promise.all([
    response.json().then(normalizeGameStateSnapshot).catch(() => null),
    catalogResponse.json().catch(() => null),
    inventoryResponse.json().catch(() => null),
    historyResponse.json().catch(() => null),
    fetchGameWebApi('/api/v1/game-info', signal),
  ])
  const after: unknown = afterResponse.ok ? await afterResponse.json() : null
  const products = normalizeNativeProducts(catalog, inventory, before)

  if (!bridge) {
    return unavailable(422, 'Update CoI Calculator Bridge for this version of the calculator and game.')
  }
  ```

  ```ts
  // :106-114
  export const readGameStateSnapshot = (): Promise<GameStateSnapshotReadResult> => {
    if (!requests.pending) {
      requests.pending = requestSnapshot()
        .catch(() => unavailable(503, 'Cannot connect to the game. Load a game with CoI Calculator Bridge enabled.'))
        .finally(() => { requests.pending = null })
    }
    return requests.pending
  }
  ```

  The two unguarded `.json()` calls are at `:44` and `:68`. If either body is
  not JSON the promise rejects and the outer `.catch` reports 503 "Cannot
  connect" even though the game is connected.

- `app/api/game-state/route.ts:30-33` — on failure returns
  `Response.json({ error: result.error }, { status: result.httpStatus })`.
  Already correct; do not change.

- `app/hooks/use-game-state.ts` — client polling hook.

  ```ts
  // :11-18
  export interface GameStateResult {
    exportedAtUtc: string | null;
    isFresh: boolean;
    revision: string | null;
    snapshot: GameStateSnapshot | null;
    source: GameStateDataSource;
    status: GameStateConnectionStatus;
  }
  ```

  ```ts
  // :91-102
  const setUnavailable = (status: "missing" | "error") => {
    if (!lifecycle.isActive) return;

    setResult(current => ({
      exportedAtUtc: current.exportedAtUtc,
      isFresh: false,
      revision: current.revision,
      snapshot: current.snapshot,
      source: current.snapshot ? "cached" : "none",
      status,
    }));
  };
  ```

  ```ts
  // :149-157
  if (response.status === 404) {
    setUnavailable("missing");
    return;
  }

  if (!response.ok) {
    setUnavailable("error");
    return;
  }
  ```

  The hook builds `GameStateResult` objects in four more places: the cached
  fallback (`:80-87`), the 304 branch (`:137-143`, via spread), and the success
  branch (`:187-196`). `setUnavailable` is also called at `:121`, `:165`,
  `:201` and `:208` without a server response.

- `app/page.tsx:11-27` — builds the initial `GameStateResult` from the server
  read; the failure branch keeps `status: result.status` and drops
  `result.error`.

- `app/components/GameSyncStatus.tsx` — the status line.

  ```ts
  // :26-38
  const getStatusLabel = (
    hasSnapshot: boolean,
    hasCurrentSync: boolean,
    status: GameStateConnectionStatus,
    isSyncing: boolean,
  ) => {
    if (isSyncing) return "Syncing game…";
    if (hasSnapshot) return hasCurrentSync ? "Synced" : "Last sync";
    if (status === "loading") return "Checking game…";
    if (status === "missing") return "Bridge unavailable";

    return "Game data unavailable";
  };
  ```

  The label is rendered inside `<p role="status" data-game-sync={…}>` at `:52-66`.

- `app/calculator.tsx:277-284` — renders `<GameSyncStatus … />` from `gameState`.

- Conventions: this repo's files mix two formatting styles (double quotes with
  semicolons in `use-game-state.ts`, `GameSyncStatus.tsx`, `page.tsx`; single
  quotes without semicolons in `app/server/*`). **Match the file you are
  editing.** There is exactly one `console.*` call in non-test app code
  (`app/hooks/use-factory-calculation.ts:80`, `console.error('Factory calculation failed.', error)`).
- Repo rule (AGENTS.md): "Do not narrate familiar game mechanics; show only
  calculated results, actionable state, and information the user explicitly
  requested." and "Prefer a small number of broad … smoke tests over isolated
  tests of rendering, formatting, or simple arithmetic." So: no component
  render tests in this plan.
- Tests for the reader live in `app/server/read-game-state-snapshot.test.ts`.
  It mocks `fetch` per upstream path with `bridgeReply`, `infoReply`,
  `inventoryReply`, `historyReply` and reads through `read()`. Pattern to copy:

  ```ts
  it('reports the missing bridge separately from a stopped server', async () => {
    bridgeReply.mockReturnValueOnce(new Response(null, { status: 404 }))
    expect(await read()).toMatchObject({ httpStatus: 404, snapshot: null, status: 'missing' })
  })
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check) | `pnpm exec eslint .` | exit 0 |
| Focused tests | `pnpm exec vitest run app/server app/hooks` | all pass |
| Build | `pnpm build` | exit 0 |

## Suggested executor toolkit

- If the `player-facing-copy` skill exists in `.claude/skills/` or
  `.agents/skills/`, read it before writing any sentence a player will see.
  This plan adds no new sentences; it only routes existing ones.

## Scope

**In scope**:
- `app/server/read-game-state-snapshot.ts`
- `app/server/read-game-state-snapshot.test.ts`
- `app/hooks/use-game-state.ts`
- `app/page.tsx`
- `app/components/GameSyncStatus.tsx`
- `app/calculator.tsx` (one added prop on `<GameSyncStatus>` only)

**Out of scope**:
- `app/game-state.ts` — do not add failure reasons to `normalizeGameStateSnapshot`.
- `app/api/game-state/route.ts` — already returns the error body.
- Any new component, icon, toast, banner or tooltip component.
- Changing the wording of the existing error sentences.
- `tests/browser.smoke.mjs`.

## Git workflow

- Branch: `advisor/003-keep-sync-failure-reason`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Show the game sync failure reason in the status line`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Guard the two identity reads (server)

In `app/server/read-game-state-snapshot.ts`, add `.catch(() => null)` to both
unguarded reads so a non-JSON `game-info` body flows into the existing
`isGameIdentity` checks:

```ts
const before: unknown = beforeResponse.ok ? await beforeResponse.json().catch(() => null) : null
...
const after: unknown = afterResponse.ok ? await afterResponse.json().catch(() => null) : null
```

Add a test to `read-game-state-snapshot.test.ts`:

```ts
it('reports unreadable game info as a game-side failure, not a lost connection', async () => {
  infoReply.mockReturnValueOnce(new Response('not json'))
  expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null, status: 'error' })
})
```

**Verify**: `pnpm exec vitest run app/server/read-game-state-snapshot.test.ts` → all pass, including the new test.

### Step 2: Log each new failure reason once (server)

In the same file, add a module-level `const logged: { error: string | null } = { error: null }`
next to `requests`, and make `readGameStateSnapshot` log when the reason
changes and reset when a read succeeds. Target shape:

```ts
export const readGameStateSnapshot = (): Promise<GameStateSnapshotReadResult> => {
  if (!requests.pending) {
    requests.pending = requestSnapshot()
      .catch(() => unavailable(503, 'Cannot connect to the game. Load a game with CoI Calculator Bridge enabled.'))
      .then(result => {
        if (result.error !== logged.error) {
          logged.error = result.error
          if (result.error) console.warn(`Game sync failed (${result.httpStatus}): ${result.error}`)
        }
        return result
      })
      .finally(() => { requests.pending = null })
  }
  return requests.pending
}
```

Add a test: stub `console.warn` with `vi.spyOn(console, 'warn').mockImplementation(() => {})`,
make `bridgeReply` return a 500 twice (two `read()` calls), and assert the spy
was called exactly once and its first argument contains `'Check the game log'`.
Then one successful `read()` followed by another 500 must log again (two calls
total).

**Verify**: `pnpm exec vitest run app/server/read-game-state-snapshot.test.ts` → all pass.
If ESLint rejects `console.warn` (`no-console`), add
`// eslint-disable-next-line no-console -- the server log is the only diagnostic channel`
on the line above it.

### Step 3: Carry the reason in `GameStateResult` (client)

In `app/hooks/use-game-state.ts`:

1. Add `error: string | null;` as the first field of `GameStateResult`.
2. Change `setUnavailable` to
   `(status: "missing" | "error", error: string | null = null)` and include
   `error` in the object it sets.
3. Add `error: null` to the cached-fallback object (`:80-87`) and to the
   success object (`:187-196`). In the 304 branch, add `error: null` to the
   returned object and add `&& current.error === null` to the early-return
   condition directly above it (`:130-135`). Add the same
   `&& current.error === null` to the success branch's early-return condition
   (`:179-185`).
4. Add this helper above `useGameState`:

   ```ts
   const readErrorMessage = async (response: Response): Promise<string | null> => {
     try {
       const body: unknown = await response.json();

       return typeof body === "object" && body !== null && "error" in body
         && typeof body.error === "string" && body.error.length > 0
         ? body.error.slice(0, 200)
         : null;
     } catch {
       return null;
     }
   };
   ```

5. Replace the 404 and `!response.ok` branches with:

   ```ts
   if (response.status === 404) {
     setUnavailable("missing", await readErrorMessage(response));
     return;
   }

   if (!response.ok) {
     setUnavailable("error", await readErrorMessage(response));
     return;
   }
   ```

   Leave the other `setUnavailable` calls unchanged (they default to `null`).

In `app/page.tsx`, add `error: null,` to the success object and
`error: result.error,` to the failure object.

**Verify**: `pnpm ts` → exit 0.

### Step 4: Show the reason in the existing status line

In `app/components/GameSyncStatus.tsx`:

1. Add `error: string | null;` to `Props` and destructure it.
2. Give `getStatusLabel` a fifth parameter `error: string | null` and change
   only its last line to `return error ?? "Game data unavailable";`. Put
   `if (status === "missing") return "Bridge unavailable";` — unchanged — above it.
3. Pass `error` in the `getStatusLabel(...)` call.
4. On the existing `<p role="status" …>` add two attributes:
   `title={isSyncing ? undefined : error ?? undefined}` and
   `data-game-sync-error={error ?? undefined}`.
5. The `<p>` has `whitespace-nowrap`. Do not change classes.

In `app/calculator.tsx`, add `error={gameState.error}` to the existing
`<GameSyncStatus>` element (keep props in alphabetical order — it goes first).

Result: with no snapshot at all, the line reads the server's sentence; with a
cached snapshot it still reads "Last sync · HH:MM:SS" and the sentence is the
element's `title` and `data-game-sync-error`.

**Verify**: `pnpm ts` → exit 0; `pnpm exec eslint .` → exit 0; `pnpm build` → exit 0.

## Test plan

- Two new tests in `app/server/read-game-state-snapshot.test.ts` (Steps 1–2).
- No component or hook render tests (repo rule quoted above).
- `pnpm exec vitest run app/server app/hooks` → all pass.

## Done criteria

- [ ] `grep -c "json().catch(() => null)" app/server/read-game-state-snapshot.ts` → `5`
- [ ] `grep -n "data-game-sync-error" app/components/GameSyncStatus.tsx` → one match
- [ ] `grep -n "error: result.error" app/page.tsx` → one match
- [ ] `pnpm ts`, `pnpm exec eslint .`, `pnpm build` exit 0
- [ ] `pnpm exec vitest run app/server app/hooks` passes with 2 new tests
- [ ] `git status --short` lists only the six in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The excerpts in "Current state" do not match the live code.
- `GameStateResult` is constructed somewhere not listed here and `pnpm ts`
  fails in a file outside the scope list.
- You find yourself adding a new element, component or CSS class.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `normalizeGameStateSnapshot` (`app/game-state.ts:1106`) still returns `null`
  for every kind of mismatch, so "old Bridge build" and "one malformed field"
  share the 422 sentence. Splitting those needs a reason-returning normalizer;
  deferred because that file is hashed into the calculation cache version and
  is consumed in many places.
- Any new failure path in the reader should go through `unavailable(...)` so it
  is logged and shown without further work.
- Reviewer: check that a successful poll clears `error` (Step 3 item 3), or a
  stale sentence would stick in the `title`.
