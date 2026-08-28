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
import { EdictCard } from "./ModifiersView";

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
