# COI Calculator

## Timing

60s = 1 in-game month. Recipe rates "per 60s" = per in-game month.

## Reporting results

Never report in real-time hours — user can't map that to gameplay. Report in **production cycles** and **in-game years**.

- Bad: "18k stockpile lasts 100 hours"
- Good: "18k stockpile = N production cycles = M in-game years"

## UI copy

Do not narrate familiar game mechanics; show only calculated results, actionable state, and information the user explicitly requested.

## Game data

When updating database files, verify numerical values and mechanics against the installed game files for the targeted game version. Log confirmed wiki discrepancies in `docs/WIKI-DISCREPANCIES.md`.

## Data states

Only actionable values from a compatible game snapshot or a future plan receive state treatment.
Calculator-derived values remain neutral. Without a compatible snapshot, current-state calculations are unavailable.

- **Synced:** Use for current values read from a compatible game snapshot.
- **Planned:** Use for future changes that override synced values while exposing their projected resource pressure.
