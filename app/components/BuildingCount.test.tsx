import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

import { BuildingCount } from "./BuildingCount";

it("falls back to the normal count when concise source display has no source", () => {
  const html = renderToStaticMarkup(
    <BuildingCount
      load={5}
      active={5}
      built={5}
      showDataSourceLabel
    />,
  );

  expect(html).toContain("Load");
  expect(html).toContain("5 / 5");
});
