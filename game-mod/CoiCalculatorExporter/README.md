# CoI Calculator Exporter

Local, read-only Captain of Industry mod for the calculator in this repository.

Version 0.41 adds world mines, cargo operation and fuel, and Sulfur reserves
in train-linked storage or storage with assigned incoming routes.
The calculator follows mine, ship, and module pauses independently.
The calculator requires schema 41. Restart the game after installing this update.

The snapshot includes factory areas, building settings and construction ghosts,
contracts, reserves, research, edicts, groundwater, and up to 120 completed
in-game months of Maintenance, Hydrogen fuel, and electricity history. The
current partial month is excluded.

The calculator reads `coi-calculator-state.json` from the installed mod folder.
The mod does not open a port or modify
gameplay state. Captain of Industry may record the enabled mod in save metadata;
the manifest allows the mod to be removed again.

Build from the repository root:

```powershell
.\scripts\build-game-mod.ps1
```

Build and install to `%APPDATA%\Captain of Industry\Mods\CoiCalculatorExporter`:

```powershell
.\scripts\build-game-mod.ps1 -Install
```
