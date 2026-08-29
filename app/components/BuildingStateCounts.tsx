import { cn, Tooltip } from "@carbonid1/design-system";
import {
  CirclePause,
  DraftingCompass,
  Factory,
  Ghost,
  type LucideIcon,
} from "lucide-react";

export type BuildingState = "active" | "paused" | "ghost" | "planned";

const stateDefinitions: Record<
  BuildingState,
  { Icon: LucideIcon; label: string; className: string }
> = {
  active: {
    Icon: Factory,
    label: "active",
    className: "text-success",
  },
  paused: {
    Icon: CirclePause,
    label: "paused",
    className: "text-attention-foreground",
  },
  ghost: {
    Icon: Ghost,
    label: "construction ghost",
    className: "text-foreground",
  },
  planned: {
    Icon: DraftingCompass,
    label: "planned, not placed",
    className: "text-highlight-foreground",
  },
};

export const BuildingStateIcon: React.FC<{
  state: BuildingState;
  className?: string;
}> = ({ state, className }) => {
  const { Icon, className: stateClassName } = stateDefinitions[state];

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3 shrink-0", stateClassName, className)}
    />
  );
};

interface Props {
  active: number;
  paused?: number;
  ghosts?: number;
  planned?: number;
  className?: string;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));

export const BuildingStateCounts: React.FC<Props> = ({
  active,
  paused = 0,
  ghosts = 0,
  planned = 0,
  className,
}) => {
  const counts: { state: BuildingState; value: number }[] = [
    { state: "active", value: active },
    { state: "paused", value: paused },
    { state: "ghost", value: ghosts },
    { state: "planned", value: planned },
  ];
  const visibleCounts = counts.filter(({ state, value }) => (
    state === "active" || value > 0
  ));
  const label = visibleCounts
    .map(({ state, value }) => (
      `${formatCount(value)} ${stateDefinitions[state].label} building${value === 1 ? "" : "s"}`
    ))
    .join(" · ");

  return (
    <Tooltip label={label} maxWidth={320}>
      <span
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground",
          className,
        )}
      >
        {visibleCounts.map(({ state, value }, index) => (
          <span key={state} className="contents">
            {index > 0 && <span aria-hidden="true">·</span>}
            <span className="inline-flex items-center gap-0.5">
              <span className="font-mono">{formatCount(value)}</span>
              <BuildingStateIcon state={state} />
            </span>
          </span>
        ))}
      </span>
    </Tooltip>
  );
};
