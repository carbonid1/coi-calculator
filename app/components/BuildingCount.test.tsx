import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  cn: (...values: (string | undefined)[]) => values.filter(Boolean).join(" "),
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

import { BuildingCount } from "./BuildingCount";

it("always shows operational load", () => {
  const html = renderToStaticMarkup(
    <BuildingCount
      load={5}
      active={5}
      built={5}
    />,
  );

  expect(html).toContain("Load");
  expect(html).toContain("5 / 5");
});

it("distinguishes active, paused, construction ghost, and unplaced plan states", () => {
  const html = renderToStaticMarkup(
    <BuildingCount
      load={8}
      active={8}
      currentActive={4}
      built={5}
      ghosts={2}
      planned={2}
    />,
  );

  expect(html).toContain(
    'aria-label="4 active buildings · 1 paused building · 2 construction ghost buildings · 2 planned, not placed buildings"',
  );
  expect(html).toContain("text-success");
  expect(html).toContain("text-attention-foreground");
  expect(html).toContain("text-foreground");
  expect(html).toContain("text-highlight-foreground");
});

it("shows chicken population and projected farm capacity", () => {
  const html = renderToStaticMarkup(
    <BuildingCount
      load={5}
      active={5}
      built={4}
      planned={1}
      animalPopulation={{
        current: 2_350,
        capacity: 2_500,
        label: "chickens",
        additionalBuildings: 0,
      }}
    />,
  );

  expect(html).toContain("Chickens");
  expect(html).toContain("2350 / 2500");
  expect(html).toContain("1 planned, not placed building");
});

it("shows the required Space Station level", () => {
  const html = renderToStaticMarkup(
    <BuildingCount
      load={0}
      active={0}
      built={0}
      attention="build"
      attentionCount={1}
      level={{ current: 0, target: 3 }}
    />,
  );

  expect(html).toContain("Build level 3");
});
