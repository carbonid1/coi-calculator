import { describe, expect, it } from "vitest";

import { formatBuildingLoad } from "./format-building-load";

describe("formatBuildingLoad", () => {
  it("shows a minimum of 0.01 for a positive load", () => {
    expect(formatBuildingLoad(0.003237397615461879)).toBe(0.01);
  });

  it("keeps an idle load at zero", () => {
    expect(formatBuildingLoad(0)).toBe(0);
  });

  it("rounds ordinary loads to two decimal places", () => {
    expect(formatBuildingLoad(0.126)).toBe(0.13);
  });
});
