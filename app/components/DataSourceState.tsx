import {
  Badge,
  type BadgeProps,
  cn,
  Tooltip,
} from "@carbonid1/design-system";

import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";

export type DataSourceMode = "modeled" | "synced" | "planned";

interface DataSourcePresentation {
  badgeVariant: BadgeProps["variant"];
  description: string;
  label: string;
  surfaceClassName: string;
}

const getDataSourceMode = (source: ValueSource): DataSourceMode => (
  source === "default" ? "modeled" : source
);

const dataSourcePresentations: Record<DataSourceMode, DataSourcePresentation> = {
  modeled: {
    badgeVariant: "default",
    description: "Calculator-owned assumption",
    label: "Modeled",
    surfaceClassName: cn(
      "border-muted-foreground/30",
      "bg-[color-mix(in_oklab,var(--card)_96%,var(--muted-foreground))]",
    ),
  },
  synced: {
    badgeVariant: "success",
    description: "Current value synced from the game",
    label: "Synced",
    surfaceClassName: cn(
      "border-success/40",
      "bg-[color-mix(in_oklab,var(--card)_94%,var(--success))]",
    ),
  },
  planned: {
    badgeVariant: "attention",
    description: "Future override of synced and modeled values",
    label: "Planned",
    surfaceClassName: cn(
      "border-attention-border",
      "bg-[color-mix(in_oklab,var(--card)_92%,var(--attention))]",
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

export const DataSourceBadge = ({
  className,
  source,
}: {
  className?: string;
  source: ValueSource;
}) => {
  const presentation = getDataSourcePresentation(source);

  return (
    <Tooltip label={presentation.description}>
      <Badge className={className} variant={presentation.badgeVariant}>
        {presentation.label}
      </Badge>
    </Tooltip>
  );
};
