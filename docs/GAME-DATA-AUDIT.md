# Installed game-data audit

Target: Captain of Industry v0.8.7 installed under Steam. All rates below are
normalized to one 60-second production cycle.

## Synced reserve resources

The installed v0.8.7 assemblies define Fuel Gas as `Ids.Products.FuelGas`
with prototype ID `Product_FuelGas`. Fluid storage uses `FluidStorageProto`,
which derives from `StorageProto` and is represented by the same `Storage`
entity used by the existing Gold reserve scan. Eligible Fuel Gas therefore
uses the same exclusions as Gold: train-linked storage and storage with an
assigned incoming truck route are not counted as freely available reserves.

## Research efficiency

Research efficiency bonuses are additive on top of the base 100% output. The
current non-space plan combines Research Efficiency V (+60%) with planned
population. Population contributes
`trunc((population * 5 + 500) / 1000)%`; at 3,168 residents this is +16%.
Combined research output is therefore 176% of the base lab output. The disabled
Space Station IV planning module would add another 25% when activated.

Verified in installed v0.8.7 `SettlementsManager`, `SpaceStation`,
`SpaceStationProto`, `EdictsData`, `PropertiesData`, and `ResearchLab`.

## Space-station Rocket II logistics

The station plan amortizes only recurring Rocket II logistics. Space-station,
assembly-depot, and launch-pad construction costs are deliberately excluded.

- Rocket II takes 6 production cycles to assemble and carries 120 cargo or 12
  crew before research.
- Rockets Capacity level 1 adds 5%, raising this to 126 cargo and 13 crew.
- Each rocket costs 480 Composite Panels, 120 Titanium Alloy, 80 Steel, and 16
  Electronics III. The Composite Panel recipe expands the 480 panels into 480
  Aluminum, 60 Steel, and 120 Plastic.
- Each launch consumes 320 Hydrogen, 90 Oxygen, and 160 Water.
- One rocket carries only one cargo product. Level 4 consumes 1 Station Part,
  1.2 Crew Supplies, and 4 Electronics IV per cycle, so cargo launches average
  `6.2 / 126 = 0.0492063` per cycle.
- Six crew fit in one Rocket II and rotate every 24 cycles, adding `1 / 24 =
0.0416667` launches per cycle.
- Total steady-state traffic is therefore `0.0908730` launches per cycle: one
  launch every 11.0044 cycles, or about 0.9170 in-game years. The assembly depot
  averages 54.5238% of its build capacity.

This yields 43.6190 Aluminum, 10.9048 Titanium Alloy, 12.7222 Steel, 10.9048
Plastic, 1.4540 Electronics III, 29.0794 Hydrogen, 8.1786 Oxygen, and 14.5397
Water per production cycle.

Verified in installed v0.8.7 `RocketsData`, `Costs.Rockets`, `AssemblyData`,
`RocketProto`, `RocketEntity`, `RocketLaunchPadData`, `RocketLaunchPad`,
`SpaceStationProto`, and `SpaceStation`.

## World-map mines and oil rigs

The dormant world-mine database contains every installed `WorldMapMineProto`.
The three oil-rig prototype IDs have identical production data and share one
calculator definition. Repaired sites start at mine level II, upgrades add two
levels, and the active production level can be set from zero through the site's
current mine level.

| Site             | Base output at production level I | Max production level | Max base output |      Base reserve |
| ---------------- | --------------------------------: | -------------------: | --------------: | ----------------: |
| Oil rig          |                      30 Crude Oil |                   16 |             480 | 1,000,000 per rig |
| Groundwater well |                          48 Water |                    8 |             384 |         Unlimited |
| Sulfur mine      |                         54 Sulfur |                    8 |             432 |         Unlimited |
| Coal mine        |                           48 Coal |                   24 |           1,152 |         1,500,000 |
| Quartz mine      |                         36 Quartz |                   20 |             720 |         1,000,000 |
| Uranium mine     |                    36 Uranium Ore |                   20 |             720 |           800,000 |
| Rock mine        |                           36 Rock |                   32 |           1,152 |         Unlimited |
| Limestone quarry |                      24 Limestone |                   16 |             384 |           500,000 |
| Bauxite quarry   |                        36 Bauxite |                   24 |             864 |           750,000 |

The database also records Unity and workers per active production level. It
deliberately excludes Maintenance I because the calculator uses actual rolling
maintenance consumption from a compatible game snapshot. Without completed
history, the calculator does not inject maintenance demand.
Base reserves are before the game-difficulty reserve multiplier.

