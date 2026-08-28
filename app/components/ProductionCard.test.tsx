import { type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Card: {
    Root: ({ children, ...props }: ComponentProps<"div"> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  cn: (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" "),
}));

import { ProductionCard } from "./ProductionCard";

describe("ProductionCard", () => {
  it("keeps an inactive synced card visibly synced without a dashed border", () => {
    const html = renderToStaticMarkup(
      <ProductionCard dataSource="synced" inactive operatingMode="balanced">
        <span>Inactive synced machine</span>
      </ProductionCard>,
    );

    expect(html).toContain('data-data-source="synced"');
    expect(html).toContain("border-success/40");
    expect(html).toContain("border-success/20");
    expect(html).toContain("[&amp;&gt;*]:opacity-40");
    expect(html).not.toContain("border-dashed");
    expect(html).not.toContain('class="opacity-40');
  });

  it("uses a dashed border only when the effective value is planned", () => {
    const planned = renderToStaticMarkup(
      <ProductionCard dataSource="planned" inactive operatingMode="balanced">
        <span>Inactive planned machine</span>
      </ProductionCard>,
    );
    const unlayered = renderToStaticMarkup(
      <ProductionCard inactive operatingMode="balanced">
        <span>Inactive unlayered machine</span>
      </ProductionCard>,
    );

    expect(planned).toContain("border-dashed");
    expect(unlayered).not.toContain("border-dashed");
  });
});
