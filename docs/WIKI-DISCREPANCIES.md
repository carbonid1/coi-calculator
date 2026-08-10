# Wiki Discrepancies

Confirmed differences between the Captain of Industry wiki and the game data used by this calculator. Review and clear resolved entries when updating the calculator for a new game version.

Wiki login and submission workflow: to be decided.

## Pending

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
