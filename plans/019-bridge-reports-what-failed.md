# Plan 019: When the Bridge cannot produce factory data, the calculator says what failed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs game-mod/CoiCalculatorExporter/SnapshotJsonStream.cs game-mod/CoiCalculatorExporter/manifest.json app/server/read-game-state-snapshot.ts app/server/read-game-state-snapshot.test.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW for the calculator side; MED for the mod side, which can be compiled here but only proven inside the running game
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

"CoI Calculator Bridge" is a C# mod that runs inside the game Captain of
Industry and serves the factory as JSON to the calculator. It builds that JSON
from about 25 collectors, several of which deliberately throw when the game
does not look the way they expect (an unknown weather provider, a changed
research formula). Today a throw anywhere produces a bare server error, and
the calculator shows "The game could not provide calculator data. Check the
game log." — the same sentence for every cause.

A second, quieter failure: the JSON writer prints a non-finite number as bare
`NaN` or `Infinity`, which is not JSON. One division by a zero duration in
any collector makes the whole reply unparseable, and the calculator reports
"could not read this factory" with nothing pointing at the field.

After this plan the Bridge catches its own failure and answers with a small
JSON error naming the exception and where it was thrown, the writer refuses
non-finite numbers by naming the field, and the calculator shows that detail
in its existing status line.

## Current state

### Mod side (C#)

- `game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs:133-141`:

  ```csharp
      private WebRouteResponse getSnapshot()
      {
          if (m_snapshotCollector == null)
          {
              return WebRouteResponse.Error(503, "Calculator data is not ready.");
          }
          return WebRouteResponse.Json(SnapshotJsonWriter.Serialize(m_snapshotCollector.Capture()))
              .WithHeader("Cache-Control", "no-store");
      }
  ```

  The file already has `using System;` and `using Mafi.Logging;` and logs with
  `Log.Error("…" + error)` and `Log.Info("…")` (see `startServer`, lines
  88–101). Line 33: `public int Version { get { return 61; } }`.
- The game's `WebRouteResponse` type (in `Mafi.Core.dll`) has, among others,
  `Json(string body, int status)`, `Error(int status, string message)` and
  `WithHeader(string, string)`.
- `game-mod/CoiCalculatorExporter/SnapshotJsonStream.cs` — the JSON writer.
  Relevant members:

  ```csharp
      private readonly StringBuilder m_json;
      private bool m_needsComma;

      public SnapshotJsonStream(int capacity)
      {
          m_json = new StringBuilder(capacity);
      }

      public SnapshotJsonStream BeginObject() { return begin('{'); }
      public SnapshotJsonStream EndObject() { return end('}'); }

      public SnapshotJsonStream Name(string name)
      {
          appendComma();
          appendString(name);
          m_json.Append(':');
          m_needsComma = false;
          return this;
      }

      public SnapshotJsonStream Value(string value) { /* … */ }

      public SnapshotJsonStream Value(double value)
      {
          appendComma();
          m_json.Append(value.ToString("R", CultureInfo.InvariantCulture));
          return this;
      }

      public void Field(string name, string value) { Name(name).Value(value); }

      public string GetJson() { return m_json.ToString(); }
  ```

  The comment on line 6 says `// Schema 44's JSON boundary.`; the current
  schema is 56. The file has `using System.Globalization;` and
  `using System.Text;` but not `using System;`.
- `game-mod/CoiCalculatorExporter/manifest.json` line 3: `"version": "0.65.0",`.
  By this repository's convention every Bridge change bumps both this version
  and the integer `Version` in `CoiCalculatorExporterMod.cs`.
