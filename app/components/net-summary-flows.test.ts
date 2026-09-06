import { expect, it } from "vitest";

import { type ResourceId, resources } from "../db/resources";
import { isReportedFactoryDeficit } from "./net-summary-flows";

it.each<ResourceId>(["railParts", "vehiclePartsI", "vehiclePartsII", "vehiclePartsIII", "steel"])(
  "reports even small real %s deficits",
  resourceId => {
    expect(isReportedFactoryDeficit({
      resourceId,
      name: resources[resourceId].name,
      consumed: 0.1,
      produced: 0,
      net: -0.1,
    })).toBe(true);
  },
);
