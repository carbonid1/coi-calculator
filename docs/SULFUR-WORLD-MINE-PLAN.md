# Sulfur world-mine sync and burst deliveries

Implementation plan, prepared 2026-09-07; implemented in this worktree on the same date. The original investigation and acceptance criteria are retained below.

Worktree: `E:/Repos/coi-calculator-worktrees/sulfur-world-mine`  
Branch: `codex/sulfur-world-mine`  
Starting commit: `ad111f0`

## Implementation status

- Exporter 0.41 / schema 41 captures individual world mines, shared cargo operations, actual assigned workers and mine Unity, effective trip fuel, voyage timing, module transfer and power, inventories, and storage connectivity. The app rejects older snapshots.
- Removed the infinite Sulfur mine recipe. Production and shipping now feed factory supply independently; ordinary island Sulfur storage supplies the remaining demand. Train-linked and incoming-route storage counts, once per entity.
- Current cargo fuel enters factory demand. Its weighted contribution is removed from rolling Hydrogen history before inserting modeled shipping costs. Cargo equipment is claimed once; its assigned workers and observed electricity are included separately. Maintenance continues to use observed rolling history.
- Burst deliveries preserve surplus above demand and expose a finite offshore-buffer horizon. Multiple mines and depots share production and inventory. Partial manual pickups pay for a complete voyage, and mixed products share that voyage. Enabled mine-buffer capacity limits recurring pickups.
- Mines and Reserves show operating state, production, offshore/onboard/shore inventory, workers, Unity, fuel, reserve draw/growth, and runway in production cycles and in-game years. Derived rates remain neutral.
- All 609 tests pass across 100 test files, including on/off/on reserve fallback, shared cargo/fuel, first-voyage uncertainty, missing fuel, partial pickup, full shore storage, different module counts/products/fuels, and malformed snapshots. TypeScript and changed-file lint pass. The production app and exporter both build. An exporter serialization smoke check round-trips world cargo and storage against the TypeScript fixture.
- Browser verification uses an isolated schema-41 fixture and server. Verified navigation, live fixture updates, burst surplus, linked Sulfur reserves, off-state draw, and first-voyage unavailable rates. No browser errors or framework error overlay were reported.

### Projection boundaries and remaining live validation

Delivery values are estimates for the current operating configuration, using observed travel timing plus full-module transfer time. A partial load can unload faster; these are not individual arrival predictions. Finite onboard cargo and Cargo Depot stock are displayed separately and are not invented as permanent recurring production. Their transfer into ordinary island storage is reflected by subsequent game exports. The burst horizon concerns the additional offshore stock, not the player's eventual 200k target.

Merged into main on 2026-09-07 and installed exporter 0.41. The merged branch passes 644 tests; the main checkout, including its existing local work, passes 666 tests and TypeScript. Local edits were preserved and the dev server was kept running.

Restarting the game and real save on/off/on validation remain pending; the running game still exports schema 40 until it reloads the exporter. Synthetic browser fixtures and the serializer smoke check do not substitute for that live acceptance step. The previous exporter was backed up before installation, and the save was not changed.

## Intended behavior

Use the game as the authority for mine operation, cargo configuration, workers, Unity, fuel, and stored Sulfur. When imports stop, remaining factory demand draws from eligible island reserves. When imports resume, delivered supply displaces reserve draw and excess delivery builds the stockpile. The user confirmed that the sulfur stockpile will use train-linked storage or assigned incoming truck routes; both must count.

Support repeated manual on/off operation in the game. The calculator follows those changes through its existing sync flow. It does not control the game or automatically stop a mine at a stockpile threshold.

The intended eight-module burst configuration and 200k+ island stockpile are acceptance scenarios. Do not encode a depot ID, mine count, production level, module count, fuel choice, stockpile balance, delivery rate, or stop threshold for this save.

## Findings from the original implementation

