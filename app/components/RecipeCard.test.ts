import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Card: { Root: () => null },
  Tooltip: {},
  cn: (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" "),
}));

import { recipes } from "../db/recipes";
import { isCompactSyncedElectricitySource } from "./RecipeCard";

const recipe = (id: string) => {
  const match = recipes.find(candidate => candidate.id === id);

  if (!match) throw new Error(`Missing test recipe: ${id}`);

  return match;
};

describe("isCompactSyncedElectricitySource", () => {
  it("compacts synced solar inventory cards", () => {
    expect(isCompactSyncedElectricitySource(
      recipe("solar-panel-mono"),
      "synced",
    )).toBe(true);
  });

  it("keeps planned solar output visible", () => {
    expect(isCompactSyncedElectricitySource(
      recipe("solar-panel-mono"),
      "planned",
    )).toBe(false);
  });

  it("does not compact synced recipes that consume an input", () => {
    const inputDrivenGenerator = {
      ...recipe("solar-panel"),
      inputs: [{ resourceId: "diesel" as const, quantity: 1 }],
    };

    expect(isCompactSyncedElectricitySource(
      inputDrivenGenerator,
      "synced",
    )).toBe(false);
  });
});
