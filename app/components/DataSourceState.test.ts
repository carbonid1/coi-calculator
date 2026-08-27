import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  cn: (...values: (string | undefined)[]) => values.filter(Boolean).join(" "),
}));

import {
  getDataSourceMode,
  getDataSourcePresentation,
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
});
