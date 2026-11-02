# CoI Calculator Bridge

Connects the calculator to Captain of Industry 0.8.8 (Update 4.3).

Version 0.42 supplies factory data through the game's local web server.
Restart the game after installing this update and enable **CoI Calculator Bridge**
when loading your factory. The installed folder is still named `CoiCalculatorExporter`.

The snapshot includes factory areas, building settings and construction ghosts,
contracts, reserves, research, edicts, groundwater, and up to 120 completed
in-game months of Maintenance, Hydrogen fuel, and electricity history. The
current partial month is excluded.

The bridge starts the game's web server at port **3073** when a game is loaded,
unless it is already running. It supplies current data on request, including
while the game is paused. It does not write an export file.

Start the calculator with `pnpm dev`, then open [localhost:3000](http://localhost:3000).
For a game server running on another port, set `COI_WEB_API_URL` in the calculator's
`.env.local`, for example `COI_WEB_API_URL=http://127.0.0.1:3099`, and restart the calculator.

The bridge uses the game's local server and does not change factory settings.
Captain of Industry may record the enabled mod in save metadata; it can be
removed from an existing save.

Build from the repository root:

```powershell
.\scripts\build-game-mod.ps1
```

Build and install to `%APPDATA%\Captain of Industry\Mods\CoiCalculatorExporter`:

```powershell
.\scripts\build-game-mod.ps1 -Install
```
