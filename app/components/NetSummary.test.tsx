import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { recipes } from "../db/recipes";
import { type RegularResult } from "../helpers/calculate/calculate";

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

it("renders the concise Graphite explanation without repeated producer labels or false shortages", () => {
  const makeResult = (id: string, supplyRatio: number, overrides: Partial<RegularResult> = {}): RegularResult => {
    const recipe = recipes.find(candidate => candidate.id === id);

    if (!recipe) throw new Error(`Missing recipe: ${id}`);

    return {
      recipe, moduleId: "general", activeBuildings: 1, builtBuildings: 1,
      operatingMode: "balanced", supplyRatio, speedLevel: 1,
      actualInputs: [], actualOutputs: [], recyclableSourceValueProduced: 0,
      ...overrides,
    };
  };
  const graphite = makeResult("chemical-plant-ii-graphite", 0.37);

  graphite.recipe = { ...graphite.recipe, name: "GraphiteProductionCo2", gameRecipeId: "GraphiteProductionCo2" };

  const html = renderToStaticMarkup(
    <NetSummary
      groupByBalance
      flows={[
        { resourceId: "graphite", name: "Graphite", produced: 57.48, consumed: 57.57, net: -0.09 },
        { resourceId: "chlorine", name: "Chlorine", produced: 96, consumed: 101.44, net: -5.44 },
        { resourceId: "coal", name: "Coal", produced: 8, consumed: 8, net: 0 },
      ]}
      regularResults={[
        makeResult("chemical-plant-ii-graphite-coal", 0.71),
        graphite, { ...graphite, moduleId: "nuclear", supplyRatio: 0.69 },
        makeResult("chemical-plant-ii-ethanol", 0.8, {
          actualInputs: [{ resourceId: "carbonDioxide", quantity: 90.19 }],
          actualOutputs: [{ resourceId: "ethanol", quantity: 60.13 }],
        }),
        makeResult("food-processor-meat", 1, {
          actualInputs: [{ resourceId: "graphite", quantity: 57.57 }],
        }),
      ]}
    />,
  );

  expect(html.match(/Chlorine short · Carbon Dioxide prioritized for Ethanol/g)).toHaveLength(1);
  expect(html).not.toContain("GraphiteProduction");
  expect(html).not.toContain("Coal short");
  expect(html).not.toContain("Carbon Dioxide short");
  expect(html).not.toContain("0.37/1");
});

it.each([true, false])("renders blocked-surplus requirements consistently in summary mode %s", groupByBalance => {
  const recipe = recipes.find(candidate => candidate.id === "food-processor-meat");

  if (!recipe) throw new Error("Missing food processor recipe");

  const html = renderToStaticMarkup(
    <NetSummary
      groupByBalance={groupByBalance}
      flows={[{ resourceId: "chickenCarcass", name: "Chicken Carcass", produced: 20, consumed: 10, net: 10 }]}
      regularResults={[{
        recipe, moduleId: "general", activeBuildings: 1, builtBuildings: 1,
        operatingMode: "balanced", supplyRatio: 0.5, speedLevel: 1,
        actualInputs: [], actualOutputs: [], recyclableSourceValueProduced: 0,
      }]}
      blockedRoutes={[{
        recipe, moduleId: "general", activeBuildings: 1, surplusResourceIds: ["chickenCarcass"],
        wantedRatio: 1, appliedRatio: 0.5, blockedBy: { resourceId: "water", deficitIncrease: 10.65 },
      }]}
    />,
  );

  expect(html).toContain("Chicken Carcass → Meat + Trimmings · needs 10.65 more Water");
  expect(html).not.toContain("Water short");
  expect(html).not.toContain("Food Processor (");
});

it.each([1, 0.5])("shows an area surplus bottleneck only when its converter is full (load %s)", supplyRatio => {
  const result: RegularResult = {
    recipe: {
      id: "biomass-compost", name: "Biomass compost", building: "Mixer II", group: "production",
      allocation: "surplus", balanceBy: "input", balanceInputIds: ["biomass"],
      inputs: [{ resourceId: "biomass", quantity: 12 }],
      outputs: [{ resourceId: "compost", quantity: 12 }],
    },
    moduleId: "live-area-14", activeBuildings: 2, builtBuildings: 2,
    operatingMode: "balanced", supplyRatio, speedLevel: 1,
    actualInputs: [], actualOutputs: [], recyclableSourceValueProduced: 0,
  };
  const html = renderToStaticMarkup(
    <NetSummary
      moduleId={result.moduleId}
      flows={[{ resourceId: "biomass", name: "Biomass", produced: 25, consumed: 24, net: 1 }]}
      regularResults={[result]}
    />,
  );

  expect(html).toContain("Biomass");
  expect(html).toContain("+1");
  if (supplyRatio === 1) {
    expect(html).toContain("Mixer II · build 1");
  } else {
    expect(html).not.toContain("at capacity");
  }
});

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
