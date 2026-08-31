import { Card, cn, type CardRootProps } from "@carbonid1/design-system";

import { type OperatingMode } from "../helpers/calculate/calculate";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";
import { getDataSourceSurfaceClassName } from "./DataSourceState";

interface Props extends CardRootProps {
  operatingMode: OperatingMode;
  dataSource?: ValueSource;
  inactive?: boolean;
  passive?: boolean;
}

export const ProductionCard: React.FC<Props> = ({
  operatingMode,
  dataSource,
  inactive = false,
  passive = false,
  className,
  ...props
}) => (
  <Card.Root
    className={cn(
      passive && !dataSource && "shadow-none",
      inactive && "[&>*]:opacity-40 shadow-none",
      inactive && !dataSource && "bg-transparent",
      !inactive
        && !dataSource
        && operatingMode === "fixed"
        && "bg-primary/10 ring-1 ring-primary/20",
      dataSource && getDataSourceSurfaceClassName(dataSource, { inactive }),
      className,
    )}
    {...props}
  />
);
