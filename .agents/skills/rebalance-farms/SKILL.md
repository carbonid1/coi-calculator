---
name: rebalance-farms
description: Rebalance Captain of Industry crop farms against the calculator's current factory demand. Use when crop consumption, population, farming modifiers, crop data, or farm-planning priorities change, or when the user asks to rebalance, optimize, or reduce farm deficits and surplus.
---

# Rebalance Farms

Keep farm rotations as fixed data in `activeCropFarmGroups`. Do not add a
runtime optimizer.

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
6. Prefer no more than 5 surplus per crop per 60s; allow up to 10 when crop
   rotation granularity requires it.
7. Verify the resulting balances in Factory Total.
