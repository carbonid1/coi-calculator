---
name: rebalance-farms
description: Rebalance Captain of Industry crop farms against the calculator's current factory demand. Use when crop consumption, population, farming modifiers, crop data, or farm-planning priorities change, or when the user asks to rebalance, optimize, or reduce farm deficits and surplus.
---

# Rebalance Farms

Keep farm rotations as fixed data in `activeCropFarmGroups`. Do not add a
runtime optimizer.

When rebalancing:

1. Keep every active crop out of deficit.
2. Use the fewest Greenhouse II buildings and workers.
3. Minimize total crop surplus, then Fertilizer II and gross water.
4. Prefer no more than 5 surplus per crop per 60s; allow up to 10 when crop
   rotation granularity requires it.
5. Verify the resulting balances in Factory Total.
