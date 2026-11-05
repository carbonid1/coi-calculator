# COI Calculator

## Timing

60s = 1 in-game month. Recipe rates "per 60s" = per in-game month.

## Reporting results

Never report in real-time hours — user can't map that to gameplay. Report in **production cycles** and **in-game years**.

- Bad: "18k stockpile lasts 100 hours"
- Good: "18k stockpile = N production cycles = M in-game years"

## UI direction

Keep the UI dense but clear. Prefer compact counts, learnable icons, consistent ordering and placement, and clear grouping. Assume regular use: users can learn recurring visual patterns. Use tooltips for occasional detail, with keyboard access to the same information. Keep repeated labels and explanatory text minimal; improve clarity through hierarchy, alignment, and removing duplication.

### UI copy

Do not narrate familiar game mechanics; show only calculated results, actionable state, and information the user explicitly requested.

Show durations in in-game years or months. Keep internal cycle counts out of player-facing duration labels.

## Game data

When updating database files, verify numerical values and mechanics against the current installed game or its live API for the targeted version. Keep necessary explanations with the implementation or regression tests.

Prefer current game/API evidence and code over historical notes. Do not add separate game-data audits, implementation plans, or mechanics documentation unless requested.

## Solver debugging

Prefer a small number of broad recorded-factory and browser smoke tests over isolated tests of rendering, formatting, or simple arithmetic. When adding smoke coverage, remove smaller tests it supersedes. Keep focused regressions for solver edge cases and data-boundary failures that the smoke scenarios do not cover.

For solver bugs, isolate the failure in a small regression test before experimenting with allocation changes, then verify the fix against a saved factory snapshot while checking that existing priorities still hold.

## Debugging tools

Prefer the project-pinned `agent-browser` for browser inspection and debugging, and `agent-desktop` for native app and OS inspection and debugging. Run them with `pnpm exec agent-browser` and `pnpm exec agent-desktop` to use the exact versions in this repository. Read the installed tools' help and bundled skills for current usage; use other tools when these do not support the required task.

## Data states

Only actionable values from a compatible game snapshot or a future plan receive state treatment.
Calculator-derived values remain neutral. Without a compatible snapshot, current-state calculations are unavailable.

- **Synced:** Use for current values read from a compatible game snapshot.
- **Planned:** Use for future changes that override synced values while exposing their projected resource pressure.
