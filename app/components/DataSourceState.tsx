import { cn } from "@carbonid1/design-system";

import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";

export type DataSourceMode = "modeled" | "synced" | "planned";

interface DataSourcePresentation {
  description: string;
  surfaceClassName: string;
}

export const getDataSourceMode = (source: ValueSource): DataSourceMode => (
  source === "default" ? "modeled" : source
);

const dataSourcePresentations: Record<DataSourceMode, DataSourcePresentation> = {
  modeled: {
    description: "Calculator-owned assumption",
    surfaceClassName: cn(
      "border-muted-foreground/30",
      "bg-[color-mix(in_oklab,var(--card)_96%,var(--muted-foreground))]",
    ),
  },
  synced: {
    description: "Current value synced from the game",
    surfaceClassName: cn(
      "border-success/40",
      "bg-[color-mix(in_oklab,var(--card)_94%,var(--success))]",
    ),
  },
  planned: {
    description: "Future override of synced and modeled values",
    surfaceClassName: cn(
      "border-dashed border-highlight/70",
      "bg-[color-mix(in_oklab,var(--card)_94%,var(--highlight))] shadow-none",
    ),
  },
};

export const getDataSourcePresentation = (source: ValueSource) => (
  dataSourcePresentations[getDataSourceMode(source)]
);

export const getDataSourceSurfaceClassName = (
  source: ValueSource,
  className?: string,
) => cn(getDataSourcePresentation(source).surfaceClassName, className);
