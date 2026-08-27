import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
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
