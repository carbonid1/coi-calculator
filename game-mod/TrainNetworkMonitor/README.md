# Train Network Monitor

Captain of Industry 0.8.7 mod with an optional Train Network capacity dashboard
and one grouped alert for sustained fleet jams.

## Capacity dashboard

Enable it in **Mod Settings** to see:

- Occupied / total trains.
- Busy / total Waiting bays.
- Train counts for Unit, Loose, Fluid, Molten, Universal, Mixed, and generic
  formations.

Only non-empty networks and wagon types are shown. A train is free only while
waiting for a network job. The dashboard is off by default and stops updating
when disabled.

## Jam alerts

One grouped red alert appears when at least three trains and 10% of the active
fleet remain blocked for the configured delay. Click it to cycle through the
affected trains, starting with the longest wait.

Set the delay from 1–12 in-game months and optionally pause when a new alert
starts. The alert clears when traffic recovers.

Settings are stored per save. The mod does not change train routing or behavior
and works with base-game trains and the official Trains expansion.

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
