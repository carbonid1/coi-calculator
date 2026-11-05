---
name: rebalance-farms
description: Plan Captain of Industry crop rotations to reduce deficits and surplus, and apply a farm plan through the game Web API when asked.
---

# Rebalance Farms

Propose future farm configurations against Factory Total demand. Changes to
population, recipes, or crop data alone do not call for a new farm plan.

## Current state and proposed changes

Current counts, rotations, fertilizer, and pause states come from a compatible
game snapshot. Keep that planning input unchanged; evaluate proposed configurations
separately and treat persisted overrides as Planned. After applying a plan in-game,
read a fresh compatible snapshot before treating the applied settings as Synced.
Without a compatible snapshot, use explicitly supplied planning inputs and identify
missing inputs; current-state balances are unavailable.

Verify fertility target increments against the installed game's
`Farm.SetFertilityTarget` before optimizing. Installed 0.8.8 accepts targets from
0–140% in 10 percentage-point steps: 125% becomes 130%. Evaluate and persist the
supported target rather than the unrounded request.

`Farm.AssignCropToSlot` changes the schedule while preserving the crop already
growing. Applying a rotation does not require forcing a harvest or advancing the
current slot; account for the existing crop when checking near-term output.

Use [crop-farming.ts](../../../app/db/crop-farming.ts) for rotation simulation,
model types, and crop data, [calculate-farm-irrigation.ts](../../../app/helpers/weather/calculate-farm-irrigation.ts)
for water demand, and [crop-farm-areas.ts](../../../app/db/modules/crop-farm-areas.ts)
when tracing how synced farms enter Factory Total. Reuse the calculator's farm simulation.
Keep optimization outside the runtime; if there is no existing way to persist a
proposed rotation, return the plan without changing synced data or adding a
planning feature to complete a rebalance request.

## Planning priorities

When rebalancing:

1. Never place the same fertility-consuming crop in consecutive rotation slots,
   including the last-to-first boundary. Rebalance crops across farms rather
   than accepting the repeated-crop fertility penalty.
2. Keep every active crop out of deficit.
3. Use the fewest Greenhouse II buildings and workers.
4. When surplus is unavoidable, minimize each crop's surplus relative to its
   Factory Total consumption and prefer overproduction of high-consumption
   crops over low-consumption crops.
5. Minimize total absolute crop surplus, then Fertilizer II and gross water.
6. Prefer no more than 5 surplus per crop per in-game month; allow up to 10 when crop
   rotation granularity requires it.

Evaluate the proposed configuration through the Factory Total calculation in
an isolated scenario. Report rotations, building and worker counts, crop
deficits or surplus, and projected fertilizer and water demand. Distinguish
calculated projections from current balances and identify any unmet priority.

## Apply a plan through the game API

Use this workflow when the user asks to apply a plan. A request to rebalance or
propose rotations alone does not authorize game changes. Existing authorization
to apply the agreed plan is sufficient; do not ask for confirmation again.

Use the configured game server (`COI_WEB_API_URL`, default
`http://127.0.0.1:3073`). Discover current command schemas with
`GET /commands?filter=Farm` and the relevant `SetEntityEnabled` and
`SetSimPauseState` filters. Send commands to **`POST /command`** with
`{ "type": "CommandName", "args": { ... } }`. These routes are built into the game.

| Command | Arguments |
| --- | --- |
| `FarmAssignCropCmd` | `farmId`, native `cropId`, `scheduleSlot` (0–3). `null` clears a slot; `Crop_NoCrop` is a timed fallow crop, not an empty slot. |
| `FarmSetFertilityTargetCmd` | `farmId`, `target` as a fraction: **1.3 means 130%**. Use a supported fertility step. |
| `SetEntityEnabledCmd` | `entityId`, `isEnabled` to unpause or pause a farm. |
| `SetSimPauseStateCmd` | `isPaused` for the game while applying the batch. |

Prepare concrete assignments before pausing the game. Use fresh entity IDs within
the plan's area and available constructed farm tiers. Retain matching farms and
equivalent cyclic rotations, then minimize changed slots and settings. Map crop
names through [crop-farming-state.ts](../../../app/crop-farming-state.ts); use
native crop prototype IDs in commands. Clear unused trailing slots when shortening
a rotation. A fertility target does not select fertilizer or connect pipes:
check that the assigned farm's fertilizer supply matches the plan. Pause spare
farms only within the inventory covered by the plan's intended active count.

Capture original farm settings for recovery. Keep the following sequence together:
read the current game/session identity and pause state, pause if needed, refresh
the snapshot and check the farms still match the prepared before-state, send only
changed settings, read back the result, then restore the pause state captured at
execution time. Pause a running game only once the batch is ready, after optimization
and script preparation. Preserve an already-paused game and leave simulation speed
unchanged.

Check both the HTTP status and each command's `ok` and `result`. On a failure,
timeout, changed session, or unexpected farm edit, stop sending the prepared batch
and read back what actually happened before continuing. Do not blindly replay the
batch or roll back over new player changes. Reconcile partial application from
the recorded command results and fresh state; restore the prior pause state when
the outcome is understood.

Verify all affected farms, including spares: exact slot assignments, fertility
targets, fertilizer supply, and enabled states. While paused, confirm already
growing crops were preserved. Refresh the calculator to check it recognizes the
applied configurations. Report verified active/paused counts, any unapplied
changes, and the final game pause state.