World Mine Output research adds 2% bonus output per research level. The runtime
accumulates fractional bonuses until a whole unit can be produced and charges
finite reserves only for base output. Because the Groundwater well uses the
same `WorldMapMine` runtime, it receives the bonus too despite the research
description mentioning only mines and oil rigs.

Verified in installed v0.8.7 `WorldMapEntitiesData`, `WorldMapMineProto`, and
`WorldMapMine.SimUpdateInternal`.

## Cargo contracts

The active Uranium size-4 cargo plan has one ship and four occupied large
modules: two Unit Module (L) exports and two Loose Module (L) imports.

- Cargo Ship T2: 22 workers.
- Each large cargo module: 5 workers, for 42 workers total.
- Each onboard large cargo module holds 800 units. Two import modules therefore
  carry 1,600 Uranium Ore per trip. The shore module's 1,600 storage capacity is
  not a shipload.
- Base trip fuel is `90 + 60 × occupied modules`.
- Hydrogen applies the game's 125% diesel-energy ratio, with each prototype
  quantity rounded: `90 → 113` and `60 → 75`.
- Repeatable Ship Fuel Use research reduces the loaded ship total by 1% per
  level. The quantity is rounded after this multiplier.
- Save Fuel then applies 70% and rounds again, so the level-zero plan uses
  `round((113 + 75 × 4) × 0.70) = 289 Hydrogen` per trip.
- At 54 Uranium Ore per cycle, average ship fuel is
  `54 / 1,600 × 289 = 9.75375 Hydrogen` per cycle.
- The current save reports a 427-second round trip with Save Fuel enabled,
  equal to `427 / 60 = 7.1167` production cycles. One 1,600-unit shipload per
  trip therefore caps the route at `1,600 / 7.1167 = 224.8244 Uranium Ore`
  per cycle before any loading, unloading, or cargo-waiting delays.

The calculator displays the average ship fuel and maximum import rate on the
contract card. Factory Hydrogen demand uses the synced rolling total fuel history
when available, so contract fuel is not added a second time. Without completed
fuel history, the calculator does not inject a Hydrogen fuel demand.

The observed round-trip value also limits the calculator's effective Uranium
imports. Fixed or demand-balanced requests above 224.8244 per cycle remain
visible as uncovered demand instead of creating impossible contract throughput.
Unmeasured routes remain uncapped unless an explicit conservative planning
estimate is documented; the calculator does not infer save-specific map travel
times.

The active Iron Ore plan uses a size-4 ship with two Unit Modules (L) for
Vehicle Parts II export and two Loose Modules (L) for Iron Ore import.

The supporting Vehicle Parts chain uses one active Assembly V for each tier.
Installed v0.8.7 data gives these full-load rates per production cycle:

- Vehicle Parts I: 96 Mechanical Parts + 32 Electronics I -> 64 Vehicle Parts I.
- Vehicle Parts II: 32 Vehicle Parts I + 16 Steel + 8 Glass -> 16 Vehicle Parts II.

- Cargo Ship size 4: 22 workers; the four large modules add 20 workers.
- Two import sections carry 1,600 Iron Ore per trip.
- The current save reports a 426-second round trip with Save Fuel enabled,
  capping the route at `1,600 / (426 / 60) = 225.3521 Iron Ore` per cycle
  before loading, unloading, or cargo-waiting delays.
- Save Fuel costs 289 Hydrogen per trip at level zero.
- Its shipment rate is demand-balanced. The calculator iterates the import and
  corresponding Vehicle Parts II export demand until the remaining map-mine
  requirement and Iron Ore surplus both reach zero.
- With the audit's base modifiers, 92.971225 Iron Ore per cycle requires 6.6408
  Vehicle Parts II and averages 16.7929 Hydrogen per cycle. Active recycling
  and other runtime modifiers can reduce that rate.

The active Food Pack -> Ammonia plan uses the same size-4 layout: two Unit
Module (L) exports and two Fluid Module (L) imports. It is demand-balanced, and
the local Chemical Plant II Ammonia recipe plus its Nitrogen Air Separator are
paused. Until this route is measured in the current save, its throughput limit
uses the measured 427-second Uranium trip as a conservative proxy, capping the
route at 224.8244 Ammonia per cycle.

The active Medical Supplies III -> Copper Ore plan uses the same size-4 layout:
two Unit Module (L) exports and two Loose Module (L) imports. Its shipment rate
is demand-balanced, so the Copper Ore map mine is paused once the contract
covers current consumption. Until this route is measured in the current save,
its throughput limit uses the measured 426-second Iron Ore trip as a conservative
proxy, capping the route at 225.3521 Copper Ore per cycle. With the audit's
synced factory history, current demand is 154.9652 Copper Ore per cycle. That
requires 23.8408 Medical Supplies III and averages 27.9906 Hydrogen per cycle.

