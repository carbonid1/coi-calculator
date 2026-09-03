import { cn } from "@carbonid1/design-system";

import { type ValueSource } from "../data-source";

const dataSourceSurfaceClassNames: Record<ValueSource, string> = {
  synced: cn(
    "border-success/40",
    "bg-[color-mix(in_oklab,var(--card)_94%,var(--success))]",
  ),
  planned: cn(
    "border-dashed border-highlight/70",
    "bg-[color-mix(in_oklab,var(--card)_94%,var(--highlight))] shadow-none",
  ),
};

interface DataSourceSurfaceOptions {
  className?: string;
  inactive?: boolean;
}

export const getDataSourceSurfaceClassName = (
  source: ValueSource,
  { className, inactive = false }: DataSourceSurfaceOptions = {},
) => cn(
  dataSourceSurfaceClassNames[source],
  inactive && source === "synced" && "border-success/20",
  className,
);
