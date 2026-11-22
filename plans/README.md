# Improve plans

All 20 plans are done.

## Plans

| Plan | Status | Implementation |
|---|---|---|
| [001 Add CI checks](001-add-ci-check-gate.md) | DONE, CI later retired | `5365995` |
| [002 Patch Next.js and bind to localhost](002-upgrade-next-bind-localhost.md) | DONE | `9ac42d8`, `5fa2986`, `5a229ab` |
| [003 Show the game sync failure](003-keep-sync-failure-reason.md) | DONE | `4246e91` |
| [004 Guard snapshot and pump storage writes](004-harden-browser-storage-writes.md) | DONE | `5a64265`, `0481eac` |
| [005 Stabilize test discovery and timeouts](005-stabilise-test-discovery-and-timeouts.md) | DONE | `2fab1bc` |
| [006 Fix the Keep ready toast separator](006-fix-keep-ready-toast-separator.md) | DONE | `d2a7c1a` |
| [007 Allocate module sources before global sources](007-allocate-module-sources-before-global-sources.md) | DONE | `622c6e3` |
| [008 Count shared retry shortfalls once](008-count-shared-retry-shortfall-once.md) | DONE | `bafce14` |
| [009 Name Bridge, calculator, and game version mismatches](009-name-the-snapshot-rejection-reason.md) | DONE | `77b5d40` |
| [010 Remove unused preference hooks](010-remove-dead-preference-hooks.md) | DONE | `203f6e1` |
| [011 Preserve pump assignments for missing areas](011-keep-hidden-pump-assignments.md) | DONE | `0f25459` |
| [012 Cover Next targets and appliance demand](012-cover-next-preset-production-targets.md) | DONE | `a59301d` |
| [013 Ignore worktrees and scratch output in ESLint](013-ignore-agent-worktrees-in-eslint.md) | DONE | `9a5d2dc` |
| [014 Trim browser smoke and manually sync the factory snapshot](014-trim-the-browser-smoke.md) | DONE | `89f952c` |
| [015 Normalize line endings](015-normalise-line-endings.md) | DONE | `4cc0cfc` |
| [016 Test map and layout parsers and data routes](016-test-map-layout-parsers-and-routes.md) | DONE | `e7ac74a` |
| [017 Keep the sync error beside cached data](017-keep-sync-error-beside-cached-factory.md) | DONE | `9a1b515` |
| [018 Remove unused exports](018-remove-unreferenced-exports.md) | DONE | `a8c73da` |
| [019 Report Bridge capture failures](019-bridge-reports-what-failed.md) | DONE | `78b3dc9` |
| [020 Guard Mine Storage Control settings startup](020-guard-mine-storage-settings-startup.md) | DONE | `91fd53c` |

Mark a plan `DONE` once the work is implemented and all required checks pass.
Use `IN PROGRESS` while verification is pending. Use `TODO` for work that
hasn't started and include a reason for `BLOCKED` or `REJECTED`.

## Planning decisions

- Run checks locally. GitHub CI was retired in `29c10d9`.
- Keep the existing UI. Configure settings in the game or through AI chat.
  Limit app changes to existing text, data attributes, logs, and stored data.
- Before proposing new work, check the previous findings, rejections, and
  execution notes with `git show 8587980:plans/README.md`.
