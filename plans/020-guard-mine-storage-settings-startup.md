# Plan 020: A failure registering Mine Storage Control's settings tab is logged instead of escaping into the game's UI start-up

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- game-mod/MineStorageControl`
> If anything there changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW to write; can be compiled here but only proven inside the running game
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

"Mine Storage Control" is a C# mod for the game Captain of Industry. Its
settings live in a "Mod Settings" hub that several mods share. Registering a
tab in that hub can throw: the hub may be provided by another mod with a
different method signature, and the shared code reaches into a private field
of the game's HUD that a game update can rename. The sister mod in this
repository, Train Network Monitor, wraps the same calls in `try`/`catch` and
logs. Mine Storage Control does not, so the exception escapes from a callback
the game runs while starting its renderer. The mod's actual job — pausing and
resuming mining by storage level — does not need the settings tab to keep
working with rules that are already saved.

## Current state

- `game-mod/MineStorageControl/MineStorageControlMod.cs:34-45`:

  ```csharp
      public void Initialize(DependencyResolver resolver, bool gameWasLoaded)
      {
          m_events = resolver.Resolve<ISimLoopEvents>();
          m_monitor = new MineStorageMonitor(resolver.Resolve<EntitiesManager>(), JsonConfig);
          m_events.UpdateAfterCmdProc.AddNonSaveable(this, update);
          m_events.BeforeSave.AddNonSaveable(this, beforeSave);
          resolver.Resolve<IGameLoopEvents>().RegisterRendererInitState(this, delegate {
              m_ui = new MineStorageUi(m_events, m_monitor);
              m_ui.Initialize(resolver);
          });
          Log.Info("Mine Storage Control: initialized.");
      }
  ```

  The file already has `using System;` and `using Mafi;` (which provides
  `Log`).
- `game-mod/MineStorageControl/MineStorageUi.cs:28-41` — the method that can
  throw:

  ```csharp
      public void Initialize(DependencyResolver resolver)
      {
          ModSettings.EnsureInitialized(resolver.Resolve<HudController>(),
              resolver.Resolve<UiRoot>(), resolver.Resolve<IRootEscapeManager>());
          const string icon = "Assets/Unity/UserInterface/General/Configure.svg";
          ModSettings.RegisterTab(new ModSettingsTab("MineStorageControl",
              /* … */));
          Log.Info("Mine Storage Control: registered in cooperative Mod Settings hub.");
      }
  ```

  `MineStorageUi`'s constructor subscribes to a UI update event, and its
  `update()` does nothing while no panel exists, so a `MineStorageUi` whose
  `Initialize` failed is harmless and is still disposed by the mod's `Dispose`.
- The pattern to follow, `game-mod/TrainNetworkMonitor/TrainNetworkMonitorUi.cs:77-83`:

  ```csharp
          catch (Exception exception)
          {
              Log.Info(
                  "Train Network Monitor: cooperative Mod Settings hub failed; "
                  + "using standalone settings: "
                  + exception);
          }
  ```

- `game-mod/MineStorageControl/manifest.json` line 3: `"version": "0.2.0",`.
- `game-mod/MineStorageControl/changelog.txt` starts:

  ```
  v0.2.0 | 2026-11-04
  - Manage rules in the shared Mod Settings panel.
  ```

  Entries are newest first, separated by one blank line. Changelog lines are
  player-facing: short, one idea each, describing the change only.
- **Language level**: compiled by the .NET Framework 4 compiler, C# 5 only.
  Do NOT use `?.`, `$"…"`, `nameof`, expression-bodied members, `out var`,
  pattern matching or exception filters.
- Build command: `powershell -ExecutionPolicy Bypass -File scripts/build-mine-storage-control.ps1 -Test`
  compiles the mod into `game-mod/MineStorageControl/bin/Release/` (git
  ignored) and runs its rule tests. It needs the game installed. With
  `-Install` it copies the mod into the player's game folder — do NOT pass
  `-Install` or `-Package`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build and test the mod (no install) | `powershell -ExecutionPolicy Bypass -File scripts/build-mine-storage-control.ps1 -Test` | prints `Built …MineStorageControl.dll`, exit 0 |

## Scope

**In scope**:
- `game-mod/MineStorageControl/MineStorageControlMod.cs` (the renderer-init delegate only)
- `game-mod/MineStorageControl/manifest.json` (the `version` line only)
- `game-mod/MineStorageControl/changelog.txt` (one new entry)

**Out of scope** (do NOT touch):
- `game-mod/Shared/CoI.AutoHelpers.Settings.cs` — shared with other mods.
- `MineStorageUi.cs`, `MineStorageMonitor.cs`, `MineStorageRule.cs`.
- Adding a fallback settings window like Train Network Monitor's.
- Train Network Monitor and the Bridge.
- Installing or packaging the mod.

## Git workflow

- Branch: `advisor/020-guard-mine-storage-settings-startup`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Add Mine Storage Control mod`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the mod builds before any change

Run the build command.

**Verify**: it prints `Built` and exits 0.

### Step 2: Guard the settings start-up

In `game-mod/MineStorageControl/MineStorageControlMod.cs`, replace the
`RegisterRendererInitState` call with:

```csharp
        resolver.Resolve<IGameLoopEvents>().RegisterRendererInitState(this, delegate {
            m_ui = new MineStorageUi(m_events, m_monitor);
            try
            {
                m_ui.Initialize(resolver);
            }
            catch (Exception exception)
            {
                // Saved rules keep working without the settings tab.
                Log.Info("Mine Storage Control: settings unavailable: " + exception);
            }
        });
```

**Verify**: the build command prints `Built` and exits 0.

### Step 3: Version and changelog

In `game-mod/MineStorageControl/manifest.json` change `"version": "0.2.0"` to
`"version": "0.2.1"`.

At the top of `game-mod/MineStorageControl/changelog.txt` add, followed by one
blank line before the existing `v0.2.0` entry:

```
v0.2.1 | 2026-11-12
- Saved rules keep working if the Mod Settings panel cannot open.
```

**Verify**: the build command still exits 0. `git status --short` lists only
the three in-scope files.

## Test plan

No automated test is possible for a game start-up callback. Verification is
compilation plus the mod's existing rule tests (`-Test`), and an in-game check
by the maintainer (Maintenance notes).

## Done criteria

- [ ] The build command prints `Built` and exits 0
- [ ] `git grep -n "settings unavailable" -- game-mod/MineStorageControl/MineStorageControlMod.cs` → one match
- [ ] `git grep -n '"version": "0.2.1"' -- game-mod/MineStorageControl/manifest.json` → one match
- [ ] `git grep -n "^v0.2.1 | 2026-11-12$" -- game-mod/MineStorageControl/changelog.txt` → one match
- [ ] `git status --short` lists only the three in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's build fails before any change (game not installed, compiler
  missing). Report the message and stop; this plan cannot be verified without
  a build.
- The compiler rejects the code in step 2. Report the exact error; do not
  switch to newer C# syntax.
- You are about to run the build script with `-Install` or `-Package`, or to
  write outside your working directory. Don't.

## Maintenance notes

- **Needs an in-game check by the maintainer**: install the mod
  (`powershell -ExecutionPolicy Bypass -File scripts/build-mine-storage-control.ps1 -Install`),
  restart the game, and confirm the Mine Storage Control tab still appears in
  Mod Settings and rules still pause and resume mining.
- Not done here: removing the settings tab when the mod is disposed. The
  shared hub has no unregister call, and adding one changes a contract other
  mods rely on.
