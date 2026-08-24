# CoI Calculator Exporter

Local, read-only Captain of Industry mod for the calculator in this repository.

Version 0.12 exports the loaded save's physical vehicle total, assigned vehicle
workers, vehicle categories, vehicle quota, and completed/running counts for
the calculator's tracked entities to `coi-calculator-state.json` in the
installed mod folder. It also exports up to 120 completed in-game months of
actual Maintenance I/II/III consumption, Hydrogen fuel use by category, and
average electricity generation by producer prototype. Train traffic health is
derived from the game's explicit track-waiting states and reservation wait time.
Running means completed and not manually paused.

The exporter also supplies completed levels for the calculator's 18 repeatable
research categories and selected/active levels for its 19 modeled edicts. An
edict selected in the game but prevented from running retains its inactivity
reason; calculator effects use only the active level.

Schema 10 and newer export the actual Gold quantity in completed standalone storage;
schema 13 adds Fuel Gas stored under the same eligibility rules.
Storage connected to a train station and storage with an assigned incoming truck
route are excluded, so dedicated import buffers are not treated as freely
available reserves. Older cached snapshots remain valid but report reserves as
unavailable rather than as a fabricated zero.

A train counts as stuck after waiting for track clearance for at least one
production cycle (one in-game month). The calculator shows a warning for any
sustained wait and a red alert once the count reaches both three trains and 10%
of the active train fleet. Brief signal waits do not trigger an alert.
The calculator reads that file locally; the mod does not open a port or modify
gameplay state. Captain of Industry may still record the enabled mod in save
metadata; the manifest explicitly allows the mod to be removed again.

Tracked infrastructure currently includes Electric locomotive II, all four
electrified station module types, both ore sorting plants, Stacker towers, Train
depots, all three vehicle-depot tiers, and The Statue of Maintenance (Golden),
plus both solar-panel types. Train depots contribute their eight
assigned workers to calculator workforce demand; their intermittent 250 kW draw
is intentionally excluded. Vehicle depots contribute 6, 10, and 16 workers
respectively, with other activity-dependent costs excluded. Existing snapshots
remain readable across additive exporter updates; without any synced snapshot,
calculator-owned counts start at zero.

The rolling data excludes the current partial month. The calculator uses the
available completed history—up to 10 in-game years. A series with no completed
history does not contribute demand or generation to the calculator.

Build from the repository root:

```powershell
.\scripts\build-game-mod.ps1
```

Build and install to `%APPDATA%\Captain of Industry\Mods\CoiCalculatorExporter`:

```powershell
.\scripts\build-game-mod.ps1 -Install
```
