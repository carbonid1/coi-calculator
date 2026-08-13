# Nuclear target

The Nuclear module models the two-reactor checkpoint used to expand and rewire
the existing nuclear station.

All rates below are per production cycle (60 seconds, or one in-game month).
Numerical recipe and building values target the installed Captain of Industry
v0.8.7 game data.

## Configuration

- 1 breeder at Power I / 3x breeding
- 1 power reactor at Power IV / 0x breeding
- 255 MW gross turbine capacity
- 50 MW planned average Nuclear generation
- 50 Hydrogen Fuel per cycle

## Reactor and fuel balance

| Reactor | Inputs | Outputs |
| --- | --- | --- |
| Power I / 3x breeder | 24 Water, 4 Core Fuel, 12 Blanket Fuel | 24 Super Steam, 4 Spent Core Fuel, 12 Enriched Blanket Fuel |
| Power IV / 0x power reactor | 384 Water, 8 Core Fuel | 384 Super Steam, 8 Spent Core Fuel |
| **Total** | **408 Water, 12 Core Fuel, 12 Blanket Fuel** | **408 Super Steam, 12 Spent Core Fuel, 12 Enriched Blanket Fuel** |

The support chain closes both fuel loops:

| Step | Load | Consumes | Produces |
| --- | ---: | --- | --- |
| Core-fuel reprocessing | 0.75 / 1 plant | 12 Spent Core Fuel | 9 Core Fuel |
| Blanket enrichment | 1.5 / 2 plants | 12 Enriched Blanket Fuel | 9 Blanket Fuel, 3 Core Fuel |
| Yellowcake conversion | 1.5 / 2 plants | 9 Yellowcake | 3 Blanket Fuel |

Core Fuel and Blanket Fuel both balance at zero. Yellowcake is the only fresh
uranium input. Two demand-balanced Settling Tanks operate at 1.5 / 2 average
load to supply exactly 9 Yellowcake from 54 Uranium Ore and 18 Acid. The Acid
chain supplies its 18 Acid from 3 Sulfur and 15 Water.

The two-reactor configuration therefore has the same steady-state Yellowcake
demand as the former five-reactor configuration. Its advantage is the smaller
physical build and lower initial reactor fuel load, not lower Yellowcake use.

## Turbines and steam routing

The reactors produce 408 Super Steam, enough for 8.5 turbine trains or 255 MW
when all reactor steam is used for power. Nine of each turbine tier and 18
Power Generator IIs cover that full gross output. Hydrogen production and
desalination reduce the simultaneously available net output when they consume
reactor steam.
Each train requires two generators: one for the Super-Pressure Turbine's 18 MW
shaft and one for the combined 12 + 6 MW High- and Low-Pressure shafts.

The initial 50 MW target dispatches two turbine trains at a combined 1.67 / 2
average load. The breeder's single turbine train remains available, while the
eight-train bank belongs to the Power IV reactor. Solar output is additional.

Keep all four existing Hydrogen Reformers installed, with three active and one
paused. The active set covers the configured 50 Hydrogen Fuel target while
remaining demand-balanced.

Hydrogen demand is allocated first. The desalinators then run only as much as
needed for Water and Brine, preferring four Depleted-Steam units before five
Super-Steam units. The intended Thermal Desalinator route for surplus Low Steam
remains deferred in the calculator, so that excess stays visible for now. The
four physical cooling towers all have both Super- and Depleted-Steam recipes
enabled. Three remain active and share their capacity between the remaining
streams; the fourth is a paused reserve. Any other steam beyond the active
capacity also stays visible as excess in the calculator.

## Building counts

| Building | Built | Active at 50 MW |
| --- | ---: | ---: |
| Fast Breeder Reactor — Power I / 3x | 1 | 1 |
| Fast Breeder Reactor — Power IV / 0x | 1 | 1 |
| Nuclear Reprocessing Plant | 1 | 1 |
| Seawater Pump | 3 | 3 |
| Enrichment Plant | 2 | 2 |
| Chemical Plant II — Yellowcake | 2 | 2 |
| Each turbine tier | 9 | 2 |
| Power Generator II | 18 | 4 |
| Hydrogen Reformer | 4 | 3 |
| Thermal Desalinator — Depleted | 4 | 4 |
| Thermal Desalinator — Super | 5 | 5 |
| Cooling Tower (Large) — shared Super/Depleted recipes | 4 | 3 |
| Radioactive Waste Storage | 1 | 1 |
| Shredder | 1 | 1 |

## Waste

Core-fuel reprocessing produces 1.5 Fission Product per cycle. One Radioactive
Waste Storage and one Shredder are sufficient for the checkpoint.
