# Wiki Discrepancies

Confirmed differences between the Captain of Industry wiki and the game data used by this calculator. Review and clear resolved entries when updating the calculator for a new game version.

Wiki login and submission workflow: to be decided.

## Pending

### Water Saver and chicken farms

- Game version: 0.8.7
- Wiki wording: [Water Saver](https://wiki.coigame.com/Edicts) reduces water consumed in settlements and farms
- Verified game behavior: the edict changes settlement and crop-farm water multipliers; `AnimalFarm.onNewDay` reads its fixed per-animal water quantity without either multiplier. Chicken farms are unaffected, as are their feed and outputs by Food Saver, Farming Boost, or Crop Yield research.
- Verification: installed `EdictsData`, `IncrementalResearchData`, `AnimalFarm`, and `AnimalFarmProto`
- Status: ready for a future wiki clarification distinguishing crop farms from chicken farms

### World Mine Output research

- Game version: 0.8.7
- Wiki value: uncertain whether “efficiency” means increased output or bonus material without additional reserve use
- Verified game behavior: each level adds 2% bonus output from World Mines, oil rigs, and the Groundwater well, up to level 50; the production timer is unchanged and finite deposits are depleted by the pre-bonus quantity
- Verification: installed game data (`IncrementalResearchData`) and runtime (`WorldMapMine.SimUpdateInternal`)
- Status: ready for a future wiki clarification

### Settlement service Unity

- Game version: 0.8.7
- Wiki value: Consumer Electronics grants 1.8 Unity and Medical Supplies III grants 1.2 Unity per month
- Verified game value: Consumer Electronics grants 1.4 Unity and Medical Supplies III grants 1.0 Unity per month
- Verification: installed game data (`SettlementsData`)
- Status: ready for a future wiki edit

### Crop farm workers

- Game version: 0.8.6
- Wiki value: Farm 10, Irrigated Farm 12, Greenhouse 18, and Greenhouse II 24 workers
- Verified game value: Farm 8, Irrigated Farm 10, Greenhouse 16, and Greenhouse II 20 workers
- Verification: installed game data (`Costs.Buildings`)
- Status: ready for a future wiki edit

### Greenhouse yield multiplier

- Game version: 0.8.6
- Wiki value: 20% increased crop yield compared with the basic Farm
- Verified game value: 25% increased crop yield; Greenhouse II remains 50%
- Verification: installed game data (`FarmsData.RegisterData`)
- Status: ready for a future wiki edit

### Sunlight and crop growth

- Game version: 0.8.6
- Wiki value: weather sunlight affects crop growth
- Verified game behavior: crop growth reads daily fertility and water availability; the farm reads weather rain intensity but not simulated sun intensity
- Verification: installed game runtime (`Farm.onNewDay`, `Crop.RecordGrowthDay`)
- Status: ready for a future wiki edit

### Hydrogen Reformer workers and electricity

- Game version: 0.8.6
- Wiki value: 12 workers and 250 kW
- Verified game value: 8 workers and 400 kW
- Verification: installed game data and in-game building panel
- Status: ready for a future wiki edit

### Maintenance III Depot workers

- Game version: 0.8.6
- Wiki value: 28 workers
- Verified game value: 20 workers
- Verification: installed game data and in-game encyclopedia
- Status: ready for a future wiki edit

### Standard weather progression

- Game version: 0.8.6
- Wiki value: Standard weather changes from 400% `RainPerYear` in years 1-9 to 300% in year 10 and later
- Verified game value: 400% from year 1, 350% from year 10, and 300% from year 50
- Verification: installed game data (`DefaultWeatherProvider.NormalDifficulty`)
- Status: ready for a future wiki edit

### Water Facility population rates

- Game version: 0.8.6
- Wiki value: 47 Water consumed and 39.2 Waste Water produced per 1,000 population per month
- Verified game value: 48 Water consumed and 40 Waste Water produced per 1,000 population per month, before housing-tier modifiers
- Verification: installed game data (`SettlementsData`)
- Status: ready for a future wiki edit

### Biomass collection from processed food

- Game version: 0.8.6
- Wiki value: fixed biomass output ratios per consumed food
- Verified game behavior: biomass follows the source products retained through the actual production recipes, then the settlement applies a 12% biomass recovery ratio
- Verification: installed game product-source and settlement waste logic
- Status: needs recipe-path-aware wording rather than one fixed table

### Snack ingredients

- Game version: 0.8.6
- Wiki value: the Snack article prose says the recipe uses Plastic
- Verified game value: the current Corn recipe uses Sugar, Cooking Oil, and Salt; it does not use Plastic
- Verification: in-game Food Processor recipe panel
- Status: ready for a future wiki edit

### Arc Furnace II workers and electricity

- Game version: 0.8.6
- Wiki value: 18 workers and 5.5 MW
- Verified game value: 14 workers and 6 MW base consumption; scrap recipes use 0.6× power
- Verification: installed game data and in-game Arc Furnace II panel
- Status: ready for a future wiki edit

### Cooled Caster II workers

- Game version: 0.8.6
- Wiki value: 6 workers
- Verified game value: 2 workers
- Verification: installed game data and in-game Cooled Caster II panel
- Status: ready for a future wiki edit
