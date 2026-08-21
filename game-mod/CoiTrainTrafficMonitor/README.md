# Train Traffic Monitor

Standalone Captain of Industry 0.8.7 mod that raises a continuous critical
notification when the train fleet is traffic-jammed.

A train counts as stuck only when it has remained in `Waiting for free track`,
`Waiting for super block`, or `Waiting for bidirectional super block` for the
configured number of in-game months, from one month up to one in-game year
(12 months). The default is one month. The red alert
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
other Captain of Industry mods. Train Traffic Monitor joins an existing hub or
creates it when loaded first, so compatible mods share one button and window.
The standalone settings button remains as a fallback if the cooperative hub
cannot initialize.

The mod changes no train behavior. It stores only these two settings in the
save and can be used without the CoI Calculator Exporter.

Build from the repository root:

```powershell
.\scripts\build-train-traffic-mod.ps1
```

Build and install to `%APPDATA%\Captain of Industry\Mods\CoiTrainTrafficMonitor`:

```powershell
.\scripts\build-train-traffic-mod.ps1 -Install
```
