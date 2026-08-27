import { type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  Popover: {
    Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Trigger: ({ render }: { render: ReactElement }) => render,
    Portal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Positioner: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Description: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

import { MachineZoneMappingsView } from "./MachineZoneMappingsView";

const claims = [{
  id: "greenhouses-groundwater",
  moduleId: "greenhouses",
  moduleName: "Greenhouses",
  recipeId: "groundwater-pump",
  machineName: "Groundwater Pump",
  kind: "groundwater-pump" as const,
  target: 5,
}];

const zone = {
  id: 7,
  name: "Shared pumps",
  machineName: "Groundwater Pump",
  built: 6,
  running: 6,
  paused: 0,
  assignedClaimId: "greenhouses-groundwater",
  manuallyAssigned: true,
  needsAssignment: false,
};

describe("MachineZoneMappingsView", () => {
  it("keeps a correction control for resolved manual mappings", () => {
    const html = renderToStaticMarkup(
      <MachineZoneMappingsView claims={claims} zones={[zone]} onAssign={vi.fn()} />,
    );

    expect(html).toContain("Edit machine-zone mappings");
    expect(html).toContain("Shared pumps");
    expect(html).toContain('aria-pressed="true"');
  });

  it("does not expose automatic mappings as saved user choices", () => {
    const html = renderToStaticMarkup(
      <MachineZoneMappingsView
        claims={claims}
        zones={[{ ...zone, manuallyAssigned: false }]}
        onAssign={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });
});
