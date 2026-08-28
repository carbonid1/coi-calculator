import { describe, expect, it } from "vitest";

import { emptyInfiniteResearchLevels } from "../../db/research";
import { getDefaultResearchProgressMode } from "./get-default-research-progress-mode";

describe("getDefaultResearchProgressMode", () => {
  it("defaults to the pre-space target while research is at or below its space threshold", () => {
    expect(getDefaultResearchProgressMode({
      ...emptyInfiniteResearchLevels,
      maintenanceOutput: 4,
    })).toBe("before-space");
  });

  it("defaults to the full range when any research is past its space threshold", () => {
    expect(getDefaultResearchProgressMode({
      ...emptyInfiniteResearchLevels,
      maintenanceOutput: 5,
    })).toBe("full-range");
  });
});
