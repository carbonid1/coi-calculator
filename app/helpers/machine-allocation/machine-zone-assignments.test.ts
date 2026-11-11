import { expect, it } from "vitest";

import {
  parseStoredMachineZoneAssignments,
  selectActiveMachineZoneAssignments,
  withMachineZoneAssignment,
} from "./machine-zone-assignments";

it("keeps well-formed stored choices and drops malformed ones", () => {
  expect(parseStoredMachineZoneAssignments(JSON.stringify({
    10: "claim-a", "-1": "claim-b", area: "claim-c", 12: 7, 13: null,
  }))).toEqual({ 10: "claim-a", "-1": "claim-b" });
});

it.each([null, "{", "null", "[]", "true"])("recovers from invalid stored choices: %s", value => {
  expect(parseStoredMachineZoneAssignments(value)).toEqual({});
});

it("activates only choices whose claim the factory offers now", () => {
  expect(selectActiveMachineZoneAssignments({ 10: "claim-a", 11: "claim-gone" }, new Set(["claim-a"])))
    .toEqual({ 10: "claim-a" });
});

it("keeps a choice whose claim is missing when another area's choice is saved or cleared", () => {
  const stored = parseStoredMachineZoneAssignments(JSON.stringify({ 10: "claim-a", 11: "claim-gone" }));

  expect(withMachineZoneAssignment(stored, 12, "claim-a")).toEqual({ 10: "claim-a", 11: "claim-gone", 12: "claim-a" });
  expect(withMachineZoneAssignment(stored, 10, null)).toEqual({ 11: "claim-gone" });
  expect(stored).toEqual({ 10: "claim-a", 11: "claim-gone" });
});
