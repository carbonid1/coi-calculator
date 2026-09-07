# Module resource supply

Calculation scope and resource connections are separate concepts.

- `Module.includedInFactoryTotals !== false`: recipes participate in the shared factory calculation.
- A live module with `includedInFactoryTotals === false`: recipes run in a local calculation first. Its remaining demand and supply can still enter the factory pool.
- `Module.localResources` controls reporting, not routing.

## Rules and quantities

`app/db/resource-supply.ts` owns the calculator's resource routing assumptions. Sea Water and Low Steam require local production or named connections. `resource-disposition.ts` separately owns preferences for consuming residual resources.

`resolveModuleResourceBoundary` in `app/helpers/module-resource-boundary/` turns the resource policy, named links, and preset requests into an explicit exchange rule for a locally calculated module:

- Ordinary unlinked resources exchange their residual demand or supply with the factory.
- Both endpoints of a dedicated resource link stop automatic factory exchange for that resource.
- An import request imposes its exact quantity on factory demand; it is not proof of delivery.
- A dedicated endpoint may export a requested amount to the factory after demand-triggered transfers. Surplus-only links receive what remains.
- Unconnected utility fluids stay local.

`calculateModuleResourceBoundary` applies that rule to calculated production, consumption, fixed demand, and transfers. `calculateLinkedModules` preserves each result in `boundaries` and derives its aggregate `boundaryDemands` and `boundarySupplies` from those same records.

Pooled-source planning shadows remain internal to `calculateFactoryCalculation`; their boundary records and module results are removed from the returned provenance. Their actual dedicated transfers reserve source demand in the final factory solve.

## UI provenance

The Resource supply view reads the final factory and local results. It distinguishes production, useful consumption, and terminal disposal. Recovery recipes count their inputs as use and their outputs as production. Consumption is grouped by produced resource, so runtime recipe identifiers do not become labels.

Named links show calculated delivered quantities. Shared-pool rows show a module's net need or available production, without inventing a particular source-to-consumer connection. Locally calculated modules explicitly show “Local first” because that affects allocation priority. All these quantities are calculator-derived.

## Remaining allocation architecture

The solver still runs local modules before the shared factory and uses pooled-source shadows for crossing links. This extraction preserves existing production decisions. It does not make a shared-pool consumer's priority preempt production already allocated inside a local module, or add a connection editor. The explicit boundary records are the integration point for replacing those passes with a common allocation ledger.

Water recovery, CO₂ priorities, private-link exclusivity, planned import/export quantities, and shadow accounting have separate regression coverage. Keep quantity conservation and unmet demand visible when changing allocation order.
