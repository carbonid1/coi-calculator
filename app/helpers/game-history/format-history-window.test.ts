import { expect, it } from "vitest";

import { formatHistoryWindow } from "./format-history-window";

it("reports saved history in production cycles and in-game years", () => {
  expect(formatHistoryWindow(120)).toBe("120 cycles · 10 in-game years");
  expect(formatHistoryWindow(12)).toBe("12 cycles · 1 in-game year");
  expect(formatHistoryWindow(1)).toBe("1 cycle · 0.08 in-game years");
});
