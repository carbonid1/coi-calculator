# Plan 004: Snapshot caching never blocks a poll, never leaves stale data, and a full storage cannot crash the page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7c0a656..HEAD -- app/hooks/use-game-state.ts app/hooks/use-game-state.test.ts app/calculator.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none. If plans/003-keep-sync-failure-reason.md landed first,
  `use-game-state.ts` line numbers have shifted; match by the quoted code.
- **Category**: bug
- **Planned at**: commit `7c0a656`, 2026-11-11

## Why this matters

On every poll that brings new game data (about once a minute) the browser
serialises the whole game snapshot and writes it to `localStorage`,
synchronously, in the middle of handling the response. A real mid-game save
(`tests/fixtures/factory.json.gz`) is 2.25 MB uncompressed, close to half of a
typical 5 MB origin quota. Three things go wrong:

1. The write runs before React is told about the new data, delaying the update.
2. When the snapshot outgrows the quota, `setItem` throws, the error is
   swallowed, and the **previous** snapshot stays in storage. On the next visit
   without the game, that older factory is shown as the last sync.
3. The quota is shared. The pump-zone assignment in `app/calculator.tsx` calls
   `localStorage.setItem` with no `try/catch` **inside a React state updater**;
   when storage is full that throw escapes into rendering and can take the
   whole calculator down (and updaters run twice under StrictMode).

After this plan: the snapshot write happens after the state update, during
idle time, with only the newest snapshot written; a failed write removes the
old entry; and the pump-zone save fails with the same toast the other saved
preferences use.

**Product constraint (from the maintainer): do not add new UI.** The only
visible change is one more use of the existing `toast.error(...)` pattern.

## Current state

- `app/hooks/use-game-state.ts` — client polling hook.

  ```ts
  // :20
  const GAME_STATE_CACHE_KEY = "coi-game-state-last-valid-v1";
  ```

  ```ts
  // :47-52
  const writeCachedSnapshot = (snapshot: GameStateSnapshot) => {
    try {
      window.localStorage.setItem(GAME_STATE_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
    }
  };
  ```

  ```ts
  // :68-73 (inside the effect) — initial server snapshot, already deferred
  const initialCacheWriteTimer = initialSnapshot
    && shouldPersistInitialSnapshot(initialSnapshot, cachedSnapshot)
    ? window.setTimeout(() => {
        if (lifecycle.isActive) writeCachedSnapshot(initialSnapshot);
      }, 0)
    : undefined;
  ```

  ```ts
  // :169-175 — the hot path
  const revision = response.headers.get("X-CoI-Snapshot-Revision")
    ?? snapshot.exportedAtUtc;
  const snapshotChanged = revisionRef.current !== revision;

  revisionRef.current = revision;
  if (snapshotChanged) writeCachedSnapshot(snapshot);
  if (lifecycle.isActive) {
  ```

  The effect's cleanup is at `:215-222` and clears `initialCacheWriteTimer`
  and `cacheTimer`.

- `app/hooks/use-game-state.test.ts` — tests only the exported pure function
  `shouldPersistInitialSnapshot`, in this style:

  ```ts
  import { expect, it } from 'vitest'

  import { shouldPersistInitialSnapshot } from './use-game-state'

  it('skips rewriting the current browser fallback', () => {
    const current = snapshot('save-a', '2026-08-31T10:00:05Z')

    expect(shouldPersistInitialSnapshot(current, current)).toBe(false)
  })
  ```

  Vitest runs in the default Node environment (there is no vitest config and
  no jsdom), so tests cannot touch `window`. Test pure functions with injected
  dependencies.

- `app/calculator.tsx:207-221` — the unguarded write:

  ```ts
  const assignMachineZone = (zoneId: number, claimId: string | null) => {
    setMachineZoneAssignments(current => {
      const next = { ...current }

      if (claimId) {
        next[zoneId] = claimId
      } else {
        delete next[zoneId]
      }

      if (machineZoneAssignmentsStorageKey) {
        window.localStorage.setItem(machineZoneAssignmentsStorageKey, JSON.stringify(next))
      }
      return next
    })
  }
  ```

  `machineZoneAssignments` (state, `:125`) holds the current value.
  `toast` is already imported at `:3` from `@carbonid1/design-system`.

