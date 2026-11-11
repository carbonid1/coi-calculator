# Plan 002: Next.js is patched and the calculator listens on localhost only

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7c0a656..HEAD -- package.json pnpm-lock.yaml README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW–MED (framework minor bump)
- **Depends on**: none (easier to trust after plans/001-add-ci-check-gate.md)
- **Category**: security
- **Planned at**: commit `7c0a656`, 2026-11-11

## Why this matters

The lockfile pins `next@16.2.3`. `pnpm audit --prod` at this commit reports 5
critical and about 18 high advisories against that version, including
GHSA-p293-qw3h-jr36 (unauthenticated remote code execution on Windows-hosted
servers; fixed in 16.3.3) and others fixed by 16.4.1. This tool runs on the
player's Windows gaming PC. On top of that, `next dev` and `next start` listen
on every network interface by default, so the server — and the factory data it
proxies from the game — is reachable from the whole local network. After this
plan the framework is patched and the server only answers on `127.0.0.1`.

## Current state

- `package.json`:

  ```json
  "scripts": {
    "dev": "next dev",
    ...
    "start": "next start",
  },
  "dependencies": {
    "next": "^16.1.0",
  ```

- `pnpm-lock.yaml` resolves `next@16.2.3` (search for `next@16.2.3:`).
- The newest release on the `latest` dist-tag on 2026-11-11 was `16.4.6`.
- The app uses no `next/image`, `next/og`, server actions, `use cache`,
  middleware or rewrites (`grep -rn "next/image\|next/og\|use cache\|use server" app` → no matches),
  so the upgrade surface is the App Router pages and four route handlers under
  `app/api/`.
- `next.config.ts` sets only `distDir` and one `env` value.
- `tests/browser.smoke.mjs:210` already starts the production server with
  `--hostname 127.0.0.1`, so the smoke test is unaffected by the script change.
- `README.md` tells the user to open `localhost:3000`.
- `pnpm-workspace.yaml` contains a `minimumReleaseAgeExclude` list. pnpm may
  refuse a release that is too new; that is expected — see Step 1.
- Baseline at `7c0a656`: `pnpm ts` exit 0, `pnpm exec eslint .` exit 0,
  `pnpm build` exit 0, `pnpm exec vitest run` 928/929 (one timeout at
  `tests/factory.smoke.test.ts:127`, unrelated to Next).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check) | `pnpm exec eslint .` | exit 0 |
| Tests | `pnpm exec vitest run` | same result as baseline |
| Build | `pnpm build` | exit 0 |
| Audit | `pnpm audit --prod` | no critical advisory for `next` |

## Scope

**In scope**:
- `package.json` (the `next` range and the `dev` / `start` scripts)
- `pnpm-lock.yaml` (only as rewritten by pnpm)
- `README.md` (one sentence, Step 3)

**Out of scope**:
- Any other dependency bump. `postcss`, `nanoid`, `sharp`, `browserslist` and
  `source-map-js` advisories are build-time or unused paths; leave them.
- `next.config.ts`, anything under `app/`, `tests/`.
- Adding middleware / `proxy.ts` Host-header checks — deferred.
- `pnpm-workspace.yaml`.

## Git workflow

- Branch: `advisor/002-upgrade-next-bind-localhost`
- Two commits: `Upgrade Next.js to a patched release`, then
  `Serve the calculator on localhost only`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Upgrade Next.js

Run `pnpm view next version` to read the current `latest`. It must be
`16.x` and at least `16.4.1`. Then run `pnpm add next@^<that version>`
(for example `pnpm add next@^16.4.6`).

If pnpm refuses the version because of the minimum release age, pick the
newest `16.4.x` version that pnpm accepts and that is ≥ `16.4.1`
(`pnpm view next versions --json` lists them). Do not edit
`pnpm-workspace.yaml` to get around it.

**Verify**: `grep -n "^  next@16" pnpm-lock.yaml` shows a version ≥ 16.4.1 and
no `next@16.2.3` line; `git diff --stat` touches only `package.json` and
`pnpm-lock.yaml`.

### Step 2: Run the checks

Run `pnpm ts`, `pnpm exec eslint .`, `pnpm exec vitest run`, `pnpm build`.

**Verify**: all exit 0 (the one known vitest timeout from "Current state" is
acceptable; any new failure is a STOP condition). Then
`pnpm audit --prod 2>&1 | grep -c "critical"` → `0` lines mentioning `next`
criticals (run `pnpm audit --prod --json` and confirm no advisory with
`"module_name": "next"` has `"severity": "critical"`).

### Step 3: Bind to localhost

In `package.json` change `"dev": "next dev"` to
`"dev": "next dev --hostname 127.0.0.1"` and `"start": "next start"` to
`"start": "next start --hostname 127.0.0.1"`.

In `README.md`, after the sentence ending "works while paused.", add this
sentence on its own paragraph:

```
The calculator listens on this computer only. To reach it from another device, run `pnpm exec next dev --hostname 0.0.0.0`.
```

**Verify**: start `pnpm dev` in the background, wait for the "Ready" line,
then `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/game-state`
→ prints an HTTP code (`200`, `404` or `503` are all fine — no game is
running). The startup banner must show `http://127.0.0.1:3000` and no
"Network:" line. Stop the server.

### Step 4 (only if the operator can run it): browser smoke

`node --test tests/browser.smoke.mjs` needs the agent-browser Chromium. If it
is available, run it and report the result. If it is not, say so in your
report; do not install browsers.

## Test plan

No new tests. The gates are the existing checks, the audit result and the
Step 3 banner check.

## Done criteria

- [ ] `pnpm-lock.yaml` resolves `next` to ≥ 16.4.1
- [ ] `pnpm audit --prod --json` has no critical advisory for module `next`
- [ ] `pnpm ts`, `pnpm exec eslint .`, `pnpm build` exit 0; vitest matches baseline
- [ ] `grep -c -- "--hostname 127.0.0.1" package.json` → `2`
- [ ] `git status --short` lists only `package.json`, `pnpm-lock.yaml`, `README.md` (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `latest` for `next` is no longer a 16.x release (a major upgrade is a
  different plan).
- `pnpm add` changes any dependency other than `next` and its own
  transitive packages in a way that alters `react`, `react-dom` or
  `@carbonid1/design-system` versions.
- `pnpm ts`, lint or `pnpm build` fails after the upgrade and the fix would
  require editing files under `app/`.
- New vitest failures compared with the baseline.

## Maintenance notes

- `scripts/calculation-version.ts` hashes `package.json`, so this change
  invalidates saved calculation results once. That is expected.
- Deferred: rejecting `/api/*` requests whose `Host` header is not
  localhost (protection against DNS rebinding from a web page). The routes
  are read-only, so this is low severity.
- Reviewer: check the lockfile diff contains only `next`, `@next/*` and
  their direct transitive changes.
