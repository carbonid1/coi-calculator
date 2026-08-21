# Train Traffic Monitor

Standalone Captain of Industry 0.8.7 mod that raises a continuous critical
notification when the train fleet is traffic-jammed.

A train counts as stuck only when it has remained in `Waiting for free track`,
`Waiting for super block`, or `Waiting for bidirectional super block` for the
configured number of production cycles. The default is one cycle. The red alert
starts when the stuck count reaches both three trains and 10% of active, spawned
trains. It clears automatically when the stuck count drops below that threshold.

The in-game settings button opens two save-scoped settings:

- `stuck_after_cycles` controls the whole number of production cycles a train
  must wait before it counts as stuck.
- `pause_on_red_alert` is disabled by default. When enabled, the mod pauses once
  as this mod's traffic-jam red alert begins. Other game alerts are unaffected.

The mod never resumes the game automatically, and manually resuming while the
same alert remains active does not immediately pause the game again.

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
