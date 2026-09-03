import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  cn: (...values: (string | undefined)[]) => values.filter(Boolean).join(" "),
}));

import {
  getDataSourceSurfaceClassName,
} from "./DataSourceState";

describe("data source surface", () => {
  it("reserves dashed borders for planned values", () => {
    expect(getDataSourceSurfaceClassName("planned")).toContain("border-dashed");
    expect(getDataSourceSurfaceClassName("synced")).not.toContain("border-dashed");
  });

  it.each(["synced", "planned"] as const)(
    "provides one shared border and background treatment for %s",
    source => {
      const className = getDataSourceSurfaceClassName(source);

      expect(className).toContain("border-");
      expect(className).toContain("bg-");
    },
  );

  it("softens the synced border when the represented value is inactive", () => {
    expect(getDataSourceSurfaceClassName("synced", { inactive: true }))
      .toContain("border-success/20");
    expect(getDataSourceSurfaceClassName("synced"))
      .not.toContain("border-success/20");
    expect(getDataSourceSurfaceClassName("planned", { inactive: true }))
      .not.toContain("border-success/20");
  });
});
