import { Card, cn, type CardRootProps } from "@carbonid1/design-system";

import { type OperatingMode } from "../helpers/calculate/calculate";

interface Props extends CardRootProps {
  operatingMode: OperatingMode;
  inactive?: boolean;
  passive?: boolean;
}

export const ProductionCard: React.FC<Props> = ({
  operatingMode,
  inactive = false,
  passive = false,
  className,
  ...props
}) => (
  <Card.Root
    data-operating-mode={operatingMode}
    className={cn(
      passive && "border-dashed shadow-none",
      inactive && "border-dashed bg-transparent opacity-40 shadow-none",
      !inactive && operatingMode === "fixed" && "bg-primary/10 ring-1 ring-primary/20",
      className,
    )}
    {...props}
  />
);
