# CoI Calculator Exporter

Local, read-only Captain of Industry mod for the calculator in this repository.

Version 0.20 exports the loaded save's physical vehicle total, assigned vehicle
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
schema 13 adds Fuel Gas stored under the same eligibility rules, and schema 14
adds Rocket Assembly Depot and Rocket Launch Pad completed/running counts.
Schema 15 adds the current and highest achieved Space Station levels plus active
station-construction state, read directly from the installed game's orbit manager.
Schema 16 adds completed/running Data Centers, installed Basic Server Racks and
Water Chillers; Chicken Farm mode and population; and Greenhouse/Greenhouse II
crop schedules with fertility targets. These configuration values are sampled
from the loaded entities on every export, so in-game setting changes do not
depend on a building event.
Schema 17 starts the shared machine inventory with every completed Groundwater
Pump's stable entity ID, runtime prototype, pause state, custom title, and map
tile. Schema 18 adds every non-default vehicle zone containing the machine,
identified by its stable save-local ID and optional in-game name. Factory Total
can map a zone once to an abstract calculator module; all current and future
tracked machines inside that zone follow the mapping without per-machine names.
Exact module-name matches resolve automatically. A machine outside every
non-default zone is shown under Default, which the calculator assigns to
General. Overlapping mapped zones remain explicit conflicts rather than being
guessed.
Schema 19 adds one record per completed Greenhouse and Greenhouse II, including
its stable save-local entity ID, pause state, crop schedule, and fertility
target. The calculator uses these identities to layer planned configurations
over existing buildings without counting both the live and planned versions.
Schema 20 adds one record per completed Chicken Farm, including its stable
save-local entity ID, pause state, slaughtering mode, chicken population, and
vehicle-zone membership. The calculator assigns a farm to the `Chicken Farms`
module only through an exact `Chicken Farms` zone-name match. Plans may reuse an
unassigned physical farm, but keep the required zone assignment visible until
the game snapshot confirms it.
Schema 21 adds the loaded game's stable name so browser-owned vehicle-zone
mappings are isolated per save instead of reusing save-local zone IDs across
different games.
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

Tracked infrastructure currently includes Rocket Assembly Depots, Rocket Launch
Pads, Electric locomotive II, all four
electrified station module types, both ore sorting plants, Stacker towers, Train
depots, all three vehicle-depot tiers, and The Statue of Maintenance (Golden),
plus both solar-panel types. Train depots contribute their eight
assigned workers to calculator workforce demand; their intermittent 250 kW draw
is intentionally excluded. Vehicle depots contribute 6, 10, and 16 workers
respectively, with other activity-dependent costs excluded. Rocket infrastructure
contributes 160 and 30 workers per running building respectively; its production,
launch-input, power, and computing costs stay in the Space Station planning model.
Existing snapshots
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