- The pattern to match for a guarded save — `app/hooks/use-operating-preferences.ts:35-47`:

  ```ts
  const setFullThrottle = (sourceId: string, enabled: boolean) => {
    if (!key) return false
    // Keep choices while a setup is paused, absent, or reassigned.
    const next = { ...read(key), [sourceId]: enabled }

    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return false
    }
    setSaved(current => ({ ...current, [key]: next }))
    return true
  }
  ```

  and the existing failure toasts in `app/calculator.tsx`, e.g. `:276`:
  `toast.error('Could not save preset. Check browser storage and try again.')`.

- `tests/browser.smoke.mjs:722` waits (up to 20 s, four attempts) for
  `localStorage.getItem('coi-game-state-last-valid-v1')` to contain updated
  data. The storage key and JSON format must therefore stay exactly as they
  are; a short delay before the write is fine.

- Formatting: `use-game-state.ts` uses double quotes and semicolons;
  `calculator.tsx` and the test file use single quotes and no semicolons.
  Match each file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check) | `pnpm exec eslint .` | exit 0 |
| Focused tests | `pnpm exec vitest run app/hooks` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `app/hooks/use-game-state.ts`
- `app/hooks/use-game-state.test.ts`
- `app/calculator.tsx` (the `assignMachineZone` function only)

**Out of scope**:
- Moving the snapshot cache to IndexedDB — deferred (see Maintenance notes).
- The storage key name and the stored JSON shape.
- The other preference hooks (`use-operating-preferences.ts`,
  `use-resource-priorities.ts`, `use-keep-ready-preferences.ts`,
  `use-factory-preset.ts`) — they are already guarded.
- `tests/browser.smoke.mjs`.
- Any other part of `app/calculator.tsx`.

## Git workflow

- Branch: `advisor/004-harden-browser-storage-writes`
- Two commits, imperative sentence case, e.g.
  `Write the snapshot fallback in idle time and drop it when it cannot be saved`
  and `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a "latest value, written later" helper with tests

In `app/hooks/use-game-state.ts`, below `shouldPersistInitialSnapshot`, add and
export:

```ts
/**
 * Coalesce writes: only the newest value is written, after the caller's
 * current work. `defer` returns its own cancel function.
 */