- **Language level**: the mods are compiled by the .NET Framework 4 compiler
  (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`), which accepts
  C# 5 only. Do NOT use `?.`, `$"…"` string interpolation, `nameof`,
  expression-bodied members (`=>` on methods or properties), `out var`,
  pattern matching, or exception filters. Follow the style of the surrounding
  code: explicit null checks, string concatenation, braces on their own lines.
- Build command: `powershell -ExecutionPolicy Bypass -File scripts/build-game-mod.ps1`
  compiles the mod into `game-mod/CoiCalculatorExporter/bin/Release/` (git
  ignored) and runs two small smoke programs. It needs the game installed; it
  finds it under `E:\Steam\steamapps\common\Captain of Industry`. With
  `-Install` it also copies the mod into the player's game folder — do NOT
  pass `-Install`.

### Calculator side (TypeScript)

- `app/server/read-game-state-snapshot.ts:58-70`:

  ```ts
    const [response, catalogResponse, inventoryResponse, historyResponse] = await Promise.all([
      fetchGameWebApi(SNAPSHOT_ROUTE, signal),
      fetchGameWebApi('/api/v1/products?includeLocked=true', signal),
      fetchGameWebApi('/api/v1/products/stats?series=quantity,stored,storageCapacity', signal),
      fetchGameWebApi('/api/v1/products/history?ids=Product_Hydrogen&resolution=month&series=consumedAsFuel&count=120', signal),
    ])

    if (response.status === 404) {
      return unavailable(404, 'Enable CoI Calculator Bridge in the loaded game.')
    }
    if (!response.ok || !catalogResponse.ok || !inventoryResponse.ok || !historyResponse.ok) {
      return unavailable(502, 'The game could not provide calculator data. Check the game log.')
    }
  ```

  `response` is the Bridge's reply; the other three come from the game itself.
  The file uses single quotes and no semicolons.
- `app/server/read-game-state-snapshot.test.ts` drives the reader with a
  mocked `fetch`. `bridgeReply` is a `vi.fn` returning the Bridge's `Response`.
  Existing tests to keep passing unchanged:

  ```ts
  it('reports an upstream collection failure without returning older data', async () => {
    await read()
    bridgeReply.mockReturnValueOnce(new Response(null, { status: 500 }))
    expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null, status: 'error' })
  })
  ```

  and `logs each new failure reason once and again after a recovery`, which
  expects the logged sentence to contain `Check the game log` for a bodiless
  500.
- The browser hook truncates any error sentence to 200 characters before
  showing it, and React escapes it; nothing else needs to change for the
  detail to appear in the status line.
- Player-facing copy rules for this repository: concise, exact mod name
  ("CoI Calculator Bridge"), no internal terms like "snapshot".

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Build the mod (no install) | `powershell -ExecutionPolicy Bypass -File scripts/build-game-mod.ps1` | prints `Built …CoiCalculatorExporter.dll`, exit 0 |
| Reader tests | `pnpm exec vitest run app/server` | all pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `game-mod/CoiCalculatorExporter/SnapshotJsonStream.cs`
- `game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs` (`getSnapshot` and the `Version` number only)
- `game-mod/CoiCalculatorExporter/manifest.json` (the `version` line only)
- `app/server/read-game-state-snapshot.ts`
- `app/server/read-game-state-snapshot.test.ts`

**Out of scope** (do NOT touch):
- The collectors themselves and their divisions. This plan makes failures
  visible; it does not decide what each collector should do with a zero.
- `getIslandMap` and `getFactoryLayout` in the same C# file.
- Installing the mod, starting the game, or touching anything under
  `%APPDATA%\Captain of Industry`.
- The schema version (stays 56): the successful reply does not change shape.
- `app/game-state.ts` and the browser hook.

## Git workflow

- Branch: `advisor/019-bridge-reports-what-failed`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Name the mismatch behind a rejected Bridge reply`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the mod builds before any change

Run the build command.

**Verify**: it prints `Built` and exits 0. If it fails before you changed
anything, see STOP conditions.

### Step 2: The writer refuses non-finite numbers and names the field

In `game-mod/CoiCalculatorExporter/SnapshotJsonStream.cs`:

