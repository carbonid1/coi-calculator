import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Tooltip: ({ children }: { children: ReactNode }) => children,
  ContextMenu: {
    Root: ({ children }: { children: ReactNode }) => children,
    Trigger: ({ render }: { render: ReactNode }) => render,
    Portal: () => null,
  },
}));

import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import { BuildingAttentionView } from "./BuildingAttentionView";

const diagnostic = (buildingName: string): BuildingDiagnostic => ({
  key: buildingName,
  moduleId: "nuclear",
  moduleName: "Nuclear",
  buildingName,
  recipeName: "Steam chain",
  plannedCapacity: false,
  load: 1,
  active: 1,
  built: 1,
  attention: "build",
  attentionCount: 1,
  affectedResources: ["Steam (Super)"],
});

it("omits steam and FBR power-chain advice from Building Attention", () => {
  const excludedBuildings = [
    "Cooling Tower (Large)",
    "Fast Breeder Reactor",
    "High-Pressure Turbine II",
    "Hydrogen Reformer",
    "Low-Pressure Turbine II",
    "Power Generator II",
    "Super-Pressure Turbine",
    "Thermal Desalinator",
  ];
  const html = renderToStaticMarkup(
    <BuildingAttentionView
      diagnostics={[
        ...excludedBuildings.map(diagnostic),
        { ...diagnostic("Assembly V"), moduleId: "general", moduleName: "Default" },
      ]}
      onOpenBuilding={vi.fn()}
    />,
  );

  expect(html).toContain("Assembly V");
  for (const buildingName of excludedBuildings) {
    expect(html).not.toContain(buildingName);
  }
});

it.each([
  "Thermal desalinator",
  "Cooling tower (large)",
  "Fast breeder reactor",
  "High-pressure turbine II",
  "Hydrogen reformer",
  "Low-pressure turbine II",
  "Power generator II",
  "Super-pressure turbine",
  " THERMAL DESALINATOR ",
])("keeps the existing steam-chain exclusion for synced display name %s", buildingName => {
  const html = renderToStaticMarkup(
    <BuildingAttentionView
      diagnostics={[
        {
          ...diagnostic(buildingName),
          moduleId: "general",
          moduleName: "Default",
          attention: "can-pause",
        },
        { ...diagnostic("Assembly V"), attention: "can-pause" },
      ]}
      onOpenBuilding={vi.fn()}
    />,
  );

  expect(html).not.toContain(buildingName);
  expect(html).toContain("Assembly V");
  expect(html.match(/Can pause 1/g)).toHaveLength(1);
});

it("shows Space Research as a level-based station action", () => {
  const html = renderToStaticMarkup(
    <BuildingAttentionView
      diagnostics={[{
        ...diagnostic("Space Station"),
        moduleId: "space-station",
        moduleName: "Space Station",
        recipeName: "Space Research",
        attention: "upgrade",
        level: { current: 3, target: 4 },
      }]}
      onOpenBuilding={vi.fn()}
    />,
  );

  expect(html).toContain("Upgrade to level 4");
  expect(html).toContain("Level 3 / 4");
});

it("keeps the notice free of extra buttons while its context menu is closed", () => {
  const html = renderToStaticMarkup(
    <BuildingAttentionView
      diagnostics={[
        { ...diagnostic("Assembly V"), attention: "can-pause" },
        diagnostic("Mixer II"),
      ]}
      onOpenBuilding={vi.fn()}
      onKeepReadyChange={vi.fn()}
    />,
  );

  expect(html.match(/<button>/g)).toHaveLength(2);
  expect(html).not.toContain(">Keep ready<");
  expect(html).toContain("Build 1");
});
