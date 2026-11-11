# Plan 014: The browser smoke drops work vitest already covers and no longer waits a minute for a poll

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- tests/browser.smoke.mjs`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (test-only)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

`tests/browser.smoke.mjs` drives the real app in a browser against a replayed
game. It is the only test of the page's wiring, error states, map layers and
saved choices, and this repository has no CI, so it only helps if people run
it. Today it takes about 263 seconds against a hard 300-second limit that
covers all of its subtests together; under any extra load the last subtests
are cancelled without having failed. About 90 seconds of that time buys
nothing:

- the first subtest re-checks, through three extra sync round-trips, checklist
  text that a faster test already asserts on the same recorded factory;
- one subtest ("returns Rock to deficits…") checks behaviour with no browser
  aspect that a unit test already covers for every reserve resource;
- one subtest waits up to a minute for the automatic poll when it could ask
  the page to sync.

This plan removes that time and adds one missing check: that the page's
server names an outdated Bridge correctly.

## Current state

`tests/browser.smoke.mjs` is one `node:test` test with ten subtests that share
one browser session and one mutable `state` object controlling the replayed
game. It uses single quotes and no semicolons, and contains non-ASCII
characters (`→`, `×`, `…`, `·`).

- Line 73–74, the parent test and the replay state:

  ```js
  test('recorded factory: browser → Next API → replayed game API → worker → UI', { timeout: 300_000 }, async t => {
    const state = { mode: 'live', powerMeter: false, inventoryBonus: 0, pausedPumps: false, mapMode: 'live', layoutMode: 'live', addedBuilding: false, officeCostBonus: 0, planningCostBonus: 0, emptyRock: false, limitedConnections: false, worldMining: false }
  ```

- Lines 150–151, inside the replayed snapshot reply:

  ```js
        storages: fixture.storages.map(storage => state.emptyRock && storage.product.productId === 'Product_Rock'
          ? { ...storage, quantity: 0 } : storage),
  ```

  (The reply starts with `...fixture`, so without these two lines `storages`
  is still sent, unchanged.)

- Lines 320–354, the tail of the first subtest
  (`keeps the live baseline preset, migrates completed plans and reminds us to resume research`):

  ```js
      state.stationCrewDisabled = true
      await click('Sync now')
      await browser('wait', '[aria-label="Sync now"]:not([disabled])')
      await ready()
      await expandChecklist()
      assert.match(await text(), /Unpause 2 Research Lab IV[\s\S]*Enable Space Station crew/)
      assert.doesNotMatch(await text(), /Build Space Station level 4/)
      assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-checklist-module]")).map(node => node.dataset.checklistModule)'), ['general', 'live-area-15'])
      await screenshot('baseline-research-reminders')
      state.stationCrewDisabled = false
      state.researchRunning = true
      await click('Sync now')
      await browser('wait', '[aria-label="Sync now"]:not([disabled])')
      await ready()
      assert.doesNotMatch(await text(), /Unpause 2 Research Lab IV|Enable Space Station crew/)
      assert.equal(await evaluate('document.querySelectorAll("[data-checklist-module]").length'), 0)
      state.stationCrewDisabled = true
      state.researchRunning = false
      await click('Sync now')
      await browser('wait', '[aria-label="Sync now"]:not([disabled])')
      await ready()
      await expandChecklist()
      assert.match(await text(), /Unpause 2 Research Lab IV[\s\S]*Enable Space Station crew/)
      await browser('set', 'viewport', '375', '900')
      assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
      await browser('click', '[aria-label="Factory preset"]')
      assert.equal(await evaluate('document.querySelectorAll("[role=option]").length'), 2)
      await screenshot('baseline-mobile')
      await browser('press', 'Escape')
      await browser('set', 'viewport', '1440', '1000')
      state.stationCrewDisabled = undefined
      state.researchRunning = undefined
      await click('Sync now')
      await browser('wait', '[aria-label="Sync now"]:not([disabled])')
      await ready()
    })
  ```

  The same three situations are asserted on the same recorded factory, without
  a browser, in `tests/factory.smoke.test.ts` (the test
  `uses the live factory with two running labs and station crew as the new baseline`):
  it expects exactly `'Unpause 2 Research Lab IV', 'Enable Space Station crew'`,
  then no changes, then `'Pause 1 Research Lab IV'`.

- Lines 678–691, the whole Rock subtest:

  ```js
    await t.test('returns Rock to deficits when its synced storage is empty', async () => {
      state.emptyRock = true
      await browser('reload')
      await ready()
      await browser('wait', '--fn', `Array.from(document.querySelectorAll('section')).find(section => section.querySelector('h4')?.textContent === 'Deficit / cycle')?.querySelector('[aria-label="Inspect Rock supply"]') != null`, '--timeout', '45000')
      const deficit = await evaluate(`Array.from(document.querySelectorAll('section')).find(section => section.querySelector('h4')?.textContent === 'Deficit / cycle').innerText`)

      assert.match(deficit, /Rock\s+No producer\s+-51\.85/)
      assert.equal(await evaluate(`document.querySelector('[aria-label="From storage"] [aria-label="Inspect Rock supply"]') === null`), true)
      state.emptyRock = false
      await browser('reload')
      await ready()
      await browser('wait', '[aria-label="From storage"] [aria-label="Inspect Rock supply"]')
    })
  ```

  The rule it checks — an empty reserve supplies nothing — is covered for every
  reserve resource by `app/db/modules/reserves.test.ts:86`,
  `does not supply $name when storage is empty or unavailable`, and the step
  from stored quantities to reserve balances by
  `app/helpers/reserves/resolve-reserve-balances.test.ts`. The stocked case
  stays covered in the browser: the navigation subtest asserts that Rock is
  listed under "From storage" and not under "Deficit / cycle".

- Lines 711–732, inside the subtest
  `keeps aquifer numbers, rows, selection, focus and scroll stable through live pump changes`:

  ```js
      state.inventoryBonus = 123
      state.pausedPumps = true
      state.addedBuilding = true
      state.officeCostBonus = 7
      state.planningCostBonus = 7
      const changed = await fetch(`${appUrl}/api/game-state`, { headers: { 'If-None-Match': etag } })

      assert.equal(changed.status, 200)
      assert.notEqual(changed.headers.get('etag'), etag)
      assert.equal((await changed.json()).products.inventory.Product_Gold.quantity, fixture.products.inventory.Product_Gold.quantity + 123)
      const newQuantity = fixture.products.inventory.Product_Gold.quantity + 123
      const receivedUpdate = `JSON.parse(localStorage.getItem('coi-game-state-last-valid-v1'))?.products.inventory.Product_Gold.quantity === ${newQuantity}`

      for (const attempt of [0, 1, 2, 3]) {
        try {
          await browser('wait', '--fn', receivedUpdate, '--timeout', '20000')
          break
        } catch (error) {
          if (attempt === 3) throw error
        }
      }
      await ready()
  ```

  Nothing triggers a sync here, so the loop waits for the page's automatic
  poll, which runs one minute after the previous sync
  (`REFRESH_INTERVAL_MS = 60_000` in
  `app/helpers/game-state-polling/game-state-polling.ts`). The "Sync now"
  button calls the same poll function with `force`. The assertions after
  `ready()` check that keyboard focus is still on an aquifer marker, so the
  sync must be triggered without moving focus.

- Lines 779–786, the start of the subtest
  `rejects missing native data, incompatible Bridges and mixed sessions, then recovers`:

  ```js
      for (const [mode, status] of [['old-bridge', 422], ['missing-weather', 422], /* … 12 more … */ ['offline', 502]]) {
        state.mode = mode
        const response = await fetch(`${appUrl}/api/game-state`)

        assert.equal(response.status, status, mode)
        assert.ok((await response.json()).error)
      }
  ```

  `/api/game-state` returns `{ error: <sentence> }`. Since plan 009 the
  sentence depends on the cause (`app/server/read-game-state-snapshot.ts`):
  a Bridge reply with an older schema version gives
  `'Update CoI Calculator Bridge for this version of the calculator.'`; a
  reply that fails any other check gives
  `'The calculator could not read this factory.'`. In this loop `old-bridge`
  sends an older schema version; every other mode with status 422 removes one
  required section.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Browser smoke | `node --test tests/browser.smoke.mjs` | all subtests pass; prints `duration_ms` |
| Reserve unit test | `pnpm exec vitest run app/db/modules/reserves.test.ts` | all pass |
| Lint (check only) | `pnpm lint` | exit 0 |

The browser smoke builds the app into `.next/smoke`, starts it on a free port,
and needs the Chromium that `agent-browser` installs. It takes four to five
minutes. Run nothing else heavy at the same time: the whole run shares one
300-second limit.

## Scope

**In scope**:
- `tests/browser.smoke.mjs`

**Out of scope** (do NOT touch):
- Anything under `app/`.
- The 300-second limit on line 73 — leave it; the point is to gain margin.
- Any other subtest, assertion, screenshot call or helper in the file.
- `tests/factory.smoke.test.ts` and `app/db/modules/reserves.test.ts` — they
  already hold the coverage this plan relies on.
- Splitting the file or making subtests independent of each other.

## Git workflow

- Branch: `advisor/014-trim-the-browser-smoke`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Stabilise test discovery and smoke test timeouts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

**Editing rule for every step**: the file contains non-ASCII characters. Edit
it with an editing tool that preserves encoding, never with a shell text
command that rewrites the file (PowerShell `Set-Content` corrupts it). After
each step, `git diff --stat` must show only the lines you meant to change.

### Step 1: Record the baseline

Run `pnpm exec vitest run app/db/modules/reserves.test.ts` and confirm the
case `does not supply Rock when storage is empty or unavailable` is among the
passing tests (run with `--reporter=verbose` to see names).

Run `node --test tests/browser.smoke.mjs` and note the final `duration_ms`
and each subtest's time. Call the total B.

**Verify**: the reserve test passes; the smoke run reports `fail 0`. On a
slow or busy machine the baseline can exceed the 300-second limit, in which
case the last subtest is reported as cancelled (`cancelled 2`) without any
assertion failing. That is acceptable for the baseline — it is the problem
this plan addresses. Use that run's total as B.

### Step 2: Drop two redundant sync round-trips from the first subtest

In the first subtest, delete these fourteen lines and nothing else (they are
lines 329–342 in "Current state": from `state.stationCrewDisabled = false`
through the second
`assert.match(await text(), /Unpause 2 Research Lab IV[\s\S]*Enable Space Station crew/)`):

```js
    state.stationCrewDisabled = false
    state.researchRunning = true
    await click('Sync now')
    await browser('wait', '[aria-label="Sync now"]:not([disabled])')
    await ready()
    assert.doesNotMatch(await text(), /Unpause 2 Research Lab IV|Enable Space Station crew/)
    assert.equal(await evaluate('document.querySelectorAll("[data-checklist-module]").length'), 0)
    state.stationCrewDisabled = true
    state.researchRunning = false
    await click('Sync now')
    await browser('wait', '[aria-label="Sync now"]:not([disabled])')
    await ready()
    await expandChecklist()
    assert.match(await text(), /Unpause 2 Research Lab IV[\s\S]*Enable Space Station crew/)
