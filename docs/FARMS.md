# Crop Farm Model

Research target: Captain of Industry v0.8.6. Numerical values below were verified against the installed game assemblies. Wiki pages are useful for terminology and a human-readable overview, but the calculator database follows the game files where they disagree.

## Why farms are not ordinary recipes

A crop farm is a daily stateful simulation:

- Each farm has four schedule slots. One to four can be configured, and the schedule repeats in a circle. Unassigned slots are skipped; an explicitly selected No Crop remains part of the rotation.
- The previous crop matters. Repeating the same fertility-consuming crop adds a 50% fertility-demand penalty, including from the final slot back to the first.
- Yield is based on the average fertility recorded across the crop's actual growth days.
- Rain arrives in 15-day weather blocks and fills a 50-unit soil-water buffer. Overflow is lost, so average rainfall alone cannot determine imported-water demand.
- Irrigated tiers add imported water only when soil water is low and it is not currently raining.
- Fertilizer is applied toward a target in 10-point steps. Different products restore different amounts and impose different maximum targets.

The calculator therefore runs one steady-state daily water simulation per configured farm group, not four independent production recipes. `CropFarmGroup` captures that grouping, so farms with different tiers, rotations, or fertilizer targets are not collapsed into one global setting.

## Farm tiers

| Tier | Workers | Maintenance I / month | Yield | Water and fertility demand | Evaporation / day | Irrigation and fertilizer |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Farm | 8 | 0 | 100% | 100% | 0.2 | No |
| Irrigated Farm | 10 | 2 | 100% | 100% | 0.2 | Yes |
| Greenhouse | 16 | 6 | 125% | 112.5% | 0.1 | Yes |
| Greenhouse II | 20 | 8 | 150% | 125% | 0.1 | Yes |

All tiers use no electricity and collect up to 6 water per full-rain day. Greenhouses can grow the greenhouse-only crops.

## Fertilizers

| Product | Fertility per unit | Maximum target |
| --- | ---: | ---: |
| Fertilizer (Organic) | 1 point | 100% |
| Fertilizer I | 2 points | 120% |
| Fertilizer II | 2.5 points | 140% |

Natural fertility does not recover at a flat one point per day. Each day it moves 1% of the remaining distance toward 100%. Positive recovery is halved when the soil-water buffer is empty. Above 100%, the movement back toward 100% is scaled to 20%, while crop fertility demand rises progressively.

## Crop prototypes

The structured source of truth is `app/db/crop-farming.ts`. Base crop quantities and demands are transformed by the selected farm tier. Green Manure's negative fertility demand is multiplied by the tier's yield multiplier; normal crop water and fertility demands use the tier demand multiplier.

At full water and constant 100% fertility, monthly crop output is simply tier-adjusted harvest quantity divided by growth months. Synced farms apply their own rotation, supplied fertilizer, fertility target, research, edict, and seeded-weather rules.

The current global settings are Crop Yield research level 20 and Farming Boost I. Together they add 35% crop yield and 20% crop water demand. They do not change Fertilizer II consumption.

## Weather and rain

The game creates 24 weather periods of 15 days per year. On Standard weather, annual rain intensity is 400% for years 1-9, 350% for years 10-49, and 300% from year 50. The exact configured-seed sequence averages 13.6% rain intensity and 81.6% sunlight across the calculator's 100-year horizon.

The seed mostly changes *when* rain occurs rather than the annual intensity budget. That timing still matters: a heavy-rain fortnight can supply 90 water, more than the 50-unit soil buffer can hold, while a later dry spell can force irrigation. The calculator therefore replays the v0.8.6 seeded weather generator and daily integer soil-buffer rules instead of subtracting average rainfall.

In v0.8.6, farm crop growth does not read sunlight. Weather affects crops through rainfall and water availability; sunlight remains relevant to solar production. Farm cards show gross crop demand as a reference and the imported-water requirement after the configured 100-year weather simulation. Factory balances use the weather-adjusted import.

## Synced crop-farm areas

Greenhouses and Greenhouse IIs belong to their generated vehicle-area module by
stable area ID. The area name has no special meaning. Farms outside every named
area belong to Default, while a farm covered by several named areas has one
stable owner so its production is counted once.

