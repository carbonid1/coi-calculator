# CoI Calculator Exporter

Local, read-only Captain of Industry mod for the calculator in this repository.

Version 0.32 exports assigned vehicle workers and completed/running counts for
the calculator's tracked entities to `coi-calculator-state.json` in the installed
mod folder. It also exports up to 120 completed in-game months of actual
Maintenance I/II/III consumption, Hydrogen fuel use by category, and average
electricity generation by producer prototype. Running means completed and not
manually paused.

The exporter also supplies completed levels for the calculator's 18 repeatable
research categories and selected/active levels for its 19 modeled edicts. An
edict selected in the game but prevented from running retains its inactivity
reason; calculator effects use only the active level.

Schema 10 and newer export the actual Gold quantity in completed standalone storage;
schema 13 adds Fuel Gas stored under the same eligibility rules, and schema 14
adds Rocket Assembly Depot and Rocket Launch Pad completed/running counts.
Schema 15 adds the current and highest achieved Space Station levels.
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
non-default zone is shown under the calculator's Default area. Overlapping
mapped zones remain explicit conflicts rather than being guessed.
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
Schema 22 adds stable, recipe-aware identities for the production buildings
currently modeled by the Nuclear module. Each entity includes its pause state,
assigned game recipe IDs, and vehicle-zone membership. Fast Breeder Reactors
also include their enrichment step and configured target power. The calculator
binds only entities inside the exact `Nuclear` area, so those physical buildings
replace modeled current capacity without being counted a second time. The
payload itself is module-neutral and can be extended to more building types.
Schema 23 adds stable Data Center and Water Chiller identities, vehicle-zone
membership, and each Data Center's installed Basic Server Rack count. The
calculator binds these entities only through an exact `Computing` area-name
match; schema 22 and older continue to use the global computing totals.
Schema 24 adds the named vehicle-zone catalog, zone membership to Greenhouse
identities, and stable identities for the already tracked rocket, solar, and
stationary infrastructure buildings. The calculator assigns stationary
infrastructure to its exact module-name area and leaves unzoned or ambiguous
buildings in Default. Unzoned and unmatched solar panels also belong to Default.
Moving vehicles and locomotives remain global rather than being assigned by
their transient position.
Schema 25 exports completed production, worker, and settlement entities that
overlap any named vehicle area. Tracks, transports, and storage remain out of
the generic payload. The calculator still decides which prototypes belong to
each module, so an overlapping building is not reassigned merely because it
appears in an area. This removes the exporter allow-list from most future area
and building sync work.
Schema 26 adds each Groundwater Pump's physical aquifer identity, current
quantity, capacity, and configured capacity. It also exports the live depleted
pump speed and dry emergency-replenishment settings. The calculator combines
these synced values with the installed v0.8.7 rain-recharge rule and planning
weather, caps the steady-state Water output of pumps sharing an aquifer, and
does not count one aquifer's recharge once per calculator module.
Schema 27 adds stable, recipe-aware identities for all four Maintenance Depot
tiers, including pause state and area membership. Unzoned depots belong to the
game's immutable Default area; exact named-area matches move with that area.
Schema 28 adds every completed building and construction ghost inside a named
vehicle area, including its construction state, game-localized prototype name,
tile, zone membership, and machine-effective recipe duration and quantities.
The calculator creates a planning-only tab for each unmatched named area as soon
as the area exists. Completed buildings and construction ghosts remain Synced;
ghosts are projected as future capacity. A ghost with one available recipe is projected automatically,
while a multi-recipe machine stays visible as needing configuration until the
game exposes an assigned recipe. Removing the ghost removes that planned
capacity on the next snapshot.
Schema 29 adds each electrified train-station module's selected product and
loading direction. The calculator uses those values to label and group station
cards inside their assigned area; it does not yet treat stations as material
producers or consumers.
Schema 30 adds completed and running counts for Captain's Office I and II. The
calculator assigns their workforce to an exact matching area, with unzoned or
ambiguous offices remaining in Default. Schema 29 and older snapshots normalize
these unavailable counts to zero.
Schema 31 adds mine-tower-to-sorter assignments plus each sorter's configured
terrain products, effective focus-adjusted throughput, and conversion loss.
The calculator shares sorter capacity across configured mineable resources. Dirt,
Slag, and Waste do not provide mine supply. Rock provides supply only when no
other mineable resource is selected. Mine towers establish terrain provenance;
assigned trucks, excavators, and train stations do not set throughput.
Storage connected to a train station and storage with an assigned incoming truck
route are excluded, so dedicated import buffers are not treated as freely
available reserves. Older cached snapshots remain valid but report reserves as
unavailable rather than as a fabricated zero.
Schema 32 keeps assigned vehicle workers and retires vehicle totals, categories,
quota, Space Station construction state, and train traffic. Use Train Network
Monitor for train capacity and jam alerts.

The calculator reads that file locally; the mod does not open a port or modify
gameplay state. Captain of Industry may still record the enabled mod in save
metadata; the manifest explicitly allows the mod to be removed again.

Tracked infrastructure currently includes Rocket Assembly Depots, Rocket Launch
Pads, Electric locomotive II, all four
electrified station module types, both ore sorting plants, Stacker towers, Train
depots, all three vehicle-depot tiers, Captain's Office I and II, and The Statue of Maintenance (Golden),
plus both solar-panel types. Train depots contribute their eight
assigned workers to calculator workforce demand; their intermittent 250 kW draw
is intentionally excluded. Vehicle depots contribute 6, 10, and 16 workers
respectively. Captain's Office I and II contribute 8 and 24 workers; their
100 kW and 250 kW electricity draws are excluded with other activity-dependent
infrastructure costs. Rocket infrastructure
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