```

The line before them (`await screenshot('baseline-research-reminders')`) and
the line after them (`await browser('set', 'viewport', '375', '900')`) stay.
The first sync round-trip (crew disabled, checklist updates) and the final
reset stay.

**Verify**: `git diff --stat -- tests/browser.smoke.mjs` shows 14 deletions.

### Step 3: Remove the Rock subtest and its replay switch

1. Delete the whole subtest
   `returns Rock to deficits when its synced storage is empty` (lines 678–691
   in "Current state") and the blank line that follows it.
2. Delete the two `storages:` lines quoted in "Current state" (lines 150–151).
3. In the `state` object on line 74, remove `emptyRock: false, ` (keep the
   other properties in their order).

**Verify**: `git grep -n "emptyRock" -- tests/browser.smoke.mjs` prints
nothing. `git grep -c "await t.test(" -- tests/browser.smoke.mjs` prints `9`.

### Step 4: Ask the page to sync instead of waiting for the poll

In the aquifer subtest, directly above the line
`for (const attempt of [0, 1, 2, 3]) {` that follows `const receivedUpdate = …`
(the first of the two retry loops), insert:

```js
    // Same poll as the automatic one; a scripted click leaves keyboard focus on the map.
    await evaluate('document.querySelector("[aria-label=\\"Sync now\\"]").click()')
```

Do not use the file's `click(...)` helper here: it performs a real pointer
click, which would move focus and break the focus assertion further down.
Leave both retry loops as they are.

**Verify**: `git grep -n "a scripted click leaves keyboard focus" -- tests/browser.smoke.mjs` → one match.

### Step 5: Assert the sentence for an outdated Bridge

In the "rejects…" subtest, replace the last line of the loop body,

```js
      assert.ok((await response.json()).error)
```

with:

```js
      const { error } = await response.json()

      assert.ok(error, mode)
      if (mode === 'old-bridge') assert.equal(error, 'Update CoI Calculator Bridge for this version of the calculator.')
      else if (status === 422) assert.equal(error, 'The calculator could not read this factory.', mode)
```

**Verify**: `git grep -c "The calculator could not read this factory." -- tests/browser.smoke.mjs` prints `1`.

### Step 6: Run it

Run `node --test tests/browser.smoke.mjs` with nothing else heavy running.
Call the new total duration A.

**Verify**:
- `pass 10`, `fail 0`, `cancelled 0` (one parent test plus nine subtests).
- A is at least 50 000 ms lower than B.
- The aquifer subtest
  (`keeps aquifer numbers, rows, selection, focus and scroll stable…`) still
  passes. (It stays at about a minute: its second retry loop waits for the
  factory-layout map layer, which polls on its own 60-second timer in
  `app/hooks/use-map-layer.ts` and is not refreshed by "Sync now". Only an
  app change can shorten that.)
- `pnpm lint` exits 0.
- `git status --short` lists only `tests/browser.smoke.mjs`.

## Test plan

This plan only edits a test. The proof is the run in step 6 compared with the
baseline in step 1, plus the unit test named in step 1 that keeps covering the
removed Rock case.

## Done criteria

- [ ] `git grep -n "emptyRock" -- tests/browser.smoke.mjs` prints nothing
- [ ] `git grep -c "await t.test(" -- tests/browser.smoke.mjs` prints `9`
- [ ] `node --test tests/browser.smoke.mjs` reports `pass 10`, `fail 0`, `cancelled 0`
- [ ] Total duration is at least 50 s lower than the baseline measured in step 1
- [ ] `pnpm lint` exits 0
- [ ] `git diff --stat 29c10d9 -- app` shows no change from this plan
- [ ] `git status --short` lists only `tests/browser.smoke.mjs` (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise, and do not weaken or delete an
assertion to get a pass) if:

- Step 1's baseline run has a subtest that fails an assertion (`fail` above
  0). Report which; the file has a problem this plan does not address. A
  baseline that is only cancelled by the time limit is not a STOP condition.
- After step 4, any assertion after `await ready()` in the aquifer subtest
  fails — in particular `document.activeElement.dataset.aquiferId` or the
  `viewState()` comparison. That means the scripted sync changed focus, scroll
  or rows; report the expected and actual values and remove nothing.
- After step 5, a mode with status 422 returns a different sentence. Report
  the mode and the sentence received.
- After step 3, a later subtest fails that passed in step 1. Subtests share
  state; report which one and its first failing assertion.
- The browser cannot start (`agent-browser` has no Chromium). Report the
  error; do not install anything system-wide.
- A is not at least 50 s lower than B. Report both numbers and the
  per-subtest times.

## Maintenance notes

- Subtests still share one browser session and one `state` object, and each
  resets its switches only on its last lines, so one failure can cascade.
  Making them independent is a larger change, deliberately left out.
- The two retry loops in the aquifer subtest were written for the automatic
  poll and are now mostly idle; they are harmless and guard against a slow
  machine.
- If the checklist reminders ever stop being asserted in
  `tests/factory.smoke.test.ts`, restore the round-trips removed in step 2.
- Deferred: the first subtest's check that a stored retired preset falls back
  to Baseline has no faster equivalent; it stays in the browser.