export const createLatestWriter = <Value,>(
  write: (value: Value) => void,
  defer: (run: () => void) => () => void,
) => {
  const state: { pending: { value: Value } | null; cancel: (() => void) | null } = {
    pending: null,
    cancel: null,
  };

  return {
    schedule: (value: Value) => {
      state.pending = { value };
      if (state.cancel) return;
      state.cancel = defer(() => {
        const { pending } = state;

        state.cancel = null;
        state.pending = null;
        if (pending) write(pending.value);
      });
    },
    dispose: () => {
      state.cancel?.();
      state.cancel = null;
      state.pending = null;
    },
  };
};
```

(This file is `.ts`, not `.tsx`; if the trailing comma in `<Value,>` is
rejected by lint, write `<Value>`.)

Add tests to `app/hooks/use-game-state.test.ts` using a hand-made `defer` that
stores the callback in an array so the test can run it:

1. `schedule('a')` then `schedule('b')`, run the one stored callback →
   `write` called once with `'b'`; `defer` was called once.
2. After that callback ran, `schedule('c')` calls `defer` a second time.
3. `schedule('a')` then `dispose()` → the cancel function returned by `defer`
   was called, and running the stored callback anyway does not call `write`.

Use `vi.fn()` for `write` and the cancel function (`import { expect, it, vi } from 'vitest'`).

**Verify**: `pnpm exec vitest run app/hooks/use-game-state.test.ts` → all pass, 3 new tests.

### Step 2: Drop the stale entry when a write fails

Change `writeCachedSnapshot` to:

```ts
const writeCachedSnapshot = (snapshot: GameStateSnapshot) => {
  try {
    window.localStorage.setItem(GAME_STATE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // An older factory must never outlive a snapshot that could not be saved.
    try {
      window.localStorage.removeItem(GAME_STATE_CACHE_KEY);
    } catch {
    }
  }
};
```

**Verify**: `pnpm ts` → exit 0; `grep -n "removeItem(GAME_STATE_CACHE_KEY)" app/hooks/use-game-state.ts` → one match.

### Step 3: Move the per-poll write off the response path

Add above `useGameState`:

```ts
const deferUntilIdle = (run: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 5_000 });

    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1_000);

  return () => window.clearTimeout(handle);
};
```

Inside the effect, right after `const lifecycle = { isActive: true };`, create
`const cacheWriter = createLatestWriter(writeCachedSnapshot, deferUntilIdle);`.

In `refresh`, remove the line `if (snapshotChanged) writeCachedSnapshot(snapshot);`
and instead schedule the write **after** the `setResult(...)` call of the
success branch, still inside `if (lifecycle.isActive) { … }`:

```ts
if (snapshotChanged) cacheWriter.schedule(snapshot);
```

In the effect cleanup, add `cacheWriter.dispose();`.

Leave the initial-snapshot write (`initialCacheWriteTimer`) as it is.

**Verify**: `pnpm ts` → exit 0; `pnpm exec eslint .` → exit 0;
`grep -c "writeCachedSnapshot(" app/hooks/use-game-state.ts` → `1` (only the
initial-snapshot timer calls it directly; the writer receives it by reference).

### Step 4: Guard the pump-zone save

Replace `assignMachineZone` in `app/calculator.tsx` with:

```ts
const assignMachineZone = (zoneId: number, claimId: string | null) => {
  const next = { ...machineZoneAssignments }

  if (claimId) {
    next[zoneId] = claimId
  } else {
    delete next[zoneId]
  }

  if (machineZoneAssignmentsStorageKey) {
    try {
      window.localStorage.setItem(machineZoneAssignmentsStorageKey, JSON.stringify(next))
    } catch {
      toast.error('Could not save pump assignment. Check browser storage and try again.')
      return
    }
  }
  setMachineZoneAssignments(next)
}
```

**Verify**: `pnpm ts` → exit 0; `pnpm exec eslint .` → exit 0;
`grep -n "setMachineZoneAssignments(current" app/calculator.tsx` → no matches.

### Step 5: Full check

Run `pnpm exec vitest run app/hooks`, `pnpm ts`, `pnpm exec eslint .`, `pnpm build`.
If the agent-browser Chromium is available, also run
`node --test tests/browser.smoke.mjs` and report the result; if not, say so.

**Verify**: all exit 0.

## Test plan

- Three new unit tests for `createLatestWriter` (Step 1), in
  `app/hooks/use-game-state.test.ts`, following that file's existing style.
- No render tests (repo rule in AGENTS.md: prefer broad smoke tests over
  isolated rendering tests). The browser smoke already asserts that the cached
  snapshot is updated after a poll.

## Done criteria

- [ ] `pnpm exec vitest run app/hooks` passes with 3 new tests
- [ ] `grep -n "removeItem(GAME_STATE_CACHE_KEY)" app/hooks/use-game-state.ts` → one match
- [ ] `grep -n "cacheWriter.dispose()" app/hooks/use-game-state.ts` → one match
- [ ] `grep -n "setMachineZoneAssignments(current" app/calculator.tsx` → no matches
- [ ] `pnpm ts`, `pnpm exec eslint .`, `pnpm build` exit 0
- [ ] `git status --short` lists only the three in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The quoted code is not found (after allowing for plan 003's added lines).
- `assignMachineZone` is called from somewhere that relies on two calls in the
  same render batching together (search `assignMachineZone` and
  `onAssignMachineZone`; at planning time the only caller is a click handler
  in `app/components/PlannedBuildsView.tsx:353`).
- The browser smoke test fails at the `receivedUpdate` wait
  (`tests/browser.smoke.mjs:722-730`) — report it; do not edit the smoke test.
- Lint rejects `window.requestIdleCallback` typing or usage and the fix needs a
  new dependency or a global type declaration file.

## Maintenance notes

- This plan makes the write harmless to the poll and removes the staleness and
  crash paths; it does **not** shrink the cache. The snapshot still takes
  roughly half the `localStorage` quota. The durable fix is moving it to
  IndexedDB (the calculation worker already has a store, see
  `app/helpers/factory-calculation/factory-calculation-cache.ts`), which needs
  an async read on mount and a change to `tests/browser.smoke.mjs:722`.
  Deferred deliberately.
- Per-save preference keys (`…:<saveId>`) are never removed. If saves pile up,
  that is the next thing to fill the quota.
- Reviewer: confirm the write is scheduled after `setResult`, and that the
  cleanup disposes the writer so an unmounted page does not write.
