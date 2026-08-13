# In-game change plan

This is the living checklist for changes that must be applied to the current
Captain of Industry save. Add an entry only after the calculator plan is
confirmed; mark it complete after making and checking the change in game.

## 1. Enable the Uranium Ore contract with four cargo modules

**Status:** Pending

- Enable the Food Pack → Uranium Ore contract.
- Use four large cargo modules total: two Unit Modules (L) exporting Food Packs
  and two Loose Modules (L) importing Uranium Ore.
- Keep the contract fixed at this size; do not add modules automatically if
  Uranium Ore later enters deficit.
- Keep Save Fuel enabled for the cargo ship.
- Expected average flow: export 36 Food Packs and import 54 Uranium Ore per
  production cycle.

## 2. Expand Food Pack production

**Status:** Planned

- Add or unpause one Assembly V, targeting two active Food Pack assemblers in
  total. Keep one supplied by Eggs + Bread and the other by Meat + Bread.
- Keep settlement and Cake supplied with Eggs first. The Food Pack assemblers
  use the remaining Eggs, then Meat for the rest of their output.
- Add or unpause Baking Units, targeting three active in total.
- Add or unpause Mills, targeting four active in total.
- Increase the third Chicken Farm from 100 to 500 chickens.
- Build one additional Chicken Farm and place 200 chickens in it, for 1,700
  chickens across four farms in total.
- Add or unpause one Food Processor in the general processing area, targeting
  one active processor dedicated exclusively to Chicken Carcass → Meat +
  Trimmings.
- Add or unpause a second, separate Food Processor, targeting one active
  processor dedicated exclusively to surplus Chicken Carcass → Trimmings.
  Route surplus Trimmings through the Anaerobic Digester and crack the resulting
  Fuel Gas into Diesel. Diesel surplus is intentional and can be traded for
  Gold; the Gold trade remains outside the calculator.
- Add or unpause one Greenhouse II, targeting six active in total. Configure one
  of each of these fixed rotations with Fertilizer II and the listed target:
  1. Canola / Wheat / Corn / Wheat — 100%.
  2. Wheat / Green Manure / Wheat / Corn — 140%.
  3. Soybean / Wheat / Vegetables / Fruit — 140%.
  4. Corn / Green Manure / Wheat / Vegetables — 140%.
  5. Fruit / Tree Sapling / Wheat / Sugar Cane — 100%.
  6. Potato / Corn / Green Manure / Corn — 140%.
- Keep all six supplied with Water and Fertilizer II. This is the minimum farm
  count that closes the expanded factory's crop demand while keeping every
  individual crop surplus at or below 5 per production cycle.

## 3. Expand Maintenance III capacity

**Status:** Planned

- Increase the planned Maintenance III demand from 123 to 263 per production
  cycle, adding 140 of reserve.
- Add or unpause one Maintenance III Depot, targeting two active in total. At
  Maintenance Output IV, one depot can produce only 249 per production cycle.
- Keep both depots demand-balanced. Their combined planned utilization is
  approximately 53% each; neither should be forced to run continuously.

## 4. Expand the Maintenance III supply chain

**Status:** Planned

The higher Maintenance III target exposes the following physical limits. Add a
building if the target count is not installed; otherwise unpause an existing
one. After the change, target these active totals:

- Silicon Reactor making Poly Silicon — **2 active**.
- Assembly V making Electronics III — **2 active**.
- Chemical Plant II pool supporting electronics and Graphite — **2 active**.
- Copper Electrolysis — **3 active**.
- Metal Caster II making Impure Copper — **3 active**.
- Arc Furnace II copper pool — **2 active**.

Keep every line demand-balanced. These are capacity targets, not instructions
to force the buildings to run continuously.

## 5. Expand Super Steam desalination

**Status:** Planned

- Add or unpause one Thermal Desalinator in the nuclear Super Steam setup,
  targeting **5 active** in total.
- Keep the group demand-balanced; the fifth desalinator provides capacity
  without forcing the full set to run continuously.

## 6. Pause one Hydrogen Reformer

**Status:** Planned

- Keep all four Hydrogen Reformers installed, but pause one and target **3
  active** in the nuclear setup.
- Keep Hydrogen production demand-balanced; the three active reformers should
  not be forced to run continuously.

## Deferred calculator work

- **Non-blocking:** Model the factory's approximately 23.22 Low Steam per
  production cycle through the intended Thermal Desalinator route. The amount
  is too small to change the current nuclear or Food Pack build plan, so leave
  the existing plan locked until this is revisited.
