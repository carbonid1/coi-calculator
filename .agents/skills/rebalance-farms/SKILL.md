---
name: rebalance-farms
description: Plan Captain of Industry crop rotations when asked to rebalance farms or reduce crop deficits and surplus.
---

# Rebalance Farms

Propose future farm configurations against Factory Total demand. Changes to
population, recipes, or crop data alone do not call for a new farm plan.

## Current state and proposed changes

Current counts, rotations, fertilizer, and pause states come from a compatible
game snapshot. Preserve those synced values. Evaluate proposed configurations
separately and treat any persisted overrides as Planned. Without a compatible
snapshot, use explicitly supplied planning inputs and identify missing inputs;
current-state balances are unavailable.

Use [the farm model](../../../docs/FARMS.md) for rotation and simulation behavior,
[crop-farming.ts](../../../app/db/crop-farming.ts) for model types and crop data,
and [crop-farm-areas.ts](../../../app/db/modules/crop-farm-areas.ts) when tracing
how synced farms enter Factory Total. Reuse the calculator's farm simulation.
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