| Area | Current behavior | Required change |
| --- | --- | --- |
| Mines | `app/db/modules/mines.ts` always includes one `sulfur-world-mine`; its recipe is an unbounded demand source with no inputs. | Remove the assumed mine and derive supply from synced production and cargo. Keep terrain disposal separate. |
| Exporter | `ContractSnapshotCollector.cs` skips every depot without an assigned contract. No world-mine state is exported. | Capture world mines and world-cargo depots, including inactive sites/routes. |
| Reserves | The catalog, exporter tracking list, and normalizer recognize only Gold and Fuel Gas; linked/incoming-route storages are excluded. | Add Sulfur through the reserve pipeline and include its train-linked/incoming-route island storages. |
| Cargo costs | Contract routes expose crew, modules, trip fuel, and journey duration. Their calculated fuel is displayed but not inserted into factory demand. | Reuse common cargo data while adding fuel demand exactly once. |
| Hydrogen | `resolvePlanningBaselines` uses total rolling hydrogen-fuel history, including cargo ships; the nuclear module receives that demand. | Replace the modeled shipping share of history before adding current shipping demand. |
| Entity ownership | Contract entity IDs are excluded from generic area/production modeling. | Extend ownership to world-cargo equipment and world mines; reconcile the vehicle-worker aggregate too. |
| Research/focus | Research is synced, but the placeholder mine does not use it. World Mines & Rigs focus is marked unmodeled. | Read the mine's effective game output; do not apply research/focus twice. |
| Compatibility | Exporter and app currently require schema 40. | Update the complete schema contract and invalidate incompatible saved calculations. |

## Installed-game evidence

Verified against the installed **v0.8.7a, build 614**, identified in the current game log and installed changelog. Inspected `Mafi.Core.dll` and `Mafi.Base.dll` under `E:/Steam/steamapps/common/Captain of Industry/Captain of Industry_Data/Managed`.

- `WorldMapManager.Mines` exposes individual mine entities. `WorldMapMine` exposes repair state, pause state, installed level, production step, required workers, current state, buffer, effective output, production penalty, and Unity consumption.
- `WorldMapMineProto` supplies output quantity/duration, production limits, level-dependent costs, Unity, and finite/unlimited deposit information. Sulfur's installed base output is 54 per production cycle per production step, with a maximum step of 8. These are audit observations, not proposed calculator constants.
- `WorldMapMine.GetProducedWithBonus(step)` includes the game's effective efficiency property. Runtime production additionally applies a low-Unity penalty and accumulates fractional bonus output. Current output and theoretical capacity must remain distinguishable.
- Paused, missing-worker, depleted, and full-buffer states differ. `MonthlyUnityConsumed` is state-dependent; full storage stops production and does not justify discarding assigned workers. Export the actual values rather than deriving every cost from one Boolean.
- `WorldMapCargoManager` pools mine cargo by product and accounts for ship reservations. It can collect an existing buffer from a paused mine. Do not invent a one-depot-to-one-mine relationship.
- `CargoShipWorldCargoJobProvider` normally waits for sufficient available cargo. Manual departure can collect a partial load. Its capacity calculation also accounts for available mine-buffer capacity, usable ship capacity, and reservations.
- `CargoDepot.CanBePaused` is false in this version. Ship pause and individual module pause are the relevant cargo controls. Mine production-step zero also pauses the mine.
- `CargoShipV2.JourneyDuration` is unavailable until departure timing is known and includes the ship's fuel-saving travel behavior. `FuelPerJourneyNeeded()` supplies the current configured fuel requirement. Do not borrow a duration from another depot or treat missing duration as unlimited throughput.
- Cargo modules consume electricity and have maintenance/operational state. Shore storage capacity is distinct from onboard carrying capacity.

The old audit document describes a dormant world-mine database that is no longer present in this checkout. The new implementation must use installed APIs and the live snapshot rather than assuming that database exists. No new wiki discrepancy was established in this investigation.

## State and accounting rules

