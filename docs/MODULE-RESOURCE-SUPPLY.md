# Module resource supply

Calculation scope and resource connections are separate concepts.

- `Module.includedInFactoryTotals !== false`: recipes participate in the shared factory calculation.
- A live module with `includedInFactoryTotals === false`: recipes run in a local calculation first. Its remaining demand and supply can still enter the factory pool.
- `Module.localResources` controls reporting, not routing.

## Rules and quantities

`app/db/resource-supply.ts` owns the calculator's resource routing assumptions. Sea Water and all four Steam grades require local production or named connections. `buildModuleLines` applies these input restrictions to static presets as well as snapshot recipes, including dispatched turbines and recovery/disposal sinks. Local output-balanced producers can start for local demand; linked deliveries are credited to the receiving module. `resource-disposition.ts` separately owns preferences for consuming residual resources.

`resolveModuleResourceBoundary` in `app/helpers/module-resource-boundary/` turns the resource policy, named links, and preset requests into an explicit exchange rule for a locally calculated module:

- Ordinary unlinked resources exchange their residual demand or supply with the factory.
- Both endpoints of a dedicated resource link stop automatic factory exchange for that resource.
- An import request for an ordinary resource imposes its exact quantity on factory demand; it is not proof of delivery. Connection-only fluids cannot use generic factory import/export requests.
- A dedicated endpoint may export a requested amount to the factory after demand-triggered transfers. Surplus-only links receive what remains.
- Unconnected utility fluids stay local.

`calculateModuleResourceBoundary` applies that rule to calculated production, consumption, fixed demand, and transfers. `calculateLinkedModules` preserves each result in `boundaries` and derives its aggregate `boundaryDemands` and `boundarySupplies` from those same records.

Named links support pooled and isolated endpoints in either direction. `calculateLinkedModules` recalculates pooled endpoints together through `calculateFactoryCalculation`, so their link demand includes the shared factory and respects physical capacity. Source reservations and target deliveries use module ledgers. Internal transfers cancel out of reported factory production and consumption; pooled recipes appear once, without synthetic source recipes.

`Recipe.moduleInputIds` controls which ingredients require module-local supply. It is independent of `balanceInputIds`, which controls utilization limits. Adding local Steam must not make Sour Water or another previously pooled ingredient local. The scope helper preserves explicitly local ingredients in older recipe definitions when adding resource routing rules. Pending local production reserves shared building capacity once across alternative recipes.

## UI provenance

The Resource supply view reads the final factory and local results. It distinguishes production, useful consumption, and terminal disposal. Recovery recipes count their inputs as use and their outputs as production. Consumption is grouped by produced resource, so runtime recipe identifiers do not become labels.

The Export column combines delivered named-link quantities with remaining production available to the factory. A dedicated delivery is counted once, and local Steam surplus is excluded. Shared-pool exports represent available production, without inventing a particular source-to-consumer connection. Locally calculated modules explicitly show “Local first” because that affects allocation priority. All these quantities are calculator-derived.

## Contracts

`getContractResourceFlows` preserves each contract route's actual import, payment export, and ship fuel as named records. `calculateFactoryTotal` uses those same records as supplied resources and demands, and returns them in `contractFlows`. The Resource supply view groups these records by contract, so imported resources, their payment, and shipping fuel remain visible alongside module production. Contract imports never become recipe production or invented contract-to-module transfers.

Contract planning iterates with the factory to propagate payment and fuel through production chains, including contracts that import another contract's payment resource. Feedback already contains those costs; adding them again while allocating contracts would overbuy. Fixed deliveries are reserved before demand-balanced imports regardless of contract order and removed from feedback production before being applied once in the next plan. Only achievable fixed deliveries are reserved, respecting configured route availability and capacity.

Contract throughput represents steady factory operation. Capacity uses enabled ships and cargo modules, their configured exchange, measured journey duration, and nominal transfer rates. Momentary shore buffers, ship fuel shortages, blocked docks, missing assigned workers, and cargo-module operating states do not reduce that throughput. Payment resources and shipping fuel remain steady demands on the factory. Explicit pauses, disabled routes, missing ships, and unavailable voyage measurements still affect the calculation.

Factory deficit diagnostics use the same contract flows to distinguish insufficient imports from missing producers and identify payment exports and ship fuel instead of treating those known loads as unexplained consumption. Import rows and deficit messages share configured route availability and capacity limits. Unrelated external demand remains separate. Cached calculations without these records are invalidated.

## Remaining allocation architecture

The solver still allocates each isolated module locally, then reconciles named transfers with the pooled factory until deliveries stabilize. It does not make a shared-pool consumer's priority preempt production already allocated inside an isolated module, or add a connection editor. Contract plans are reused between link iterations within one solve, with demand and costs recalculated before accepting each result.

Water recovery, CO₂ priorities, private-link exclusivity, planned import/export quantities, endpoint combinations, and shared-capacity accounting have separate regression coverage. Keep quantity conservation and unmet demand visible when changing allocation order.
