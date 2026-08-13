import { cn } from "@carbonid1/design-system";
import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  focused: boolean;
  stretchChild?: boolean;
  targetKey: string;
}

export const getBuildingTargetId = (key: string) => `building-attention-${key}`;

export const BuildingCardTarget: React.FC<Props> = ({
  children,
  className,
  focused,
  stretchChild = true,
  targetKey,
}) => (
  <div
    className={cn(
      "scroll-mt-4 rounded-lg outline-none transition-shadow",
      stretchChild && "[&>*]:h-full",
      focused && "ring-2 ring-primary/40",
      className,
    )}
    id={getBuildingTargetId(targetKey)}
    tabIndex={-1}
  >
    {children}
  </div>
);
