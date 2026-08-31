import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Tooltip: ({
    children,
    label,
  }: {
    children: ReactNode;
    label: string;
  }) => <div aria-label={label}>{children}</div>,
}));
vi.mock("./BuildingAttentionView", () => ({ BuildingAttentionView: () => null }));
vi.mock("./PlannedBuildsView", () => ({ PlannedBuildsView: () => null }));

import { NetSummary } from "./NetSummary";

it("shows module inputs without leaking a zero-worker value or redundant label", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[{
        resourceId: "acid",
        name: "Acid",
        consumed: 96,
        produced: 0,
        net: -96,
      }]}
      workers={0}
    />,
  );

  expect(html).toContain("Acid");
  expect(html).toContain("96");
  expect(html).toContain("text-destructive");
  expect(html).not.toContain("Module inputs");
  expect(html).not.toContain(">0<");
});

it("shows requested exports inline using planned colour and a tooltip", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[]}
      requestedExports={{ copper: 384 }}
    />,
  );

  expect(html).toContain("Net Summary");
  expect(html).toContain("Copper");
  expect(html).toContain("384");
  expect(html).toContain("bg-highlight-muted");
  expect(html).toContain("text-highlight-foreground");
  expect(html).toContain("Planned export target:");
  expect(html).not.toContain("Requested exports");
});

it("shows requested imports first using the planned colour", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[{
        resourceId: "acid",
        name: "Acid",
        consumed: 96,
        produced: 0,
        net: -96,
      }]}
      requestedImports={{ ironOreCrushed: 384 }}
      requestedExports={{ steel: 192 }}
    />,
  );
  const dividers = [...html.matchAll(/class="my-2 border-t border-border"/g)]
    .map(match => match.index ?? -1);

  expect(html).toContain("Planned import target: 384 Iron Ore Crushed per production cycle.");
  expect(html).toContain("bg-highlight-muted");
  expect(html).toContain("text-highlight-foreground");
  expect(dividers).toHaveLength(2);
  expect(html.indexOf(">Iron Ore Crushed<")).toBeLessThan(dividers[0] ?? -1);
  expect(dividers[0]).toBeLessThan(html.indexOf(">Acid<"));
  expect(html.indexOf(">Acid<")).toBeLessThan(dividers[1] ?? -1);
  expect(dividers[1]).toBeLessThan(html.indexOf(">Steel<"));
});

it("puts projected delivery in the tooltip without repeating the shortfall as an input", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[{
        resourceId: "copper",
        name: "Copper",
        consumed: 384,
        produced: 300,
        net: -84,
      }]}
      requestedExports={{ copper: 384 }}
    />,
  );

  expect(html).toContain("Projected delivery: 300.");
  expect(html.match(/>Copper</g)).toHaveLength(1);
});

it("puts requested exports below module inputs with a divider", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[{
        resourceId: "acid",
        name: "Acid",
        consumed: 96,
        produced: 0,
        net: -96,
      }]}
      requestedExports={{ copper: 384 }}
    />,
  );
  const dividerIndex = html.indexOf('class="my-2 border-t border-border"');

  expect(dividerIndex).toBeGreaterThan(html.indexOf(">Acid<"));
  expect(dividerIndex).toBeLessThan(html.indexOf(">Copper<"));
});

it("uses the success colour for surplus quantities", () => {
  const html = renderToStaticMarkup(
    <NetSummary
      flows={[{
        resourceId: "steamLow",
        name: "Steam (Low)",
        consumed: 0,
        produced: 32,
        net: 32,
      }]}
    />,
  );

  expect(html).toContain("text-success");
});

it("shows a dedicated resource beside its counterparty in both linked modules", () => {
  const transfer = {
    id: "test-exhaust-link",
    sourceModuleId: "copper",
    sourceModuleName: "Copper #1",
    targetModuleId: "exhaust",
    targetModuleName: "Exaust #1",
    resourceId: "exhaust" as const,
    mode: "surplus-only" as const,
    quantity: 96,
    requestedQuantity: 96,
  };
  const sourceHtml = renderToStaticMarkup(
    <NetSummary
      flows={[]}
      moduleId="copper"
      resourceTransfers={[transfer]}
    />,
  );
  const targetHtml = renderToStaticMarkup(
    <NetSummary
      flows={[]}
      moduleId="exhaust"
      resourceTransfers={[transfer]}
    />,
  );

  expect(sourceHtml).toContain("Exhaust");
  expect(sourceHtml).toContain("Exaust #1");
  expect(sourceHtml).toContain("Dedicated to Exaust #1");
  expect(targetHtml).toContain("Exhaust");
  expect(targetHtml).toContain("Copper #1");
  expect(targetHtml).toContain("Dedicated from Copper #1");
});
