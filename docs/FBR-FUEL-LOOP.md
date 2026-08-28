# Nuclear target

The Nuclear module models the two-reactor checkpoint used to expand and rewire
the existing nuclear station.

All rates below are per production cycle (60 seconds, or one in-game month).
Numerical recipe and building values target the installed Captain of Industry
v0.8.7 game data.

## Configuration

- 1 breeder at Power I / 3x breeding
- 1 power reactor at Power IV / 0x breeding
- 240 MW gross turbine capacity
- 50 MW planned average Nuclear generation
- 46.5 Hydrogen Fuel per cycle

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

The reactors produce 408 Super Steam. The Power IV reactor's 384 Super Steam
feeds eight turbine trains for 240 MW gross capacity. Eight of each turbine
tier and 16 Power Generator IIs cover that bank. The breeder's 24 Super Steam
is reserved for Hydrogen and desalination rather than receiving its own
turbines. Hydrogen production and desalination reduce the simultaneously
available net output when they consume power-reactor steam.
Each train requires two generators: one for the Super-Pressure Turbine's 18 MW
shaft and one for the combined 12 + 6 MW High- and Low-Pressure shafts.

The initial 50 MW target dispatches two turbine trains at a combined 1.67 / 2
average load from the Power IV reactor's eight-train bank. Solar output is
additional.

Keep six Hydrogen Reformers built, with five active and one paused. The active
set covers current factory-wide Hydrogen demand while remaining demand-balanced.

Hydrogen demand is allocated first. The desalinators then run only as much as
needed for Water and Brine, preferring four Depleted-Steam units before five
Super-Steam units. Low Steam from ordinary factory processing is handled in the
separate Default module by one Seawater Pump, two Thermal Desalinators, and one
Large Cooling Tower; that physical network does not share Seawater Pump capacity
with Nuclear. The four physical nuclear cooling towers have both Super- and
Depleted-Steam recipes enabled. Three remain active and share their capacity
between the remaining streams; the fourth is a paused reserve. Any other steam
beyond the active capacity stays visible as excess in the calculator.

## Building counts

| Building | Built | Active at 50 MW |
| --- | ---: | ---: |
| Fast Breeder Reactor — Power I / 3x | 1 | 1 |
| Fast Breeder Reactor — Power IV / 0x | 1 | 1 |
| Nuclear Reprocessing Plant | 1 | 1 |
| Seawater Pump | 3 | 3 |
| Enrichment Plant | 2 | 2 |
| Chemical Plant II — Yellowcake | 2 | 2 |
| Each turbine tier | 8 | 2 |
| Power Generator II | 16 | 4 |
| Hydrogen Reformer | 6 | 5, with 1 paused |
| Electrolyzer II - Chlorine | 2 | 1 demand-balanced, 1 paused |
| Evaporation Pond (Heated) - Brine to Salt | 2 | 1 demand-balanced, 1 paused |
| Thermal Desalinator — Depleted | 4 | 4 |
| Thermal Desalinator — Super | 5 | 5 |
| Cooling Tower (Large) — shared Super/Depleted recipes | 4 | 3 |
| Liquid Dump - Water overflow | 1 | 1, demand-balanced |
| Liquid Dump - Brine overflow | 1 | 1, demand-balanced |
| Smoke Stack (Large) - Oxygen overflow | 1 | 1, demand-balanced |
| Radioactive Waste Storage | 1 | 1 |
| Shredder | 1 | 1 |

Run one Nuclear Heated Evaporation Pond and keep the second paused. Nuclear Brine satisfies ordinary
factory demand first and its local remainder is dumped. A separate
Default Heated Evaporation Pond converts only non-Nuclear global Brine surplus
to Salt. Aluminum has no reserved Brine branch in this checkpoint; introduce a
secondary Salt plan later if Aluminum consumption makes the available Brine
insufficient.

Hydrogen Reformer Oxygen satisfies global factory demand first. The Large
Smoke Stack is the final sink for any remainder and can vent up to 900 Oxygen
per production cycle without workers or electricity.

## Waste

Core-fuel reprocessing produces 1.5 Fission Product per cycle. One Radioactive
Waste Storage and one Shredder are sufficient for the checkpoint.
