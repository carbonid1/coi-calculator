# Crop Farm Model

Research target: Captain of Industry v0.8.6. Numerical values below were verified against the installed game assemblies. Wiki pages are useful for terminology and a human-readable overview, but the calculator database follows the game files where they disagree.

## Why farms are not ordinary recipes

A crop farm is a daily stateful simulation:

- Each farm has four schedule slots. One to four can be configured, and the schedule repeats in a circle.
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

At full water and constant 100% fertility, monthly crop output is simply tier-adjusted harvest quantity divided by growth months. The active plan also applies its rotation, fertilizer, research, edict, and seeded-weather rules.

The current global settings are Crop Yield research level 20 and Farming Boost I. Together they add 35% crop yield and 20% crop water demand. They do not change Fertilizer II consumption.

## Weather and rain

The game creates 24 weather periods of 15 days per year. On Standard weather, annual rain intensity is 400% for years 1-9, 350% for years 10-49, and 300% from year 50. The exact configured-seed sequence averages 13.6% rain intensity and 81.6% sunlight across the calculator's 100-year horizon.

The seed mostly changes *when* rain occurs rather than the annual intensity budget. That timing still matters: a heavy-rain fortnight can supply 90 water, more than the 50-unit soil buffer can hold, while a later dry spell can force irrigation. The calculator therefore replays the v0.8.6 seeded weather generator and daily integer soil-buffer rules instead of subtracting average rainfall.

In v0.8.6, farm crop growth does not read sunlight. Weather affects crops through rainfall and water availability; sunlight remains relevant to solar production. Farm cards show gross crop demand as a reference and the imported-water requirement after the configured 100-year weather simulation. Factory balances use the weather-adjusted import.

## Current planning layout

The active crop plan uses seven Greenhouse IIs across seven fixed rotation
configurations, Fertilizer II at 140%, and full irrigation. Seven is the
minimum practical building count that supports the 15-block Housing III
settlement and maximally boosted Office III, including Poppy for Morphine:
every crop deficit is closed and every crop surplus remains at or below 5 per
production cycle. The Food Pack expansion uses 1,950 chickens
across four farms, three Baking Units, and four Mills. Carcass
processing belongs to the General module, not Chicken Farms: one dedicated Food
Processor makes Meat + Trimmings, and a second dedicated Food Processor converts
only surplus Carcasses into Trimmings. Surplus Trimmings continue through Fuel
Gas into Diesel, which is intentionally retained as a useful trade surplus.
Every rotation avoids placing the same fertility-consuming crop after itself,
including across the last-to-first wrap. The farms do not auto-balance:
changing population or downstream recipes leaves a visible crop deficit or
surplus until the physical layout is revised.

Greenhouses and Chicken Farms are separate calculator modules because they are
separate physical water networks. Five Groundwater Pumps are installed for the
Greenhouses, with all five active. Chicken Farm water is imported
from Factory Total and can never increase those pumps' modeled output.

| Farms | Rotation | Fertilizer II target |
| ---: | --- | ---: |
| 1 | Wheat / Soybean / Wheat / Fruit | 140% |
| 1 | Vegetables / Canola / Potato / Corn | 140% |
| 1 | Corn / Soybean / Fruit / Wheat | 140% |
| 1 | Vegetables / Corn / Potato / Corn | 140% |
| 1 | Wheat / Vegetables / Wheat / Corn | 140% |
| 1 | Corn / Wheat / Corn / Wheat | 140% |
| 1 | Sugar Cane / Poppy / Fruit / Tree Sapling | 140% |

Crop output and fertilizer are long-run cycle averages on the calculator's
100-year horizon. Each farm card keeps gross crop demand visible for comparison
with the game UI, then reports the weather-adjusted imported water used by
module and factory balances. Evaporation is absent because every schedule slot
is occupied.
