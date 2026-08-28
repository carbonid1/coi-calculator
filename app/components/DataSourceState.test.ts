import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  cn: (...values: (string | undefined)[]) => values.filter(Boolean).join(" "),
}));

import {
  getDataSourceMode,
  getDataSourcePresentation,
  getDataSourceSurfaceClassName,
} from "./DataSourceState";

describe("data source surface", () => {
  it("normalizes default values to the modeled state", () => {
    expect(getDataSourceMode("default")).toBe("modeled");
    expect(getDataSourceMode("modeled")).toBe("modeled");
  });

  it("reserves dashed borders for planned values", () => {
    expect(getDataSourcePresentation("planned").surfaceClassName).toContain("border-dashed");
    expect(getDataSourcePresentation("modeled").surfaceClassName).not.toContain("border-dashed");
    expect(getDataSourcePresentation("synced").surfaceClassName).not.toContain("border-dashed");
  });

  it.each(["modeled", "synced", "planned"] as const)(
    "provides one shared border and background treatment for %s",
    source => {
      const className = getDataSourcePresentation(source).surfaceClassName;

      expect(className).toContain("border-");
      expect(className).toContain("bg-");
    },
  );

  it("softens the synced border when the represented value is inactive", () => {
    expect(getDataSourceSurfaceClassName("synced", { inactive: true }))
      .toContain("border-success/20");
    expect(getDataSourceSurfaceClassName("synced"))
      .not.toContain("border-success/20");
    expect(getDataSourceSurfaceClassName("modeled", { inactive: true }))
      .not.toContain("border-success/20");
    expect(getDataSourceSurfaceClassName("planned", { inactive: true }))
      .not.toContain("border-success/20");
  });
});
