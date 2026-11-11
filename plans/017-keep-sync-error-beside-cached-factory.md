# Plan 017: Showing the cached factory no longer hides why the first sync failed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- app/hooks/use-game-state.ts app/hooks/use-game-state.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

When the page is opened while the game or its Bridge mod is unavailable, the
server renders a status of `missing` or `error` together with a sentence that
says why ("Enable CoI Calculator Bridge in the loaded game.", "Update CoI
Calculator Bridge…"). If the browser holds a cached factory from an earlier
visit, the page then swaps in that cached factory — and in doing so resets
the status to `loading` and discards the sentence. Normally the next poll,
a moment later, restores it. But polling is skipped while the tab is in the
background, so a tab opened in the background shows "loading" with no reason
for as long as it stays there. The reason should survive the swap.

## Current state

- `app/hooks/use-game-state.ts` — the client hook that owns sync state.
  Lines 11–19:

  ```ts
  export interface GameStateResult {
    error: string | null;
    exportedAtUtc: string | null;
    isFresh: boolean;
    revision: string | null;
    snapshot: GameStateSnapshot | null;
    source: GameStateDataSource;
    status: GameStateConnectionStatus;
  }
  ```

  `GameStateConnectionStatus` is `'loading' | 'available' | 'missing' | 'error'`
  and `GameStateDataSource` is `'live' | 'cached' | 'none'` (both from
  `app/game-state.ts`).

  Lines 138–154, inside the hook's effect:

  ```ts
      const cacheTimer = cachedSnapshot
        ? window.setTimeout(() => {
            if (!lifecycle.isActive) return;

            setResult(current => current.snapshot
              ? current
              : {
                  error: null,
                  exportedAtUtc: cachedSnapshot.exportedAtUtc,
                  isFresh: false,
                  revision: null,
                  snapshot: cachedSnapshot,
                  source: "cached",
                  status: "loading",
                });
          }, 0)
        : undefined;
  ```

  Lines 156–168 show that "failed status plus cached factory" is already a
  normal state after a failed poll:

  ```ts
      const setUnavailable = (status: "missing" | "error", error: string | null = null) => {
        if (!lifecycle.isActive) return;

        setResult(current => ({
          error,
          exportedAtUtc: current.exportedAtUtc,
          isFresh: false,
          revision: current.revision,
          snapshot: current.snapshot,
          source: current.snapshot ? "cached" : "none",
          status,
        }));
      };
  ```

- The file already exports two pure helpers for testing,
  `shouldPersistInitialSnapshot` and `createLatestWriter` (lines 30–70). It
  uses double quotes and semicolons.
- `app/hooks/use-game-state.test.ts` tests those helpers with plain `it` /
  `expect` from vitest, single quotes, no semicolons. Its first lines:

  ```ts
  import { expect, it, vi } from 'vitest'

  import { createLatestWriter, shouldPersistInitialSnapshot } from './use-game-state'

  const snapshot = (saveId: string | null, exportedAtUtc: string) => ({
    exportedAtUtc,
    saveId,
  })
  ```

- Product rule from the maintainer: no new UI elements. This plan changes
  which existing status and sentence are shown.
- Lint forbids `as` type assertions other than `as const`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Focused tests | `pnpm exec vitest run app/hooks` | all pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `app/hooks/use-game-state.ts`
- `app/hooks/use-game-state.test.ts`

**Out of scope** (do NOT touch):
- `app/components/GameSyncStatus.tsx` and every other component.
- The polling helper `app/helpers/game-state-polling/game-state-polling.ts`
  (background tabs skipping polls is intended).
- The rest of the effect in `use-game-state.ts`.

## Git workflow

- Branch: `advisor/017-keep-sync-error-beside-cached-factory`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Show the game sync failure reason in the status line`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the swap into a pure helper

In `app/hooks/use-game-state.ts`, directly above `export const useGameState`,
add:

```ts
/**
 * A cached factory fills in while live data is unavailable. It never replaces
 * live data, and it keeps the reason the server gave for a failed first sync.
 */
export const withCachedSnapshot = (
  current: GameStateResult,
  cachedSnapshot: GameStateSnapshot,
): GameStateResult => {
  if (current.snapshot) return current;
  const failed = current.status === "missing" || current.status === "error";

  return {
    error: failed ? current.error : null,
    exportedAtUtc: cachedSnapshot.exportedAtUtc,
    isFresh: false,
    revision: null,
    snapshot: cachedSnapshot,
    source: "cached",
    status: failed ? current.status : "loading",
  };
};
```

Then replace the `setResult(current => current.snapshot ? current : { … });`
call inside `cacheTimer` (lines 142–152) with:

```ts
          setResult(current => withCachedSnapshot(current, cachedSnapshot));
```

**Verify**: `pnpm ts` exits 0.

### Step 2: Test the helper

In `app/hooks/use-game-state.test.ts`, add `withCachedSnapshot` to the import
from `./use-game-state` and append the code below. (Test files in this
repository are not typechecked — `tsconfig.json` excludes them — so the
stand-in factory with only its identity fields is fine, exactly like the
existing `snapshot(...)` helper at the top of the file.)

```ts
// Only identity fields matter to the swap; a full snapshot is megabytes.
const cachedFactory = (exportedAtUtc: string) => ({ exportedAtUtc, saveId: 'save-a' })
const serverResult = (status: 'loading' | 'available' | 'missing' | 'error', error: string | null) => ({
  error, exportedAtUtc: null, isFresh: false, revision: null, snapshot: null, source: 'none', status,
})

it.each(['missing', 'error'] as const)('keeps a %s status and its reason when the cached factory is shown', status => {
  const cached = cachedFactory('2026-08-31T10:00:00Z')

  expect(withCachedSnapshot(serverResult(status, 'Enable CoI Calculator Bridge in the loaded game.'), cached)).toEqual({
    error: 'Enable CoI Calculator Bridge in the loaded game.', exportedAtUtc: '2026-08-31T10:00:00Z',
    isFresh: false, revision: null, snapshot: cached, source: 'cached', status,
  })
})

it('shows the cached factory as loading when nothing has failed yet', () => {
  const cached = cachedFactory('2026-08-31T10:00:00Z')

  expect(withCachedSnapshot(serverResult('loading', null), cached)).toMatchObject({ error: null, source: 'cached', status: 'loading' })
})

it('never replaces live data with the cached factory', () => {
  const live = {
    ...serverResult('available', null), snapshot: cachedFactory('2026-08-31T10:00:05Z'), source: 'live', revision: 'r1',
  }

  expect(withCachedSnapshot(live, cachedFactory('2026-08-31T10:00:00Z'))).toBe(live)
})
```

**Verify**: `pnpm exec vitest run app/hooks` → all pass, including 4 new cases.

### Step 3: Full checks

**Verify**: `pnpm ts`, `pnpm lint` and `pnpm build` exit 0.
`git grep -n 'status: "loading",' -- app/hooks/use-game-state.ts` prints
nothing (the literal now lives only inside the helper's conditional).

## Test plan

Four new cases in `app/hooks/use-game-state.test.ts`, modelled on the helper
tests already in that file: the reason and status survive for `missing` and
for `error`; a not-yet-failed state still shows `loading`; live data is
returned untouched.

## Done criteria

- [ ] `git grep -n "export const withCachedSnapshot" -- app/hooks/use-game-state.ts` → one match
- [ ] `git grep -n "withCachedSnapshot(current, cachedSnapshot)" -- app/hooks/use-game-state.ts` → one match
- [ ] `pnpm exec vitest run app/hooks` passes with 4 new cases
- [ ] `pnpm ts`, `pnpm lint`, `pnpm build` exit 0
- [ ] `git status --short` lists only the two in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Lines 138–154 of `app/hooks/use-game-state.ts` do not match the excerpt.
- `pnpm lint` rejects the test code as written. Report the rule and line; do
  not add an `as` assertion or a disable comment.
- Any existing test in `app/hooks` fails.

## Maintenance notes

- After this change a page opened while the game is down shows the cached
  factory with "Last sync · …" and the reason in the status line's tooltip,
  the same presentation a failed poll already produces.
- If a fifth connection status is ever added, decide explicitly whether
  `withCachedSnapshot` should preserve it.
