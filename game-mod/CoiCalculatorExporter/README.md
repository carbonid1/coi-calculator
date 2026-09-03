# CoI Calculator Exporter

Local, read-only Captain of Industry mod for the calculator in this repository.

Version 0.39 exports the current game state to `coi-calculator-state.json` in
the installed mod folder. Schema 39 removes duplicate aggregate counts for
buildings, Data Centers, Water Chillers, Chicken Farms, and crop farms. The
calculator now derives those totals from each exported building record.

The snapshot includes factory areas, building settings and construction ghosts,
contracts, reserves, research, edicts, groundwater, and up to 120 completed
in-game months of Maintenance, Hydrogen fuel, and electricity history. The
current partial month is excluded.

The calculator reads the file locally. The mod does not open a port or modify
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
