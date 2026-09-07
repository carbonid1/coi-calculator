import { type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { type Recipe } from "../db/recipes";
import { buildModuleLines } from "../helpers/build-module-lines/build-module-lines";
import { calculateBuildingDiagnostics } from "../helpers/building-diagnostics/building-diagnostics";
import { calculateNet, type RegularResult } from "../helpers/calculate/calculate";
import { createLiveAreaModules } from "../helpers/live-area-modules/live-area-modules";

vi.mock("@carbonid1/design-system", () => ({
  Card: { Root: (props: ComponentProps<"div">) => <div {...props} /> },
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => (
    <div aria-label={label}>{children}</div>
  ),
  cn: (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" "),
}));

import { RecipeCard } from "./RecipeCard";
import { SharedRecipeCard } from "./SharedRecipeCard";
import { SinkCard } from "./SinkCard";

const recipe: Recipe = {
  id: "graphite", gameRecipeId: "GraphiteProductionCo2", name: "GraphiteProductionCo2",
  building: "Chemical Plant II", group: "production",
  inputs: [{ resourceId: "carbonDioxide", quantity: 144 }],
  outputs: [{ resourceId: "graphite", quantity: 6 }],
};
const result: RegularResult = {
  recipe, moduleId: "general", activeBuildings: 1, builtBuildings: 1,
  supplyRatio: 0.5, speedLevel: 1, operatingMode: "balanced",
  actualInputs: [{ resourceId: "carbonDioxide", quantity: 72 }],
  actualOutputs: [{ resourceId: "graphite", quantity: 3 }],
  recyclableSourceValueProduced: 0,
};

it("keeps a tiny nonzero Brine disposal visible instead of rounding it to zero", () => {
  const html = renderToStaticMarkup(<SinkCard role="sink" result={{
    recipe: {
      id: "dump-brine", name: "Brine", building: "Liquid Dump", group: "sink",
      inputs: [{ resourceId: "brine", quantity: 200 }], outputs: [],
    },
    moduleId: "nuclear", activeBuildings: 2, builtBuildings: 2,
    supplyRatio: 0.003 / 400,
    actualInputs: [{ resourceId: "brine", quantity: 0.003 }], actualOutputs: [],
  }} />);

  expect(html).toContain("&lt;0.01");
});

it.each([0, 0.5])("uses the same readable label in regular, shared and passive cards at load %s", supplyRatio => {
  const current = { ...result, supplyRatio };
  const cards = [
    <RecipeCard key="regular" {...current} />,
    <SharedRecipeCard key="shared" lines={[current]} results={[current]} />,
    <SinkCard key="passive" result={current} role="source" />,
  ];

  for (const card of cards) {
    const html = renderToStaticMarkup(card);

    expect(html).toContain("Carbon Dioxide → Graphite");
    expect(html).not.toContain("GraphiteProductionCo2");
  }
});

it("preserves an authored route label in every card", () => {
  const current = { ...result, recipe: { ...recipe, displayName: "Graphite from Carbon Dioxide" } };

  for (const card of [
    <RecipeCard key="regular" {...current} />,
    <SharedRecipeCard key="shared" lines={[current]} results={[current]} />,
    <SinkCard key="passive" result={current} role="source" />,
  ]) {
    const html = renderToStaticMarkup(card);

    expect(html).toContain("Graphite from Carbon Dioxide");
    expect(html).not.toContain("GraphiteProductionCo2");
  }
});

it.each([
  { prototypeId: "OceanWaterPumpT1", prototypeName: "Seawater pump", suffix: "" },
  { prototypeId: "OceanWaterPumpLarge", prototypeName: "Seawater pump (tall)", suffix: "T2" },
])("distinguishes paused standard and boosted $prototypeName modes in cards and building diagnostics", ({ prototypeId, prototypeName, suffix }) => {
  const [module] = createLiveAreaModules([{ id: 16, name: "Copper #1" }], [
    { id: `OceanWaterPumping${suffix}`, durationSeconds: 10 },
    { id: `OceanWaterPumping2x${suffix}`, durationSeconds: 5 },
  ].map(({ id, durationSeconds }, index) => ({
    entityId: index + 1,
    prototypeId, prototypeName,
    constructionState: "Constructed", constructed: true, running: false,
    tile: { x: index, y: 0 }, zones: [{ id: 16, name: "Copper #1" }],
    recipes: [{
      id, name: id, durationSeconds, assigned: true, inputs: [],
      outputs: [{ productId: "Product_Seawater", name: "Seawater", quantity: 18 }],
    }],
  })));

  if (!module) throw new Error("Missing pump module");

  const { lines } = buildModuleLines(module, module.presets[0] ?? null);
  const calculated = calculateNet(lines);
  const diagnostics = calculateBuildingDiagnostics(
    [module], calculated.allResourceFlows, calculated.regularResults, calculated.sourceResults,
  );
  const labels = new Map([
    [`OceanWaterPumping${suffix}`, "Sea Water"],
    [`OceanWaterPumping2x${suffix}`, "Sea Water (2×)"],
  ]);

  expect(diagnostics.map(diagnostic => diagnostic.recipeName).sort()).toEqual([...labels.values()].sort());
  expect(calculated.sourceResults).toHaveLength(2);

  for (const source of calculated.sourceResults) {
    expect(source.activeBuildings).toBe(0);
    expect(source.actualOutputs.every(output => output.quantity === 0)).toBe(true);

    const html = renderToStaticMarkup(<SinkCard result={source} role="source" dataSource="synced" />);

    expect(html).toContain(`>${labels.get(source.recipe.gameRecipeId ?? "")}</p>`);
    expect(html).not.toContain("OceanWaterPumping");
  }
});
