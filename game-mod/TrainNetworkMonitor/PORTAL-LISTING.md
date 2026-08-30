# Train Network Monitor — COI Hub listing

## Upload choices

- State: **Beta** while the first public release is battle-tested.
- Tags: **Quality of Life**, **Trains**, **UI**.
- Source license: **MIT**. The mod's own `LICENSE.txt` and Kayser's separate helper attribution must both remain in every release.
- Hub terms: uploading also licenses the uploaded content under the COI Hub's required **CC BY 4.0** user-content terms. This coexists with the MIT source license.
- Source code: `https://github.com/carbonid1/coi-calculator/tree/main/game-mod/TrainNetworkMonitor`
- Support and feedback: `https://github.com/carbonid1/coi-calculator/issues`

The Hub reads the title, short description, detailed HTML description, game versions, dependencies, authors, and source link from `manifest.json`. It reads the release notes from `changelog.txt` and the square card image from `Thumbnail.png`.

## Listing story

The detailed description leads with direct, human-readable Train Network capacity
visibility and retains the original traffic-jam alert story. It says "traffic
jam" and "sustained congestion" rather than claiming to prove a
graph-theoretic deadlock.

## Portal images

- `Thumbnail.png` — 512 × 512 card image bundled in the release ZIP.
- A fresh dashboard screenshot showing multiple non-empty networks, Waiting bay ratios, Universal wagons, and at least one free train.
- `portal-assets/traffic-jam-alert.png` — gameplay screenshot showing the grouped `(4x)` alert and paused game.
- `portal-assets/rail-network-overview.png` — context screenshot showing the dense, intermingled rail logistics that motivated the mod.
- A fresh screenshot of the Train Network Monitor tab in the shared Mod Settings window is still worth adding after the final game restart. Do not use the older screenshot that only shows Kayser's tabs.

Recommended image order: generated thumbnail, dashboard screenshot, live alert screenshot, settings screenshot, rail-network overview.

## Before upload

1. In the save's **Mods & DLCs** screen, add `Train Network Monitor`, then load a representative existing save.
2. Verify the mod appears as version 0.4.1, the dashboard is disabled by default, and no dashboard toolbar button is visible until it is enabled in Mod Settings.
3. Enable the dashboard and verify it shows only non-empty Train Networks with correct Waiting bay, Unit, Loose, Fluid, Molten, Universal, Mixed, and generic counts. Disable it again and verify its open window closes and its toolbar button disappears.
4. Verify the settings tab opens, the alert counter updates, alert clicks focus affected trains, and optional pausing happens only once per new jam.
5. Verify the game log contains no mod exceptions.
6. Upload `Builds/TrainNetworkMonitor-0.4.1.zip` to COI Hub, select the state, tags, and license above, add the screenshots, preview the page, and publish.

The bundled `CoI.AutoHelpers.Settings.LICENSE.txt` must remain in every release because the shared settings helper is MIT-licensed code by Kayser.