| Situation | Supply and reserves | Costs |
| --- | --- | --- |
| Mine and shipping off | No new recurring import; cover unmet factory demand from island reserves. | Read actual remaining worker assignments and mine Unity; no new recurring voyage fuel. |
| Mine on, shipping off | Production can fill the offshore buffer, but is not island supply. Island reserves cover the shortfall. | Mine costs remain state-dependent; stopped shipping does not erase mine costs. |
| Mine off, shipping on | Existing offshore stock and cargo already in transit can still arrive. These are finite deliveries, not renewable production. | Retain the actual voyage/crew/module costs and any committed trip effects. |
| Mine and shipping on | Project delivery subject to production, cargo availability, transport, and unloading constraints. Preserve surplus beyond factory demand. | Include mine workers/Unity and cargo crew/modules/fuel/electricity exactly once. |
| Shipping on but blocked | Expose the observed cause; do not credit unavailable recurring delivery. Retain cargo already acquired. | Follow game assignments and operational state rather than zeroing all costs. |
| Empty reserve | Expose uncovered Sulfur demand. | No fabricated replacement source. |
| Missing/incompatible snapshot | Current-state calculations are unavailable. | No assumed mine, eight-module setup, zero-cost route, or reserve balance. |

Keep offshore stock, reserved pickup, ship cargo, shore buffers, and eligible island reserves as distinct inventory locations. A transfer changes location; it does not create a second copy of Sulfur. Reserve draw is a calculated demand allocation, not a local decrement of the synced balance.

## Implementation sequence

### 1. Extend the exporter and schema

Add world-mine snapshot models/collector/writer and extract reusable cargo snapshot collection from the contract collector.

Capture the following from live entities and their prototypes:

- **Mine identity/state:** entity and prototype IDs, title, product reference, location identity when available, repair/upgrade state, installed level and legal production range, selected production step, pause/enabled/current state, and blocking reason.
- **Mine production/costs:** prototype production duration and base quantity, effective output for the selected step, effective efficiency and production penalty, workers required and assigned, current/maximum recurring Unity, maintenance state and costs, buffer quantity/capacity, and finite deposit quantity or an explicit unlimited flag. Export per-step prototype values if needed for future level projections; do not reconstruct sulfur-specific cost formulas in TypeScript.
- **Cargo route:** depot/ship identities, job-provider kind, slot count, selected products, module IDs, pause/operational states, assigned and required workers, onboard capacities and usable capacities, shore quantities/free capacity, cargo quantities, and transfer capability.
- **Cargo operation:** current fuel product, fuel-saving setting, effective trip fuel, journey duration or null, docked/in-transit state, departure request, docked blocking status, loading/unloading state, and Unity-for-fuel behavior if enabled.
- **World cargo availability:** resource-level available quantities/capacity and reservation-aware route availability using the game's public cargo APIs. Snapshot collection must remain read-only: never reserve or load cargo while exporting.
- **Sulfur reserves:** inventory of constructed, non-destroyed ordinary island storages, including entity ID, product reference, actual quantity, capacity, and train/incoming-route connectivity. Include the user's linked stockpile through the declarative eligibility policy below.

Update `SnapshotModels.cs`, `GameSnapshotCollector.Capture.cs`, `SnapshotJsonWriter.cs`, `SnapshotTracking.cs`, `app/game-state.ts`, fixtures, and compatibility checks together. Normalize unique IDs, valid product references, bounds, nonnegative quantities, and explicit nulls. Preserve inactive entries. Make ordering deterministic.

Use the next schema version available at implementation time, currently 41. Include version/build provenance for the game-derived values. An older snapshot must not silently normalize into an empty world-mine state.

### 2. Resolve shared cargo ownership and world-mine supply

Add pure helpers under `app/helpers/world-mines/` and shared cargo helpers alongside the existing contract helpers. Keep contract exchange/Unity rules specific to contracts and world-mine production specific to mines.

Resolve world-cargo eligibility by job kind and selected product. Pool mines by product, preserving individual mine costs and inventory. Support multiple depots and mines without multiplying shared offshore supply. Mixed cargo must share one voyage and its fuel charge.

Claim mine, ship, depot, and module IDs before creating generic live areas. Keep unsupported claimed equipment from being counted a second time. If cargo crews occur in the existing vehicle total, exclude those exact IDs at collection time or provide the disjoint worker groups explicitly.