Medical Supplies III and the Household Appliances alternative both exchange 10
export goods for 65 Copper Ore, but Medical Supplies III has the lower fixed
Unity cost (0.2 rather than 0.3).

- Producing the 153.8462 Household Appliances needed per 1,000 Copper Ore
  consumes 217.9487 Copper, 51.2821 Steel, 25.6410 Poly Silicon, 34.1880 Rubber,
  25.6410 Plastic, and 12.8205 Glass after expanding Electronics I, Electronics
  II, and PCB inputs.
- Producing the same 153.8462 Medical Supplies III consumes no Copper. Its
  expanded intermediate bill is 86.5385 Steel, 96.1538 Plastic, 28.8462
  Ethanol, 38.4615 Sugar, 28.8462 Ammonia, 76.9231 Oxygen, 38.4615 Hydrogen
  Fluoride, 38.4615 Poppy, 19.2308 Acid, and 19.2308 Glass.

Verified in `CargoShipsData`, `TrucksData`, `CargoShipV1`, `CargoShipV2`,
`CargoShipAssignedToDockJobProviderBase`, the large cargo-module prototypes,
`AssemblyData`, `FermentationTankData`, and `ChemicalPlantData`.

## Ore sorting plants

The static Infrastructure module tracks the island's ore sorting plants, not
world-map mines. Installed v0.8.7 worker values are:

| Building                  | Workers |
| ------------------------- | ------: |
| Ore sorting plant         |       6 |
| Ore sorting plant (large) |      30 |

Verified in `OreSortingPlantData` and `Costs.Buildings`. The module represents
these as no-flow static loads because their material sorting is not a production
recipe. Exporter schema v7 supplies completed and non-paused entity counts from
the loaded save; without synced data the counts are zero. Their power use is
activity-dependent and is excluded from calculator totals.

## Electrified trains

The Infrastructure module uses synced counts and the installed worker cost for
each type:

| Building                            | Workers each |
| ----------------------------------- | -----------: |
| Electric locomotive II              |            1 |
| Unit station module (electrified)   |            1 |
| Fluid station module (electrified)  |            1 |
| Loose station module (electrified)  |            1 |
| Molten station module (electrified) |            2 |

Locomotive and station power depends on activity, which the snapshot does not
measure, so all train power is excluded from calculator totals. Repeatable Train
Fuel Use research nevertheless reduces electric locomotive traction power by 1%
per level: `ElectricLocomotive` applies the train fuel-consumption multiplier
directly to its throttle-scaled power draw.

Exporter schema v7 counts completed entities by the installed prototype IDs
`LocomotiveT2Electric`, `TrainStationUnit_ELEC`, `TrainStationFluid_ELEC`,
`TrainStationLoose_ELEC`, and `TrainStationMolten_ELEC`. Non-paused counts
drive workers; completed counts remain visible as installed capacity. The
Molten module costs 2 workers and has a 150 kW activity-dependent draw, which
remains excluded from calculator totals.

Verified against installed v0.8.7 `TrainStationsData`, `IdsTrainsDlc`,
`MoltenTrainsData`, `Costs.Buildings`, `LocomotivesDataDlc`,
`ElectricLocomotive`, and `TrainDlcCosts`.

## Stacker towers

The Infrastructure module tracks Stacker towers as a worker-only load. Each
running tower contributes 4 workers; activity-dependent power is excluded. The
count is zero until a compatible snapshot is available. Exporter schema v7
counts completed and non-paused entities using the installed prototype ID
`StackerTower`.

Verified against installed v0.8.7 `Ids.Transports.StackerTower` and
`Costs.Buildings.StackerTower`.

## Vehicle depots

The Infrastructure module tracks all three vehicle-depot tiers as population-only
loads:

| Building             | Workers each | Prototype ID       |
| -------------------- | -----------: | ------------------ |
| Vehicles depot       |            6 | `VehiclesDepot`    |
| Vehicles depot II    |           10 | `VehiclesDepotT2`  |
| Vehicles depot III   |           16 | `VehiclesDepotT3`  |

Exporter schema v12 supplies completed and non-paused entity counts. Only the
reserved workforce is included in calculator totals; vehicle construction and
other activity-dependent costs remain excluded. Schema v11 and older snapshots
normalize the three unavailable counts to zero.

