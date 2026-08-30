# Train Network Monitor

Standalone Captain of Industry 0.8.7 mod with a live Train Network capacity
dashboard and a continuous critical notification for fleet-wide traffic jams.

The toolbar dashboard shows only non-empty Train Networks. Each network reports
occupied / total trains, busy / total Waiting bays, and occupied / total trains
for every wagon type present: Unit, Loose, Fluid, Molten, Universal, Mixed, or
an unlabeled generic train row when no cargo-wagon type applies. A train is free
only while it is waiting for a network job; dispatched, returning, refueling,
paused, and otherwise unavailable trains count as occupied. The dashboard keeps
no history, makes no capacity decisions, and uses no warning thresholds.

A train counts as stuck only when it has remained in `Waiting for free track`,
`Waiting for super block`, or `Waiting for bidirectional super block` for the
configured number of in-game months, from one month up to one in-game year
(12 months). The default is one month. The monitor times each uninterrupted
wait itself and resets that train's timer whenever it leaves those states, so
separate routine queue waits are never added together. The red alert
starts when the stuck count reaches both three trains and 10% of active, spawned
trains. It clears automatically when the stuck count drops below that threshold.
The alert panel groups all affected trains into one visible row with an `(Nx)`
counter. Clicking the row cycles the camera through the currently stuck trains,
starting with the longest-waiting train when a new jam begins.

The cooperative in-game **Mod Settings** button opens two save-scoped settings:

- `stuck_after_cycles` controls the whole number of in-game months a train must
  wait before it counts as stuck. The key retains its original name for save
  compatibility.
- `pause_on_red_alert` is disabled by default. When enabled, the mod pauses once
  as this mod's traffic-jam red alert begins. Other game alerts are unaffected.

The mod never resumes the game automatically, and manually resuming while the
same alert remains active does not immediately pause the game again.

The settings hub follows the `CoI.AutoHelpers.Settings` convention used by
other Captain of Industry mods. Train Network Monitor joins an existing hub or
creates it when loaded first, so compatible mods share one button and window.
The standalone settings button remains as a fallback if the cooperative hub
cannot initialize.

The mod changes no train behavior. The dashboard stores no data, and only the
two alert settings are stored in the save. The mod can be used without the CoI
Calculator Exporter and works with the base game's trains and with trains added
by the official Trains expansion.

Build from the repository root:

```powershell
.\scripts\build-train-network-monitor.ps1
```

Build and install to `%APPDATA%\Captain of Industry\Mods\TrainNetworkMonitor`:

```powershell
.\scripts\build-train-network-monitor.ps1 -Install
```

Build the COI Hub upload ZIP without installing it:

```powershell
.\scripts\build-train-network-monitor.ps1 -Package
```

The upload archive is written to `Builds/TrainNetworkMonitor-<version>.zip`.

## License and attribution

Train Network Monitor is licensed under the MIT License; see `LICENSE.txt`.
The bundled cooperative settings helper remains covered by Kayser's separate
MIT notice in `CoI.AutoHelpers.Settings.LICENSE.txt`.

Train Network Monitor is an unofficial, community-made mod for Captain of
Industry. Captain of Industry, MaFi Games, and related names and assets belong
to their respective owners. This mod is not affiliated with or endorsed by
MaFi Games.

## Support and feedback

Report bugs, ask questions, or suggest features through
[GitHub Issues](https://github.com/carbonid1/coi-calculator/issues).