Replace the global sulfur placeholder in `mines.ts`/`recipes.ts`. Integrate resolved supply through `derive-calculator-model.ts`, `FactoryCalculationInput`, `calculateFactoryCalculation`, and `calculateFactoryTotal`, with serializable results for the worker.

### 3. Model burst delivery and reserve fallback

Keep two different outputs:

1. **Recurring delivery projection:** sustained production transported to the island, limited by the mine and cargo operation. Mine production alone never counts as delivered island supply.
2. **Finite delivery state/projection:** cargo already offshore or in transit, its pickup/delivery progress, and the temporary additional delivery it can support. Exhaust the buffer in any burst forecast rather than extending the burst rate indefinitely.

For each route/resource, derive shipment capacity from actual eligible onboard modules. Derive full-cycle timing from observed journey timing plus applicable transfer constraints; include collection waits when mine production is slower than transport. Use the game's departure availability to handle partial/manual shipments and small offshore buffers. Shared routes must allocate supply deterministically without double reservation.

An active stockpiling operation must preserve excess delivery; do not reuse contracts' demand-balanced default to cap it at current factory consumption. It is still limited by actual production, transport, and storage availability.

Add Sulfur to the reserve catalog as a fallback source after local production and resolved imports. For resource demand `D`, local production `P`, and recurring delivered supply `I`, the remaining draw is `max(0, D - P - I)`, subject to the existing solver's allocation rules. Positive net supply is stockpile growth, not negative reserve consumption.

Runway is `balance / draw` production cycles and `balance / draw / 12` in-game years. Preserve fractional final cycles and distinguish empty, idle, draining, replenishing, and unavailable outcomes. A positive balance is finite inventory, not permission to assume indefinite supply.

Do not invent a journey duration for the first mine voyage. Until transport timing is known, show synced mine capacity, cargo capacity, exact configured trip fuel, and known inventories; leave time-dependent delivery/fuel projections unavailable. Do not mislabel a normal cargo wait as the player switching the mine off.

### 4. Reconcile factory costs

- **Workers:** total assigned mine workers, cargo crews, and module workers once. Expose required workers separately when staffing prevents operation. Pausing a ship must not automatically remove workers from still-enabled shore modules.
- **Unity:** use mine Unity as its own budget item in `calculateUnityBudget`; do not apply contract establishment charges, exchange charges, or Contracts Unity Cost focus. Distinguish current consumption from projected operating pressure. Account separately for any observed Unity-for-fuel voyage.
- **Fuel:** create a common shipping demand result for contracts and world cargo, keyed by the actual fuel product. Feed that result into the factory solver so upstream hydrogen production sees the current load and reserve fallback cannot hide it.
- **Historical fuel replacement:** partition the existing hydrogen history using `history.hydrogenFuel.byUse`. Replace the cargo-ship component with the common current cargo model, preserving non-cargo consumption and correctly reconciling differing sample windows. Cover all cargo owners, including outstanding voyages. Never keep the full historic cargo term and add modeled cargo on top. If a route is unmodeled or timing is unknown, expose incomplete fuel demand; do not silently assume zero or selectively subtract an invented historical share.
- **Electricity:** claim shore-module power with its cargo owner and include its observed load and projected transfer pressure, using exported effective values. Do not lose this load when removing cargo equipment from generic area modeling.
- **Maintenance:** retain the repository's observed rolling-maintenance accounting. Export mine/cargo maintenance state and expose projected pressure where available, but do not add nominal maintenance costs on top of the same historical consumption. Historical demand will not instantly disappear after pausing; label it accurately. Any future immediate replacement requires attributable measured consumption first.
- **Modifiers:** synced effective mine output and ship fuel already incorporate live modifiers. Apply only an explicit future-plan delta when modeling a change; never apply the full research/focus bonus again.

### 5. Update the views and sync lifecycle

Update `MinesView`, `ReservesView`, shared cargo presentation, Factory Total workers/resource flows, and the Unity breakdown. Use existing design-system primitives and semantic tokens. Follow the repository's player-facing-copy rules.

Show individual mine state/production level, delivered supply versus capacity, offshore stock, assigned workers, Unity, and cargo costs. Show Sulfur reserve balance, draw or growth per production cycle, and runway in production cycles/in-game years. Avoid explaining familiar game mechanics in the interface.