Each exact combination of tier, rotation, supplied fertilizer, and fertility
target receives one card. Running farms produce at their synced configuration;
paused farms remain installed with zero production. Farms without a rotation
remain visible as unconfigured inventory.

The earlier layout used nine running Greenhouse IIs with Fertilizer II at 140%
and 15 paused, unconfigured Greenhouse IIs. It was sized against the Factory
Total demand and Crop Yield level 20 recorded at the time, including Poppy for
Morphine and Tree Saplings. Current counts, rotations, and research come from sync.
Carcass processing belongs to the Default module, not Chicken Farms: one
dedicated Food Processor makes Meat + Trimmings, and a second dedicated Food
Processor converts only surplus Carcasses into Trimmings. Surplus Trimmings
continue through Fuel Gas into Diesel, which is intentionally retained as a
useful trade surplus.
Every rotation avoids placing the same fertility-consuming crop after itself,
including across the last-to-first wrap. The farms do not auto-balance:
changing population or downstream recipes leaves a visible crop deficit or
surplus until the physical layout is revised.

Groundwater Pumps inside a crop-farm area belong to that generated module. Their
actual pause state controls installed output, and shared aquifers are capped once
across every owning module. Pumps outside named crop-farm areas remain in Default.

Schema 17 treats Groundwater Pumps as shared physical inventory. Schema 18 adds
vehicle-area membership, and schema 26 adds aquifer state. Paused pumps remain
physical inventory but do not increase active production. A pump covered by
crop-farm areas with different owners remains an explicit conflict.

Schema 19 exports every completed Greenhouse and Greenhouse II with a stable
save-local entity ID. Schema 24 adds vehicle-area membership. Schema 33 exports
the connected fertilizer-pipe product independently from the fertility target.
When the pipe has no known product, a non-empty, unambiguous farm buffer is used
as a fallback. Cards group identical synced configurations while workers,
inputs, and outputs count every physical farm exactly once.

Chicken farms belong to their named vehicle area, using the lowest named area
ID when areas overlap; unassigned farms belong to Default. Completed farms use
their synced population, pause state, and slaughtering mode. Area discovery does
not apply the historical 2,350-chicken plan or unpause farms. Construction ghosts
remain visible and project 500 chickens with slaughtering on per farm, marked
Planned. Completing a ghost replaces its projection with the actual farm state.

Installed v0.8.7 `AnimalFarmsData`, `Fix32.FromDouble`, `AnimalFarm`, and
`AnimalFarmInspector` confirm fixed chicken rates with no research or edict
multipliers. The per-chicken feed, water, and egg quantities are stored as
31/1024, 37/1024, and 15/1024. At 500 chickens the displayed recipe therefore
uses 15.1 feed and 18.1 water and produces 7.32 eggs plus 10 carcasses per cycle
with slaughtering on. These are the inspector rates, before daily accumulation
and whole-product buffer timing.

| Farms | Rotation | Fertilizer II target |
| ---: | --- | ---: |
| 1 | Potato / Fruit / Potato / Wheat | 140% |
| 1 | Potato / Fruit / Wheat / Soybean | 140% |
| 1 | Corn / Vegetables / Corn / Vegetables | 140% |
| 1 | Corn / Wheat / Corn / Canola | 140% |
| 1 | Corn / Soybean / Corn / Soybean | 140% |
| 1 | Wheat / Corn / Wheat / Vegetables | 140% |
| 1 | Corn / Wheat / Canola / Poppy | 140% |
| 1 | Vegetables / Fruit / Wheat / Sugar Cane | 140% |
| 1 | Tree Sapling / Wheat / Poppy (one unassigned slot) | 140% |

Crop output and fertilizer are long-run cycle averages on the calculator's
100-year horizon. Each farm card keeps gross crop demand visible for comparison
with the game UI, then reports the weather-adjusted imported water used by
module and factory balances. Only explicitly selected No Crop slots participate
in the soil and weather simulation. The earlier mapping incorrectly treated
unassigned slots as No Crop, lengthening partial rotations and understating output.
Installed v0.8.7 `Farm.onNewDay` confirms that unassigned slots are skipped.