1. Add `using System;` as the first line.
2. Change the comment on line 6 to `// The snapshot's JSON boundary. Field writers do not manage separators or escaping.`
3. Add a field below `private bool m_needsComma;`:

   ```csharp
       private string m_lastName;
   ```

4. In `Name(string name)`, add `m_lastName = name;` as the first statement.
5. Replace `Value(double value)` with:

   ```csharp
       public SnapshotJsonStream Value(double value)
       {
           // NaN and Infinity are not JSON; one of them makes the whole reply unreadable.
           if (double.IsNaN(value) || double.IsInfinity(value))
           {
               throw new InvalidOperationException(
                   "Non-finite number in field \"" + (m_lastName ?? "?") + "\".");
           }
           appendComma();
           m_json.Append(value.ToString("R", CultureInfo.InvariantCulture));
           return this;
       }
   ```

**Verify**: the build command exits 0.

### Step 3: The Bridge answers its own failures with a JSON error

In `game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs`, replace
`getSnapshot` with:

```csharp
    private WebRouteResponse getSnapshot()
    {
        if (m_snapshotCollector == null)
        {
            return WebRouteResponse.Error(503, "Calculator data is not ready.");
        }
        try
        {
            return WebRouteResponse.Json(SnapshotJsonWriter.Serialize(m_snapshotCollector.Capture()))
                .WithHeader("Cache-Control", "no-store");
        }
        catch (Exception exception)
        {
            // One collector failing must say which, instead of a bare server error.
            Log.Error("CoI Calculator Bridge: could not capture factory data: " + exception);
            var site = exception.TargetSite;
            string source = site == null ? null
                : (site.DeclaringType == null ? "" : site.DeclaringType.Name + ".") + site.Name;
            SnapshotJsonStream error = new SnapshotJsonStream(256);
            error.BeginObject();
            error.Field("error", exception.GetType().Name + ": " + exception.Message);
            error.Field("source", source);
            error.EndObject();
            return WebRouteResponse.Json(error.GetJson(), 500).WithHeader("Cache-Control", "no-store");
        }
    }
```

Change the version on line 33 from `61` to `62`, and in
`game-mod/CoiCalculatorExporter/manifest.json` change `"version": "0.65.0"` to
`"version": "0.65.1"`.

**Verify**: the build command prints `Built` and exits 0, with no new compiler
warning mentioning `CoiCalculatorExporterMod.cs` or `SnapshotJsonStream.cs`.

### Step 4: The calculator shows the Bridge's detail

In `app/server/read-game-state-snapshot.ts`:

1. Above `const requestSnapshot`, add:

   ```ts
   /** The Bridge names its own failure as { error, source }; anything else is not from the Bridge. */
   const readBridgeFailure = async (response: Response): Promise<string | null> => {
     const body: unknown = await response.json().catch(() => null)

     if (typeof body !== 'object' || body === null || !('error' in body)) return null
     if (typeof body.error !== 'string' || body.error.length === 0) return null
     const source = 'source' in body && typeof body.source === 'string' && body.source.length > 0
       ? ` (${body.source})` : ''

     return `${body.error}${source}`.slice(0, 160)
   }
   ```

2. Between the `response.status === 404` block and the combined
   `if (!response.ok || …)` block, insert:

   ```ts
     if (!response.ok) {
       const failure = await readBridgeFailure(response)

       if (failure) return unavailable(502, `CoI Calculator Bridge failed: ${failure}`)
     }
   ```

   Leave the combined block as it is: a Bridge failure without a readable
   detail, and failures of the game's own routes, still give the existing
   sentence.

**Verify**: `pnpm ts` exits 0.

### Step 5: Test the calculator side

In `app/server/read-game-state-snapshot.test.ts`, directly after the test
`reports an upstream collection failure without returning older data`, add:

```ts
it('shows what the Bridge says failed, and falls back when it says nothing usable', async () => {
  bridgeReply.mockReturnValueOnce(Response.json(
    { error: 'InvalidOperationException: Unsupported weather provider', source: 'GameSnapshotCollector.getWeatherSnapshot' },
    { status: 500 },
  ))
  expect(await read()).toMatchObject({
    httpStatus: 502, snapshot: null, status: 'error',
    error: 'CoI Calculator Bridge failed: InvalidOperationException: Unsupported weather provider (GameSnapshotCollector.getWeatherSnapshot)',
  })
  bridgeReply.mockReturnValueOnce(Response.json({ error: 'x'.repeat(500) }, { status: 500 }))
  expect((await read()).error).toHaveLength('CoI Calculator Bridge failed: '.length + 160)
  for (const reply of [Response.json({ error: 7 }, { status: 500 }), Response.json({}, { status: 500 }), new Response('<html>', { status: 500 })]) {
    bridgeReply.mockReturnValueOnce(reply)
    expect(await read()).toMatchObject({ httpStatus: 502, error: 'The game could not provide calculator data. Check the game log.' })
  }
})
```

**Verify**: `pnpm exec vitest run app/server` → all pass, including the new
test and the two existing tests named in "Current state". `pnpm lint` exits 0.

## Test plan

- Calculator side: one new test in `app/server/read-game-state-snapshot.test.ts`
  covering the detail being shown, being capped at 160 characters, and three
  shapes of unusable reply falling back to the existing sentence.
- Mod side: there is no unit-test harness for code that needs the running
  game. Verification here is compilation plus the two existing smoke programs
  the build script runs. The behaviour inside the game must be confirmed by
  the maintainer — see Maintenance notes.

## Done criteria

- [ ] The build command prints `Built` and exits 0
- [ ] `git grep -n "Non-finite number in field" -- game-mod/CoiCalculatorExporter/SnapshotJsonStream.cs` → one match
- [ ] `git grep -n "could not capture factory data" -- game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs` → one match
- [ ] `git grep -n '"version": "0.65.1"' -- game-mod/CoiCalculatorExporter/manifest.json` → one match
- [ ] `git grep -n "return 62" -- game-mod/CoiCalculatorExporter/CoiCalculatorExporterMod.cs` → one match
- [ ] `pnpm exec vitest run app/server` passes with 1 new test
- [ ] `pnpm ts` and `pnpm lint` exit 0
- [ ] `git status --short` lists only the five in-scope files (plus `plans/README.md`); nothing under `game-mod/**/bin/` is tracked
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's build fails before any change (game not installed, compiler
  missing). Report the message. You may still complete steps 4–5, which need
  no game; say clearly in your report that steps 2–3 were not compiled.
- The compiler rejects the C# in steps 2–3. Report the exact error and line.
  Do not rewrite the code with newer C# syntax.
- `WebRouteResponse.Json` does not accept a status code as its second
  argument, or `Log.Error` does not accept a string.
- An existing test in `app/server` fails after step 4.
- You are about to run the build script with `-Install`, start the game, or
  write outside your working directory. Don't.

## Maintenance notes

- **Needs an in-game check by the maintainer.** After merging: run
  `pnpm game-mod:install`, restart the game, load the factory, and confirm the
  calculator still syncs. The error path can be seen by temporarily loading a
  mod that replaces the weather provider, or simply trusted from the code.
- The mod's manifest version and `Version` number were bumped; the calculator
  accepts any Bridge that sends schema 56, so an older installed Bridge keeps
  working, just without the new detail.
- The detail is an exception message meant for the person maintaining the
  Bridge. If players other than the maintainer start using the mod, consider
  mapping the common causes to plain sentences.
- Not done here: guarding each division by a prototype duration in the
  collectors (`OfficeFocusDefinitionSnapshot.cs:49`,
  `PlanningDefinitionSnapshot.cs:201`, `WorldMineSnapshotCollector.cs:27` and
  `:91-92`, `AreaEntitySnapshotCollector.cs:28`, `FactoryDefinitionSnapshot.cs:42`).
  With this plan such a case reports the field name; whether to skip the entry
  or fail is a game-data decision.
