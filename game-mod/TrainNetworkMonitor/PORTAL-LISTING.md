# Train Network Monitor — COI Hub listing

## Upload choices

- State: **Beta** while the first public release is battle-tested.
- Tags: **Quality of Life**, **Trains**, **UI**.
- Source license: **MIT**. The mod's own `LICENSE.txt` and Kayser's separate helper attribution must both remain in every release.
- Hub terms: uploading also licenses the uploaded content under the COI Hub's required **CC BY 4.0** user-content terms. This coexists with the MIT source license.
- Source code: `https://github.com/carbonid1/coi-calculator/tree/main/game-mod/TrainNetworkMonitor`
- Support and feedback: `https://github.com/carbonid1/coi-calculator/issues`

The Hub reads the title, short description, detailed HTML description, game versions, dependencies, authors, and source link from `manifest.json`. It reads the release notes from `changelog.txt` and the square card image from `Thumbnail.png`.

## Changelog format

Keep the full history in one `changelog.txt`, newest first. Start each version
with a heading on its own line in this format, followed by that version's changes:

```text
v0.4.2 | 2026-11-02
- Updated for Captain of Industry 0.8.8 (Update 4.3).

v0.4.1 | 2026-08-30
- Dashboard can now be disabled and is off by default.
```

Bare headings such as `0.4.1` are not recognized as separate entries; the notes
then accumulate under the latest version. No separate file per release is needed.
Use release dates, not the date a changelog-format correction was made.

This matches the published changelogs and shipped `changelog.txt` files in
[Storage++](https://coigame.com/Mod/10/Storage) and
[Kayser's Automatic Terrain Designations](https://coigame.com/Mod/4/Kaysers-Automatic-Terrain-Designations).
The build checks that the first heading matches the manifest version and includes
an ISO date. Before upload, preview both **Changelog** and **Versions** and check
that each entry contains only its own changes.

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

## 0.4.2 validation — 2026-11-02

Target: Captain of Industry 0.8.8 (Update 4.3), build 627.

- Built against the installed game's assemblies. All 163 referenced Mafi API
  members resolve against those assemblies.
- Loaded the existing `Save 2026-09-09, 13-52-21` with the Trains expansion and
  Kayser's Forestry and Terrain mods, with CoiCalculatorExporter deselected.
- Opened the shared Mod Settings tab. Saved dashboard, delay, and pause settings
  were retained.
- Opened the dashboard: 41/43 occupied trains, 2/18 busy Waiting bays, Unit
  11/11, Loose 16/18, Fluid 14/14. The train breakdown sums to the fleet totals.
- Disabled the dashboard while open: its window closed and toolbar button
  disappeared. Re-enabled it and restored the save's original setting.
- Quit the paused verification session without overwriting the save. The complete
  session log contains no Train Network Monitor exceptions or initialization
  failures. The base game logged its existing non-critical waypoint-count
  assertion for train 16 during save migration.
- Verified all eight ZIP entries against their source files, including both
  licenses, and verified that the installed DLL matches the packaged DLL.
- Ran the installed game's changelog parser against the original file and the
  corrected ZIP's changelog: one combined entry before, six release entries after.
  Version 0.4.2 contains only its three changes.

Archive: `Builds/TrainNetworkMonitor-0.4.2.zip` (798691 bytes).
SHA-256: `baf87458a31b43f1ba2fa806c22fb2564c5510e9d0b1fed3b5b5c917c6673d74`.

Still to exercise before upload: sustained jam alerts, cycling affected trains,
one-time pausing, live dashboard refresh during simulation, and wagon formations
absent from this save. The compatibility session remained paused.

The game warns that the existing notification localization IDs need the mod ID
prefix for Update 5. Keep the current notification proto IDs for this 4.3 patch;
handle that migration separately.

## Before upload

1. In the save's **Mods & DLCs** screen, add `Train Network Monitor`, then load a representative existing save.
2. On Captain of Industry 0.8.8 (Update 4.3), verify the mod appears as version 0.4.2, the dashboard is disabled by default, and no dashboard toolbar button is visible until it is enabled in Mod Settings.
3. Enable the dashboard and verify it shows only non-empty Train Networks with correct Waiting bay, Unit, Loose, Fluid, Molten, Universal, Mixed, and generic counts. Disable it again and verify its open window closes and its toolbar button disappears.
4. Verify the settings tab opens, the alert counter updates, alert clicks focus affected trains, and optional pausing happens only once per new jam.
5. Verify the game log contains no mod exceptions.
6. Upload `Builds/TrainNetworkMonitor-0.4.2.zip` to COI Hub, select the state, tags, and license above, add the screenshots, preview the page, and publish.

The bundled `CoI.AutoHelpers.Settings.LICENSE.txt` must remain in every release because the shared settings helper is MIT-licensed code by Kayser.
