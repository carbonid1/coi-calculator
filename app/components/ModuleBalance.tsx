"use client";

import { Button, Tooltip } from "@carbonid1/design-system";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { type ModuleResourceTransfer } from "../db/module-resource-links";
import { type ResourceId } from "../db/resources";
import { type ResourceFlow } from "../helpers/calculate/calculate";
import { typedEntries } from "../helpers/typed-entries/typed-entries";
import { useResources } from "./ResourceProducts";

interface Props {
  flows: ResourceFlow[];
  moduleId?: string;
  transfers: readonly ModuleResourceTransfer[];
  requestedImports: Partial<Record<ResourceId, number>>;
  requestedExports: Partial<Record<ResourceId, number>>;
  transfersIncludedInBalance: boolean;
  notes: Partial<Record<ResourceId, string>>;
}

const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export const ModuleBalance = ({ flows, moduleId, transfers, requestedImports, requestedExports, transfersIncludedInBalance, notes }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const resources = useResources();
  const groups = (["Inputs", "Outputs"] as const).map(label => {
    const inbound = label === "Inputs";
    const requests = inbound ? requestedImports : requestedExports;
    const routes = transfers.filter(transfer => (
      inbound ? transfer.targetModuleId === moduleId : transfer.sourceModuleId === moduleId
    ));
    const balances = flows.filter(flow => {
      if (!inbound) return flow.net > 0.001;

      return flow.net < -0.001 && !(requestedImports[flow.resourceId] ?? 0) && !(requestedExports[flow.resourceId] ?? 0);
    });
    const ids = new Set([
      ...balances.map(flow => flow.resourceId),
      ...routes.map(route => route.resourceId),
      ...typedEntries(requests).filter(([, quantity]) => quantity > 0.001).map(([id]) => id),
    ]);
    const rows = [...ids].toSorted((left, right) => resources[left].name.localeCompare(resources[right].name))
      .map(resourceId => {
        const balance = balances.find(flow => flow.resourceId === resourceId);
        const net = flows.find(flow => flow.resourceId === resourceId)?.net ?? 0;
        const resourceRoutes = routes.filter(route => route.resourceId === resourceId);
        const requested = (requests[resourceId] ?? 0) > 0.001 ? requests[resourceId] : undefined;
        const transferred = resourceRoutes.reduce((total, route) => total + route.quantity, 0);
        // Local ledgers credit incoming transfers; pooled ledgers leave them outside the module balance.
        // Both ledgers charge outgoing transfers, so add them back to show total available output.
        const routeAdjustment = !inbound || transfersIncludedInBalance ? transferred : 0;
        const quantity = requested ?? (balance ? Math.abs(balance.net) + routeAdjustment : transferred);

        return { resourceId, quantity, requested, net, routes: resourceRoutes };
      });

    return { label, inbound, rows };
  });

  if (groups.every(group => group.rows.length === 0)) return null;

  return (
    <section aria-label="Module resource balance">
      <Button variant="ghost" size="small" fullWidth className="justify-between gap-3 px-1"
        aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          Resource balance
          <span className="text-xs font-normal text-muted-foreground">
            {groups.map(group => `${group.rows.length} ${group.label.toLowerCase()}`).join(" · ")}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </Button>
      <div id={contentId} hidden={!expanded}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {groups.map(({ label, inbound, rows }) => (
            <section key={label} aria-label={`Module ${label.toLowerCase()}`} className="min-w-0 rounded-lg bg-surface-inset p-2 inset-shadow-surface">
              <h4 className="px-1 text-xs font-medium text-muted-foreground">{label} / cycle</h4>
              {rows.length === 0 && <p className="px-1 py-1 text-xs text-muted-foreground">—</p>}
              {rows.map(({ resourceId, quantity, requested, net, routes }) => {
                const balanceLabel = inbound ? "Input demand" : "Output available for export";
                const delivery = inbound ? "" : ` Projected delivery: ${format(Math.max(0, (requested ?? 0) - Math.max(0, -net)))} / cycle.`;
                const detail = requested == null
                  ? `${balanceLabel}: ${format(quantity)} / cycle.`
                  : `Planned ${inbound ? "import" : "export"}: ${format(requested)} / cycle.${delivery} Net balance: ${format(net)} / cycle.`;

                return (
                <div key={resourceId} data-resource-id={resourceId} className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg px-1 py-1 text-sm hover:bg-accent">
                  <span className="min-w-0">
                    <span className="text-foreground">{resources[resourceId].name}</span>
                    {routes.map(route => {
                      const Icon = inbound ? ArrowLeft : ArrowRight;
                      const name = inbound ? route.sourceModuleName : route.targetModuleName;
                      const short = route.requestedQuantity - route.quantity > 0.001;
                      const detail = `${inbound ? "From" : "To"} ${name}: ${format(route.quantity)} / cycle${short ? ` of ${format(route.requestedQuantity)} requested` : ""}. ${route.mode === "surplus-only" ? "Surplus only." : "Production follows demand."}`;
                      const distinctQuantity = routes.length > 1 || Math.abs(quantity - route.quantity) > 0.001;

                      return <Tooltip key={route.id} label={detail} maxWidth={320}>
                        <span tabIndex={0} className="ml-1.5 inline-flex max-w-full items-center gap-1 rounded text-xs text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                          <Icon aria-hidden="true" className="size-3 shrink-0" />
                          <span className="truncate">{name}</span>
                          {distinctQuantity && <span className="font-mono tabular-nums">{format(route.quantity)}</span>}
                        </span>
                      </Tooltip>;
                    })}
                  </span>
                  <Tooltip label={`${detail}${notes[resourceId] ? ` ${notes[resourceId]}` : ""}`} maxWidth={320}>
                    <span tabIndex={0} data-source={requested != null ? "planned" : undefined} className={`shrink-0 rounded font-mono tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${requested != null ? "text-highlight-foreground" : "text-foreground"}`}>
                      {format(quantity)}
                    </span>
                  </Tooltip>
                </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
};