Apply **Synced** only to compatible observed game values, and **Planned** only to explicit future overrides. Calculated delivery rates, surplus, and runway remain neutral. No player-specific plan is preloaded. The first implementation follows game on/off changes; calculator-side overrides, if added, must be scoped by save and entity and expose their cost changes.

Ensure mine/ship/module state, product/fuel changes, balance changes, and any plan override participate in calculation revisions. Update worker/cache compatibility so a stale result cannot revive the old infinite sulfur source. Confirm load, reload, cached compatible state, save switch, and upgrade to the new exporter schema all retain correct provenance.

### 6. Verify before completion

| Scenario | Required result |
| --- | --- |
| Repaired mine absent / unrepaired only | No fabricated sulfur production, workers, or Unity. |
| Multiple legal mine levels and modifiers | Values follow exported game data; no fixed maximum or double modifier. |
| On → off → on with positive island stock | New recurring deliveries/costs follow independent mine and cargo state; reserves cover only the remaining deficit. |
| Mine paused with offshore stock or cargo in transit | Finite arrivals are preserved and cannot become permanent recurring supply. |
| Eight sulfur modules and 200k+ island stock | Actual capacities and balance are honored; active bursts can grow reserves beyond factory demand. |
| Different module counts/sizes, mixed cargo, multiple depots | Shared supply and trip costs are conserved and never duplicated. |
| Missing crew, module pause, full shore/offshore buffer, no fuel, blocked dock | Accurate state, bounded delivery, and independently correct costs. |
| First voyage / unknown duration / partial manual departure | No invented timing or unbounded throughput; known trip quantities remain visible. |
| Train-linked/incoming-route sulfur storages | All intended ordinary island storage counts, even when referenced by multiple station modules; deduplicate by entity ID. Cargo/ship/offshore stock stays separate. |
| Reserve zero, unavailable, or less than one cycle of draw | Deficit/unavailable state or fractional runway, with no fake stock. |
| Contracts and mines operate together | Existing exchange/Unity behavior remains correct; both affect reserve draw and shipping fuel once. |
| Hydrogen/diesel switch, fuel saving, research/focus change | Correct product and effective rate; historical cargo use is not added twice. |
| Cache restore, save switch, incompatible schema | No stale mine configuration or stockpile carries into current results. |

Add meaningful helper, normalizer, cost-budget, and factory integration tests for these cases. Build the exporter against the installed assemblies, run focused tests and TypeScript checks, then production build. Verify the Mines/Reserves/Factory Total flow in the browser with captured compatible fixtures.

Finally compare live in-game and exported values with the real mine and cargo setup. Capture on/off/on states, at least one timed voyage, a delivered batch, and a reserve draw interval. Do not claim this live validation is complete using synthetic fixtures alone. Follow user-controlled game operation; do not change the save as part of automated verification.

## Confirmed reserve-storage scope

The user confirmed **train-linked storage or assigned incoming truck routes**. The current reserve collector excludes both and cannot be reused unchanged for Sulfur.

Export a common inventory of actual ordinary island `Storage` entities with product, quantity, capacity, and connectivity metadata. Apply eligibility through a declarative resource policy in the reserve catalog: Sulfur uses all ordinary island storage, including standalone, train-linked, and incoming-route storage. The existing Gold/Fuel Gas policy remains explicitly represented. Avoid a sulfur-specific conditional buried in the collector and avoid maintaining separate conflicting product policies in C# and TypeScript.

Deduplicate storage by entity ID before aggregating; a station connection or assigned route is a reference to storage, not another stock balance. Exclude destroyed/unbuilt storage, offshore mine buffers, onboard cargo, cargo-depot module buffers, train-car cargo, and ordinary production-machine buffers from this reserve total. Cargo-depot stock remains a separate finite island supply buffer until transferred into reserve storage. A resource reassignment, storage construction/removal, new route, and changed train linkage must resync automatically. There is no manually entered list of stockpile entity IDs and no assumed 200k balance.
