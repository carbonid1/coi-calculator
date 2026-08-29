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
vi.mock("./MachineZoneMappingsView", () => ({ MachineZoneMappingsView: () => null }));
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
  expect(html).toContain('data-data-source="planned"');
  expect(html).not.toContain("Requested exports");
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
