import { describe, expect, it } from "vitest";

import { resolveLayeredValue } from "./resolve-layered-value";

describe("layered calculator values", () => {
  it("uses default ≤ modeled ≤ synced ≤ planned precedence", () => {
    expect(resolveLayeredValue({ default: 1 }).source).toBe("default");
    expect(resolveLayeredValue({ default: 1, modeled: 2 }).value).toBe(2);
    expect(resolveLayeredValue({ default: 1, modeled: 2, synced: 3 }).value).toBe(3);
    expect(resolveLayeredValue({
      default: 1,
      modeled: 2,
      synced: 3,
      planned: 4,
    })).toEqual({ source: "planned", value: 4 });
  });

  it("keeps zero and false as explicit higher-precedence values", () => {
    expect(resolveLayeredValue({ default: 1, planned: 0 }).value).toBe(0);
    expect(resolveLayeredValue({ default: true, synced: false }).value).toBe(false);
  });
});
