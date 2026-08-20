import { describe, expect, it } from "vitest";

import { modules } from "../db/modules/modules";
import { moduleIcons } from "./module-icons";

describe("moduleIcons", () => {
  it("defines an icon for every configured module", () => {
    const modulesWithoutIcons = modules
      .filter(({ id }) => !(id in moduleIcons))
      .map(({ id }) => id);

    expect(modulesWithoutIcons).toEqual([]);
  });
});