Verified against installed v0.8.7 `VehicleDepotsData`, `Ids.Buildings`, and
`Costs.Buildings`.

## Solar panels

The Solar Power module uses completed entity counts from exporter schema v7;
without synced data both panel counts are zero. The installed prototype IDs are
`SolarPanel` and `SolarPanelMono`. Synced counts feed both the Solar Power tab
and Factory Total generation. The exporter does not estimate instantaneous
generation; the calculator keeps using its existing weather-average, research,
and edict multipliers.

Verified against installed v0.8.7 `Ids.Machines.SolarPanel` and
`Ids.Machines.SolarPanelMono`.

## Rolling operating history

Exporter schema v7 reads the game's saved completed-month statistics for up to
120 production cycles (10 in-game years). The current partial cycle is excluded,
and a younger history is averaged over only the completed cycles that exist.

- Maintenance demand comes from each `MaintenanceManager.MaintenanceBuffers`
  entry's `ConsumedTotalStats`, reported separately for Maintenance I, II, and
  III. Each tier drives demand directly; a tier with no completed history
  contributes zero.
- Hydrogen fuel comes from `FuelStatsCollector.StatsPerProduct` for
  `Product_Hydrogen`. The total used as fuel drives the Nuclear planning demand;
  the snapshot also preserves the vehicle, cargo-ship, battleship, fuel-generator,
  and train breakdown. Cargo ships are aggregated, so past use cannot be split
  retrospectively between individual contracts.
- Electricity generation comes from
  `ElectricityManager.GetProductionStatsPerProto()`. The snapshot preserves each
  producer prototype's saved `ElectricityAvgStats` in MW. The calculator sums
  non-solar producer types for its average generation baseline; standard and mono
  solar generation remain modeled separately from their synced panel counts to
  avoid double counting. In the current save the Power Generator II output is
  nuclear-backed, but the exporter deliberately records the generator type rather
  than claiming an upstream steam source the game does not retain historically.

Verified against installed v0.8.7 `ItemStats.GetLatestData`,
`StatsDataRange.Last120Months`, `MaintenanceManager`,
`IMaintenanceBufferReadonly`, `FuelStatsCollector`, and `ElectricityManager`.

## Mining and logistics vehicles

The Infrastructure module uses the exporter's aggregate `workersAssigned`
vehicle count, with one worker per active vehicle. Without synced data the count
is zero. This is the sum of the game's own
`EntityWithWorkersExtensions.WorkersAssigned(vehicle)` calculation, so paused
vehicles remain in the physical/quota total without draining population. The
snapshot also provides the UI-only breakdown for trucks, excavators, tree
harvesters, and tree planters, plus used/maximum/free vehicle quota. The game
snapshot is not used to infer movement-dependent fuel.

Exporter schema v7 also scans `IEntitiesManager.Entities` for both ore sorting
plants, Electric locomotive II, all four electrified station modules, Stacker
towers, and The Statue of Maintenance (Golden). Exact installed v0.8.7 IDs are
`OreSortingPlantT1`, `OreSortingPlantT2`, `LocomotiveT2Electric`,
`TrainStationUnit_ELEC`, `TrainStationFluid_ELEC`, `TrainStationLoose_ELEC`,
`TrainStationMolten_ELEC`, `StackerTower`, and `StatueOfMaintenanceGolden`. An entity is reported as running when it is
completed and not manually paused. These running counts drive current workers
and Golden Statue Fuel Gas consumption. Infrastructure power is excluded because
the exporter does not measure runtime utilization.

The exporter is read-only, opens no network service, and writes only
`coi-calculator-state.json` inside its local mod directory. Its manifest allows
it to be added to and removed from an existing save.

The calculator normalizes both exporter schemas v6 and v7. A v6 snapshot keeps
all available synced values and supplies zero only for the v7-only Molten station
field. The browser persists the last valid normalized snapshot. Sync-owned values
therefore resolve in this order: compatible live snapshot, last valid snapshot,
then zero; baked gameplay counts are never substituted.

Verified against installed v0.8.7 `Costs.Vehicles`, `TrucksData`, and
`ExcavatorsData`, `TreeHarvestersData`, and `TreePlanetersData`. All five
represented vehicle categories consume one worker per active vehicle. The live
snapshot API is verified against installed v0.8.7 `IVehiclesManager` and its
`AllVehicles`, category, and vehicle-limit getters, plus `IEntitiesManager`,
`IEntity.Prototype.Id`, and `IEntity.IsPaused` for infrastructure.

## Aluminum recipes

