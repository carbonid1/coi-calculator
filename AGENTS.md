# COI Calculator

## Timing

60s = 1 in-game month. Recipe rates "per 60s" = per in-game month.

## Reporting results

Never report in real-time hours — user can't map that to gameplay. Report in **production cycles** and **in-game years**.

- Bad: "18k stockpile lasts 100 hours"
- Good: "18k stockpile = N production cycles = M in-game years"

## Game data

When updating database files, verify numerical values and mechanics against the installed game files for the targeted game version. Log confirmed wiki discrepancies in `docs/WIKI-DISCREPANCIES.md`.

## Data states

These states identify where an actionable value or setting comes from and determine its UI treatment.

- **Modeled:** Use for calculator-owned assumptions or manually configured current values.
- **Synced:** Use for current values read from a compatible game snapshot.
- **Planned:** Use for future changes that override modeled and synced values while exposing their projected resource pressure.
