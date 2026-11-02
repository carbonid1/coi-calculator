import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { recipes, type Recipe } from "../db/recipes";
import { buildModuleLines } from "../helpers/build-module-lines/build-module-lines";
import { calculateBuildingDiagnostics } from "../helpers/building-diagnostics/building-diagnostics";
import { calculateBuildingStats } from "../helpers/building-stats/building-stats";
import { calculateNet, type ProductionLine, type RegularResult } from "../helpers/calculate/calculate";
import { createLiveAreaModules } from "../helpers/live-area-modules/live-area-modules";
import { getRecipePresentation } from '../helpers/recipe-display/recipe-display';
import { testProducts } from '../test-fixtures/products';

vi.mock("@carbonid1/design-system", () => ({
  Button: ({ children, 'aria-label': label }: ComponentProps<'button'>) => <button aria-label={label}>{children}</button>,
    Card: { Root: (props: ComponentProps<"div">) => <div {...props} /> },
    Tooltip: Object.assign(({ children, label }: { children: ReactNode; label: string }) => (
      <div aria-label={label}>{children}</div>
    ), {
      Root: ({ children }: { children: ReactNode }) => children,
      Trigger: ({ render, children }: { render: ReactElement; children: ReactNode }) => cloneElement(render, {}, children),
      Portal: () => null,
      Positioner: ({ children }: { children: ReactNode }) => children,
      Popup: ({ children }: { children: ReactNode }) => children,
    }),
    cn: (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" "),
}));

import { RecipeCard } from "./RecipeCard";
import { RecipeLabel } from './RecipeLabel';
import { ResourceProductsProvider } from './ResourceProducts';
import { ResourceToken } from './ResourceToken';
import { SharedRecipeCard } from "./SharedRecipeCard";
import { SinkCard } from "./SinkCard";

it('keeps search names inert, compact icons accessible, and unknown assets readable', () => {
  const named = renderToStaticMarkup(<ResourceProductsProvider products={testProducts} current>
    <ResourceToken resourceId="salt" named />
  </ResourceProductsProvider>);
  const compact = renderToStaticMarkup(<ResourceProductsProvider products={testProducts} current>
    <ResourceToken resourceId="salt" />
  </ResourceProductsProvider>);
  const fallback = renderToStaticMarkup(<ResourceToken resourceId="rocketII" />);
  const tier = renderToStaticMarkup(<ResourceToken resourceId="steamHigh" />);

  expect(named).toContain('>Salt from the game</span>');
  expect(named).not.toContain('<button');
  expect(compact).toContain('aria-label="Salt from the game"');
  expect(compact).toContain('/api/game-icons/Product_Salt?v=456');
  expect(compact).not.toContain('>Salt from the game</span>');
  expect(fallback).toContain('>Rocket II</span>');
  expect(fallback).not.toContain('<img');
  expect(tier).not.toContain('>HP</span>');
  expect(tier).toContain('>Steam (High)</span>');
});

it('exposes settled amounts for both sides of a recipe, including zero outputs', () => {
  const presentation = getRecipePresentation({
    building: 'Exhaust scrubber', name: 'ExhaustScrubbing',
    inputs: [{ resourceId: 'exhaust', quantity: 100 }],
    outputs: [{ resourceId: 'sulfur', quantity: 20 }, { resourceId: 'steamLow', quantity: 10 }],
  }, {
    inputs: [{ resourceId: 'exhaust', quantity: 86.44 }],
    outputs: [{ resourceId: 'sulfur', quantity: 17.288 }, { resourceId: 'steamLow', quantity: 0 }],
  });
  const html = renderToStaticMarkup(<RecipeLabel recipe={presentation} />);

  expect(html).toContain('aria-label="Exhaust · Input · 86.44"');
  expect(html).toContain('aria-label="Sulfur · Output · 17.29"');
  expect(html).toContain('aria-label="Steam (Low) · Output · 0"');
  expect(html).not.toContain('>LP</span>');

  const configured = renderToStaticMarkup(<RecipeLabel recipe={{ ...presentation, configuration: 'Recovery enabled' }} />);

  expect(configured).toContain('Exhaust · Input · 86.44');
  expect(configured).toContain('Sulfur · Output · 17.29');
});

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

it('keeps explicit settings visible even when the recipe name matches the building', () => {
  const html = renderToStaticMarkup(<RecipeCard {...result} recipe={{
    ...recipe, name: recipe.building, configurationLabel: 'Computing boost 2',
  }} />);

  expect(html).toContain('>Computing boost 2</span>');
});

it('preserves actual flows and rain-adjusted gross demand in compact recipe amounts', () => {
  const html = renderToStaticMarkup(<RecipeCard {...result} recipe={{
    ...recipe,
    inputs: [{ resourceId: 'water', quantity: 100, weatherAdjustedFarmId: 'test-farm' }],
  }} actualInputs={[{ resourceId: 'water', quantity: 12.345 }]}
    actualOutputs={[{ resourceId: 'graphite', quantity: 0 }]} />);

  expect(html).toContain('Water · Import after rain · 12.35\nGross demand · 50');
  expect(html).toContain('aria-label="Graphite · Output · 0"');
  expect(html).toContain('>12.35</span>');
  expect(html).toContain('>0</span>');
});

it.each([
  { supply: 0, load: '0 / 1', power: 0, throughput: 0 },
  { supply: 0.5, load: '0.25 / 1', power: 30, throughput: 0.5 },
  { supply: 1.5, load: '0.75 / 1', power: 90, throughput: 1.5 },
  { supply: 3, load: '1 / 1', power: 120, throughput: 2 },
])('shows waste-storage load from $supply input using the existing electricity calculation', ({ supply, load, power, throughput }) => {
  const storageRecipe = recipes.find(recipe => recipe.id === 'radioactive-waste-storage');

  if (!storageRecipe) throw new Error('Missing radioactive waste storage recipe');

  const storageLine: ProductionLine = {
    recipe: storageRecipe, moduleId: 'nuclear', activeBuildings: 1, builtBuildings: 1,
    operatingMode: 'balanced', speedLevel: 1,
  };
  const calculation = calculateNet([storageLine], { fissionProduct: supply });
  const storageResult = calculation.regularResults[0];

  if (!storageResult) throw new Error('Missing radioactive waste storage result');

  const html = renderToStaticMarkup(<RecipeCard {...storageResult} />);

  expect(html).toContain(`>${load}</span>`);
  expect(html).not.toContain('Max sustainable input');
  expect(html).toContain('Sustainable limit · 2');
  expect(calculateBuildingStats([storageLine], calculation)).toMatchObject({ workers: 10, electricityKw: power });
  if (throughput > 0) {
    expect(html).toContain(`Fission Product · Input · ${throughput}\nSustainable limit · 2`);
    expect(html).toContain(`Retired Waste · Output · ${throughput}`);
  }
});

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

  expect(html).toContain(">0.01</span>");
  expect(html).not.toContain("&lt;0.01");
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

    expect(html).toContain(labels.get(source.recipe.gameRecipeId ?? ""));
    expect(html).not.toContain("OceanWaterPumping");
  }
});
