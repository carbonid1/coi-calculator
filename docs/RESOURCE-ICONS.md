# Resource icons

The images in `public/resource-icons` are Captain of Industry UI artwork from the
local game installation, extracted from its `icons_0a28` and `general_0b50` asset bundles. They are
game assets, not original calculator artwork. The explicit registry is
`app/db/resource-icons.json`; it records each Unity asset path. No recipe rates
or game behavior are changed by extraction.

205 resources have mapped icons. Rocket II retains its name until its exact UI
asset is confirmed. Do not substitute a similarly named asset for an unverified product.

The following non-obvious mappings were verified against the installed game's
`Mafi.Base.dll`, in the `Mafi.Base.Ids.Products` static initializer:

| Calculator resource | Game UI asset |
| --- | --- |
| Compost | `Assets/Base/Products/Icons/Digestate.svg` |
| Recyclables | `Assets/Base/Products/Icons/MetalScrap128.png` |
| Computing | `Assets/Unity/UserInterface/General/Computing128.png` |
| Uranium Ore Powder | `Assets/Base/Products/Icons/UraniumOreCrushed.svg` |

The game explicitly labels `UraniumOreCrushed` as “Uranium ore powder”.
Recyclables uses the loose scrap icon; pressed recyclables is a separate product.

To regenerate with Python and [UnityPy](https://github.com/K0lb3/UnityPy) installed:

```powershell
python scripts/extract-resource-icons.py 'E:/Steam/steamapps/common/Captain of Industry'
```

The script reads the installation and writes only the mapped PNGs in this
repository. If a game update changes a bundle or asset path, extraction fails
rather than guessing a replacement. A future exporter can expose
`ProductProto.Gfx.IconPath` for exact matching after game initialization.

## Display rules

- Compact resource amounts and recipe routes use `ResourceToken` with name
  tooltips on hover or keyboard focus. A missing or failed image falls back
  to its name. Production cards use `RecipeFlow`: amounts centered underneath
  icons in a horizontal row, with no timing label. Long recipes wrap, keeping
  each operator with its following resource. Rain-adjusted water shows the
  import amount, with gross demand preserved in its tooltip.
- Number widths do not include the icon's horizontal padding; longer quantities
  can share the gaps between icons without forcing an otherwise fitting row to wrap.
- Decay storage uses the regular production card and its calculated fractional
  load. Its sustainable input limit is available on the input tooltip and on
  the building title, including while idle.
- Clicking a resource opens Resource supply. Within that view, clicks extend its
  existing trail; producer input links use the input's actual supply scope.
  Electricity and Computing open Factory Total for their demand and capacity.
- Use `named` tokens in searches, selected resource headings, or inside existing
  buttons and links. Named tokens are inert by default and never nest another
  control. Standalone named tokens can opt into navigation with `interactive`.
- Keep module names, building names, and readable blocker explanations.
- Pressure and tier names appear only in tooltips, without labels beside icons.
- `RecipeLabel` uses structured recipe resource IDs. Recipe descriptions become
  icons. `configurationLabel` explicitly retains settings such as enrichment,
  pump throughput, slaughtering, farm groups and office computing boosts. Display
  names are never parsed to decide whether a setting should appear.
- Production cards omit repeated material headings when their amount rows already
  identify the route. Hover, focus or tap the building title to read its recipe
  description. Paused cards still identify their configured recipe.
- Resource supply recipe tooltips show the calculated amounts for every input and
  output, including zero. Authored configuration labels reveal the full flow list.
  There is no separate recipe input-details list. Routine exhausted-input messages
  are hidden; shortage traces remain, with blocked-increase amounts in their tooltips.
