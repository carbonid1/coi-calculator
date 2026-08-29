import { Tooltip } from "@carbonid1/design-system";

import {
  type AnimalPopulationDiagnostic,
  type BuildingAttention,
} from "../helpers/building-diagnostics/building-diagnostics";
import { formatBuildingLoad } from "../helpers/format-building-load";

interface Props {
  load: number;
  active: number;
  built: number;
  planned?: number;
  attention?: BuildingAttention | null;
  attentionCount?: number;
  animalPopulation?: AnimalPopulationDiagnostic;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));

const attentionLabel = (
  attention: BuildingAttention,
  count: number,
  animalPopulation?: AnimalPopulationDiagnostic,
) => {
  if (attention === "add-animals" && animalPopulation) {
    return `Add ${count.toLocaleString()} ${animalPopulation.label}`;
  }
  if (attention === "remove-animals" && animalPopulation) {
    return `Remove ${count.toLocaleString()} ${animalPopulation.label}`;
  }
  if (attention === "can-pause") return `Can pause ${count}`;
  if (attention === "rebalance-farms") return "Rebalance farms";
  if (attention === "unpause") return `Unpause ${count}`;

  return "Build capacity";
};

export const BuildingCount: React.FC<Props> = ({
  load,
  active,
  built,
  planned = 0,
  attention,
  attentionCount = 0,
  animalPopulation,
}) => {
  const syncedActive = Math.max(0, active - planned);
  const paused = Math.max(0, built - syncedActive);

  return (
    <div className="shrink-0 text-right tabular-nums">
      <Tooltip
        label={animalPopulation
          ? `Planned ${animalPopulation.label} / capacity in built farms.`
          : "Average load / active buildings. Paused buildings are shown separately."}
        maxWidth={280}
      >
        <span className="inline-flex gap-1 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">
            {animalPopulation ? "Chickens" : "Load"}
          </span>
          <span className="font-mono">
            {animalPopulation
              ? `${formatCount(animalPopulation.current)} / ${formatCount(animalPopulation.capacity)}`
              : `${formatBuildingLoad(load)} / ${formatCount(active)}`}
          </span>
        </span>
      </Tooltip>
      {!animalPopulation && (paused > 0 || planned > 0) && (
        <p className="text-xs text-muted-foreground">
          {planned > 0
            ? `${formatCount(syncedActive)} synced active · ${formatCount(planned)} planned`
            : `${formatCount(active)} active`}
          {paused > 0 ? ` · ${formatCount(paused)} paused` : ''}
        </p>
      )}
      {attention && (
        <p className={attention === "can-pause" || attention === "remove-animals"
          ? "text-xs font-medium text-attention-foreground"
          : "text-xs font-medium text-destructive"}
        >
          {attentionLabel(attention, attentionCount, animalPopulation)}
        </p>
      )}
    </div>
  );
};
