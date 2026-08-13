# End-game nuclear plan

This document records the planning decision behind the Nuclear calculator
module. Exact reactor rates and building counts live in
[FBR-FUEL-LOOP.md](./FBR-FUEL-LOOP.md).

All rates are per production cycle (60 seconds, or one in-game month).

## Strategic decision

Expand and rewire the existing nuclear station around two Fast Breeder
Reactors instead of constructing the former five-reactor long-term block:

- Reactor 1 is the breeder at Power I / 3x breeding.
- Reactor 2 is the power reactor at Power IV / 0x breeding.
- Planned average Nuclear generation remains 50 MW.
- The two reactors produce enough steam for 255 MW gross turbine output when
  all nine trains are dispatched and all reactor steam is routed to power.
- Fresh uranium demand remains exactly 9 Yellowcake per cycle.

This combination has the same steady-state fuel balance and Yellowcake demand
as four 0x reactors plus one 3x breeder at Power I. It needs only two reactors,
roughly 80 Core Fuel for initial loading instead of roughly 200, and much less
support machinery.

The immediate objective is a closed loop that can run for many production
cycles. Its power opens research, aggressive mining, and island flattening
without committing to the final factory layout now.

## Locked decisions

- Build and operate exactly two FBRs for this checkpoint.
- Keep the breeder first in the physical layout and calculator presentation.
- Build nine complete turbine trains, with two trains dispatched for the
  initial 50 MW average target. Hydrogen and desalination steam use part of the
  gross headroom when they run at the same time.
- Keep all four existing Hydrogen Reformers installed, with three active and
  one paused while demand-balancing average output around the 50-per-cycle
  Hydrogen Fuel target.
- Keep research stations outside the initial material and electricity load.
- Keep Maintenance III as a separate factory-wide planning concern.
- Add more reactors only after the 255 MW station is no longer sufficient.

## Closed-loop checkpoint

The two reactors consume 408 Water, 12 Core Fuel, and 12 Blanket Fuel. They
produce 408 Super Steam, 12 Spent Core Fuel, and 12 Enriched Blanket Fuel.

Reprocessing and enrichment return 12 Core Fuel and 9 Blanket Fuel. Converting
9 Yellowcake supplies the remaining 3 Blanket Fuel, leaving both fuel balances
at zero.

Shared Yellowcake production uses two demand-balanced Settling Tanks with
capacity for 12 per cycle. They run at 1.5 / 2 average load and supply exactly
9 Yellowcake from 54 Uranium Ore and 18 Acid. The Acid chain supplies that load
from 3 Sulfur and 15 Water. Neither Settling Tank is forced to run constantly.

Water and Brine are recovered in this order:

1. Satisfy Hydrogen demand.
2. Demand-balance Depleted- and Super-Steam desalination for useful Water and
   Brine recovery.
3. Use cooling towers for the remaining steam only.

The success condition is an indefinite number of production cycles without a
Core Fuel, Blanket Fuel, Water, or waste-handling deadlock.

## Execution

### Stage 1: prepare the existing station

Reuse the current nuclear infrastructure, release workers from machinery that
will remain paused, and reserve the two reactor locations with the breeder
first. The fixed Uranium contract uses one size-4 cargo ship and four large
cargo modules for 42 workers total.

### Stage 2: expand and rewire

Build the second FBR and right-sized support machinery listed in
[FBR-FUEL-LOOP.md](./FBR-FUEL-LOOP.md). Arrange each reactor with its related
turbine bank so the physical layout matches the calculator.

### Stage 3: commission the closed loop

Run the breeder at Power I / 3x and the power reactor at Power IV / 0x. Supply
54 Uranium Ore, 3 Sulfur, and 15 Water per cycle to the Yellowcake chain, then
verify fuel processing, Water/Brine routing, and radioactive waste disposal
together. Initially dispatch two turbine trains for 50 MW average Nuclear
generation.

### Stage 4: use the headroom

Use the available electricity and Hydrogen Fuel for research, mining, and
terrain flattening. Bring additional turbine trains online as demand grows,
up to the station's 255 MW capacity.

### Stage 5: scale only when needed

When 255 MW is no longer enough, plan the next reactor block from measured
demand. Do not reserve the former five-reactor footprint or its support plant.
As local deposits run out, transition finite inputs to contracts and treat the
next expansion as a separate checkpoint.

## Constraints to keep visible

- Maintenance III will be a major long-term ore drain even though it is not
  assigned directly to production modules.
- The active Uranium contract adds 42 workers to the factory total: 22 on the
  cargo ship and 20 across its four large cargo modules.
- Population growth must include the demand created by new residents while
  crediting workers released from reused or closed infrastructure.
- The immediate fresh inputs for the nuclear fuel loop are 54 Uranium Ore,
  3 Sulfur, and 15 Water per cycle.
- Cooling towers are the final steam sink after useful Water/Brine recovery.
