# Recipe data and card presentation

## Data ownership

`createLiveAreaModules` converts assigned game recipes into calculator recipes.
The game supplies the building and recipe names, ingredients, batch quantities,
duration, assignments and physical inventory. Quantities are normalized to one
production cycle (60 game seconds).

Calculation policy is separate: demand balancing, resource priorities, dispatch
and special building behavior remain calculator responsibilities.

Nuclear uses the generated recipes through `resolveNuclearAreaRecipes`. Known
game recipe IDs receive their existing Nuclear calculation policy and stable
calculator IDs. Exported names, ingredients and rates replace catalog copies.
Additional supported recipes remain in the module, and unsupported products
remain visible as diagnostics. Shared-capacity pools and current, paused and
under-construction inventory follow the generated area.

Nuclear operation targets count every matching recipe configuration. They reuse
paused machines before adding buildings, update the entire physical pool when
unpausing a shared machine, and retain construction ghosts in projected capacity.
An unsupported exported recipe cannot be restored from the catalog by a target.

Reactors, turbine/generator dispatch and waste decay still use local models:
these machines do not export ordinary production recipes. The catalog also
remains available to legacy module callers without a generated area. It must
not be used to replace an unsupported recipe in a compatible game export.

## Presentation

- Building names identify cards. Hover, keyboard focus or tapping the title
  reveals the readable recipe description.
- Active recipe routes use resource icons with calculated quantities.
- `configurationLabel` is reserved for settings or named configurations that
  the material flow cannot convey: enrichment, throughput modes, slaughtering,
  farm groups, forestry settings and office computing boosts.
- Recipe names are not used to infer whether a configuration label is needed.
  Rows without material flows retain their descriptive text.
- Paused cards still show their configured route or setting.

## Refactor verification

The saved game export from 2026-09-09 10:52 UTC was calculated before and after
the Nuclear adapter change. All 184 factory resource totals matched. Existing
Nuclear input/output allocations matched, including spent-fuel processing and
steam priorities. The shared cooling pool now retains its Low and High Steam
recipes as well; neither runs in this export.

One load correction comes directly from the exported recipe: Yellowcake to
Blanket Fuel uses 12 Yellowcake and 4 Salt to produce 4 Blanket Fuel per cycle,
twice the throughput of the old catalog copy. Producing 3 Blanket Fuel therefore
loads 0.75 of the 2 active Chemical Plants II, while using the same ingredients.

Regression coverage includes changed exported rates, new recipes, shared
physical capacity, paused buildings, construction ghosts, unsupported products
and spent-fuel-driven reprocessing. Desktop and narrow layouts, hover, keyboard
focus and resource navigation were also checked in the browser.