The database contains every installed Aluminum recipe path: Bauxite Milling,
Bauxite Digestion, both Red Mud settling routes, Red Mud dumping, Fuel Gas and
Hydrogen alumina calcination, Aluminum Electrolysis, Aluminum Casting, both
scrap arc-furnace tiers, Alumina Crystallization, Aluminum Scrap pressing, and
Aluminum Scrap shredding.

The primary chain's full-building rates are:

| Step              | Inputs / cycle                   | Outputs / cycle                        |
| ----------------- | -------------------------------- | -------------------------------------- |
| Crusher (Large)   | 72 Bauxite                       | 72 Bauxite Powder                      |
| Chemical Plant II | 72 Bauxite Powder + 24 Brine     | 36 Hydrated Alumina + 36 Red Mud       |
| Rotary Kiln (gas) | 36 Hydrated Alumina + 6 Fuel Gas | 24 Alumina + 6 Carbon Dioxide          |
| Aluminum Cell     | 24 Alumina + 6 Graphite          | 24 Molten Aluminum + 18 Carbon Dioxide |
| Cooled Caster II  | 24 Molten Aluminum               | 24 Aluminum                            |

The disabled Space Points Exp. planning module owns the new primary Aluminum
chain. When activated, its two parallel lines consume 142.4921 Bauxite and
produce 43.6190 Aluminum for recurring Rocket II construction, while also
supplying the Molten Aluminum and Alumina used by Titanium Alloy and Sapphire
Wafers. Bauxite is represented as a demand-mined terrain resource in Mines;
installed terrain data confirms that Bauxite is directly mineable in addition
to the world-map Bauxite quarry.
Four Settling Tanks use the installed acid route to consume the resulting
71.2460 Red Mud with 47.4974 Acid and 7.9162 Limestone, recovering 15.8325 Iron
Ore Crushed and producing 31.6649 Slag per production cycle. Red Mud is not
dumped by this expansion plan.

## Titanium recipes

All eight installed Titanium recipes are assigned to the Space Points Exp.
module: ore crushing, ore smelting, chlorination, chloride purification,
chloride reduction, sponge smelting, alloy mixing, and cooled casting. The
single chain consumes 38.7725 Titanium Ore and exports 10.9048 Titanium Alloy
per production cycle for recurring Rocket II construction. Titanium Ore is a
demand-mined terrain resource in Mines. Installed terrain data confirms both
Bauxite and Titanium Ore terrain materials and their directly mined products.

Established inputs such as Electronics III and Graphite are deliberately not
produced inside Space Points Exp. Their deficits remain local to the isolated
planning tab while it is disabled; activating the module exposes them in
Factory Total.

## Offices and Focuses

The Offices module models all three installed v0.8.7 tiers. Rates are per
production cycle (60 seconds):

| Building   | Workers | Electricity | Office Supplies | Recyclables | Computing base |
| ---------- | ------: | ----------: | --------------: | ----------: | -------------: |
| Office I   |     250 |      250 kW |               2 |           2 |      12 TFLOPS |
| Office II  |     500 |      400 kW |               4 |           4 |      24 TFLOPS |
| Office III |   1,000 |      600 kW |               8 |           8 |      48 TFLOPS |

Computing boost steps 0, 1, and 2 add 0%, 20%, and 50% Office Focus capacity.
Their computing demands are `step² × computing base`, so an Office III at step
2 consumes 192 TFLOPS. Focus Points research adds 4% base capacity per level.
The game rounds research-scaled base capacity and boost capacity separately for
each Office before adding them.

Focus step cost is the cumulative arithmetic series
`step / 2 × (2 × base cost + (step - 1) × cost increment)`. The calculator
models Research Efficiency, Maintenance Production, Crop Yield, Recycling
Efficiency, Food Consumption, Goods & Services Consumption, Settlement Unity,
Contracts Profitability, and Contracts Unity Cost. World Mines & Rigs and the
truck and train capacity Focuses are displayed but remain informational because
their production or throughput is not modeled in Factory Total.

Assembly V produces 6 Office Supplies from 3 Paper, 2 Household Goods, and 1
Electronics II every 7.5 seconds. The calculator stores the equivalent
per-production-cycle rates of 48, 24, 16, and 8 respectively.

Office configuration resolves in `default ≤ modeled ≤ synced ≤ planned` order.
The current default is empty and no plan is set. A source-owned planned value
will remain authoritative until it is explicitly changed; the calculator does
not automatically clear a plan when synced values catch up.

Verified against the installed v0.8.7 Office prototypes, `OfficeFocusProto`,
Focus property implementations, Focus Points infinite research, and Assembly V
Office Supplies recipe bindings.
