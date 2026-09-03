import { type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@carbonid1/design-system", () => ({
  Card: {
    Root: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
    Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
    Description: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    Action: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  cn: (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" "),
}));

import { edictCatalog, getEdict } from "../db/edicts";
import {
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationLevel,
} from "../db/space-station";
import {
  EdictCard,
  formatComputingOverview,
  formatSpaceStationOverview,
  formatSignedPercent,
  MaintenanceDemandOverview,
  PopulationCapacityOverview,
  SpaceStationPlanOverview,
} from "./ModifiersView";

it("rounds calculated percentages before displaying them", () => {
  expect(formatSignedPercent(-19.999999999999996)).toBe("-20%");
  expect(formatSignedPercent(14.126)).toBe("+14.13%");
  expect(formatSignedPercent(-0.0000001)).toBe("0%");
});

it("condenses synced computing capacity into one overview line", () => {
  expect(formatComputingOverview(
    { dataCenterCount: 5, rackCount: 212, waterChillers: 5 },
    848,
  )).toBe("5 data centers · 48 + 48 + 48 + 48 + 20 racks · 848 TFLOPS");
});

it("shows only the final Population capacity", () => {
  const html = renderToStaticMarkup(<PopulationCapacityOverview capacity={4_896} />);

  expect(html).toContain("Population capacity");
  expect(html).toContain("4,896");
  expect(html).not.toContain("Housing");
  expect(html).not.toContain("multiplier");
  expect(html).not.toContain("%");
});

it("condenses the synced Space Station to its calculated effect and Rocket II cadence", () => {
  expect(formatSpaceStationOverview(
    defaultSpaceStationLevel,
    defaultRocketIiRecurringLogistics,
  )).toBe(
    "Level 4 · +25% research efficiency · Rocket II 126 cargo / launch · "
    + "every 11 cycles (0.92 in-game years)",
  );

  const html = renderToStaticMarkup(
    <SpaceStationPlanOverview
      station={defaultSpaceStationLevel}
      logistics={defaultRocketIiRecurringLogistics}
    />,
  );

  expect(html).toContain("Space Station");
  expect(html).not.toContain("Unity");
  expect(html).not.toContain("construction");
  expect(html).not.toContain("Net Summary");
});

it("shows synced maintenance demand with its completed-cycle history window", () => {
  const html = renderToStaticMarkup(
    <MaintenanceDemandOverview
      history={{
        maintenanceI: { averagePerCycle: 698.491667, sampleMonths: 120 },
        maintenanceII: { averagePerCycle: 321.225, sampleMonths: 120 },
        maintenanceIII: { averagePerCycle: 318.266667, sampleMonths: 120 },
      }}
    />,
  );

  expect(html).toContain("Maintenance demand");
  expect(html).toContain("Synced");
  expect(html).toContain("698.49 / cycle");
  expect(html).toContain("120 cycles · 10 in-game years");
});

it("presents planned Recycling Increase with numbers and the shared planned surface", () => {
  const html = renderToStaticMarkup(
    <EdictCard
      edict={getEdict("recyclingIncrease")}
      source="planned"
      value={5}
    />,
  );

  expect(html).toContain("border-dashed");
  expect(html).toContain("5 / 5");
  expect(html).toContain("+40% recycling efficiency");
  expect(html).toContain("Unity -7 / cycle");
  expect(html).not.toContain("overrides");
});

it("keeps every edict effect while omitting status narration", () => {
  const html = renderToStaticMarkup(
    <>
      {edictCatalog.map((edict) => (
        <EdictCard
          key={edict.id}
          edict={edict}
          source="synced"
          value={0}
        />
      ))}
    </>,
  );

  for (const edict of edictCatalog) {
    expect(html).toContain(edict.name);
    expect(html).toContain(edict.levels[0]?.effect ?? "Inactive");
  }
  expect(html).not.toContain("No direct Unity cost");
  expect(html).not.toContain("currently inactive");
  expect(html).not.toContain("overrides");
});

it("uses the building-card inactive treatment for level-zero edicts", () => {
  const inactiveHtml = renderToStaticMarkup(
    <EdictCard
      edict={getEdict("growthBoost")}
      source="synced"
      value={0}
    />,
  );
  const activeHtml = renderToStaticMarkup(
    <EdictCard
      edict={getEdict("growthBoost")}
      source="synced"
      value={1}
    />,
  );

  expect(inactiveHtml).toContain("[&amp;&gt;*]:opacity-40");
  expect(inactiveHtml).toContain("shadow-none");
  expect(inactiveHtml).toContain("border-success/20");
  expect(inactiveHtml).toContain("0 / 3");
  expect(inactiveHtml).toContain("Inactive");
  expect(activeHtml).not.toContain("opacity-40");
});

it.each([
  ["synced", "border-success/40"],
  ["planned", "border-dashed"],
] as const)("applies the %s source surface", (source, surfaceClass) => {
  const html = renderToStaticMarkup(
    <EdictCard
      edict={getEdict("growthBoost")}
      source={source}
      value={1}
    />,
  );

  expect(html).toContain(surfaceClass);
});
