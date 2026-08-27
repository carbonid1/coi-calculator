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

The detailed description is intentionally written around the real use case: a rail-based island with many interdependent routes, where a local blockage can cascade through the wider logistics network before the player notices. It says "traffic jam" and "sustained congestion" rather than claiming to prove a graph-theoretic deadlock.

## Portal images

- `Thumbnail.png` — 512 × 512 card image bundled in the release ZIP.
- `portal-assets/traffic-jam-alert.png` — gameplay screenshot showing the grouped `(4x)` alert and paused game.
- `portal-assets/rail-network-overview.png` — context screenshot showing the dense, intermingled rail logistics that motivated the mod.
- A fresh screenshot of the Train Network Monitor tab in the shared Mod Settings window is still worth adding after the final game restart. Do not use the older screenshot that only shows Kayser's tabs.

Recommended image order: generated thumbnail, live alert screenshot, settings screenshot, rail-network overview.

## Before upload

1. In the save's **Mods & DLCs** screen, add `Train Network Monitor`, then load a representative existing save.
2. Verify the mod appears as version 0.3.8, the settings tab opens, the alert counter updates, alert clicks focus affected trains, and optional pausing happens only once per new jam.
3. Verify the game log contains no mod exceptions.
4. Upload `Builds/TrainNetworkMonitor-0.3.8.zip` to COI Hub, select the state, tags, and license above, add the screenshots, preview the page, and publish.

The bundled `CoI.AutoHelpers.Settings.LICENSE.txt` must remain in every release because the shared settings helper is MIT-licensed code by Kayser.
