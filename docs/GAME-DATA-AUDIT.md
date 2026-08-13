# Installed game-data audit

Target: Captain of Industry v0.8.7 installed under Steam. All rates below are
normalized to one 60-second production cycle.

## Cargo contracts

The active size-4 cargo plan has one ship and four occupied large modules:
two Unit Module (L) exports and two Loose Module (L) imports.

- Cargo Ship T2: 22 workers.
- Each large cargo module: 5 workers, for 42 workers total.
- Each onboard large cargo module holds 800 units. Two import modules therefore
  carry 1,600 Uranium Ore per trip. The shore module's 1,600 storage capacity is
  not a shipload.
- Base trip fuel is `90 + 60 × occupied modules`.
- Hydrogen applies the game's 125% diesel-energy ratio.
- Save Fuel applies 70%, so this plan uses
  `ceil((90 + 60 × 4) × 1.25 × 0.70) = 289 Hydrogen` per trip.
- At 54 Uranium Ore per cycle, average ship fuel is
  `54 / 1,600 × 289 = 9.75375 Hydrogen` per cycle.

The calculator displays that value on the contract card for reference only.
Factory Hydrogen demand remains the manually configured planning target, so
contract fuel is not added a second time.

Verified in `CargoShipsData`, `TrucksData`, `CargoShipV2`,
`CargoShipAssignedToDockJobProviderBase`, and the large cargo-module prototypes.

## Ore sorting plants

The static Infrastructure module tracks the island's ore sorting plants, not
world-map mines. Installed v0.8.7 values are:

| Building | Workers | Electricity |
| --- | ---: | ---: |
| Ore sorting plant | 6 | 100 kW |
| Ore sorting plant (large) | 30 | 700 kW |

Verified in `OreSortingPlantData` and `Costs.Buildings`. The module represents
these as no-flow static loads because their material sorting is not a production
recipe. Their configured counts live in the database; the UI does not expose
editable count inputs.

## Electrified trains

Current save counts represented by the static Infrastructure module:

| Building | Count | Workers each | Electricity each |
| --- | ---: | ---: | ---: |
| Electric locomotive II | 21 | 1 | Variable, up to 2.5 MW while driving |
| Unit station module (electrified) | 108 | 1 | 50 kW |
| Fluid station module (electrified) | 79 | 1 | 50 kW |
| Loose station module (electrified) | 143 | 1 | 50 kW |

The three module types therefore add 330 workers and 16.5 MW. The locomotives
add another 21 workers. Their traction power is throttle- and movement-dependent,
so the calculator does not misrepresent the 52.5 MW fleet maximum as a constant
factory load.

Verified against installed v0.8.7 `TrainStationsData`, `Costs.Buildings`,
`LocomotivesDataDlc`, and `TrainDlcCosts`.

## Mining and logistics vehicles

Current save counts represented by the static Infrastructure module:

| Vehicle | Count | Workers each |
| --- | ---: | ---: |
| Truck | 18 | 1 |
| Haul truck (dump) | 16 | 1 |
| Mega excavator | 11 | 1 |

These add 45 workers. Vehicle fuel consumption is movement- and work-dependent,
so it is not included as a constant factory demand.

Verified against installed v0.8.7 `Costs.Vehicles`, `TrucksData`, and
`ExcavatorsData`.

## Aluminum recipes

The database contains every installed Aluminum recipe path: Bauxite Milling,
Bauxite Digestion, both Red Mud settling routes, Red Mud dumping, Fuel Gas and
Hydrogen alumina calcination, Aluminum Electrolysis, Aluminum Casting, both
scrap arc-furnace tiers, Alumina Crystallization, Aluminum Scrap pressing, and
Aluminum Scrap shredding.

The primary chain's full-building rates are:

| Step | Inputs / cycle | Outputs / cycle |
| --- | --- | --- |
| Crusher (Large) | 72 Bauxite | 72 Bauxite Powder |
| Chemical Plant II | 72 Bauxite Powder + 24 Brine | 36 Hydrated Alumina + 36 Red Mud |
| Rotary Kiln (gas) | 36 Hydrated Alumina + 6 Fuel Gas | 24 Alumina + 6 Carbon Dioxide |
| Aluminum Cell | 24 Alumina + 6 Graphite | 24 Molten Aluminum + 18 Carbon Dioxide |
| Cooled Caster II | 24 Molten Aluminum | 24 Aluminum |

These recipes are database-only for now; no Aluminum production buildings were
added to an active factory module.

## Titanium recipes

All eight installed Titanium recipes were already present and their rates match
v0.8.7: ore crushing, ore smelting, chlorination, chloride purification,
chloride reduction, sponge smelting, alloy mixing, and cooled casting. Their
version annotation and regression coverage now reflect the installed build.
