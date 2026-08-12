import { Tooltip } from "@carbonid1/design-system";

import {
  type BuildingAttention,
} from "../helpers/building-diagnostics/building-diagnostics";

interface Props {
  load: number;
  active: number;
  built: number;
  attention?: BuildingAttention | null;
  attentionCount?: number;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));

const attentionLabel = (attention: BuildingAttention, count: number) => {
  if (attention === "can-pause") return `Can pause ${count}`;
  if (attention === "unpause") return `Unpause ${count}`;

  return "Build capacity";
};

export const BuildingCount: React.FC<Props> = ({
  load,
  active,
  built,
  attention,
  attentionCount = 0,
}) => {
  const paused = Math.max(0, built - active);

  return (
    <div className="shrink-0 text-right tabular-nums">
      <Tooltip
        label="Average load / active buildings. Paused buildings are shown separately."
        maxWidth={280}
      >
        <span className="inline-flex gap-1 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">Load</span>
          <span className="font-mono">{formatCount(load)} / {formatCount(active)}</span>
        </span>
      </Tooltip>
      {paused > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatCount(active)} active · {formatCount(paused)} paused
        </p>
      )}
      {attention && (
        <p className={attention === "can-pause"
          ? "text-xs font-medium text-attention-foreground"
          : "text-xs font-medium text-destructive"}
        >
          {attentionLabel(attention, attentionCount)}
        </p>
      )}
    </div>
  );
};
