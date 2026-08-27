import { Tooltip } from "@carbonid1/design-system";

import {
  type AnimalPopulationDiagnostic,
  type BuildingAttention,
} from "../helpers/building-diagnostics/building-diagnostics";
import { formatBuildingLoad } from "../helpers/format-building-load";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";

interface Props {
  load: number;
  active: number;
  built: number;
  attention?: BuildingAttention | null;
  attentionCount?: number;
  animalPopulation?: AnimalPopulationDiagnostic;
  dataSource?: ValueSource;
  showDataSourceLabel?: boolean;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));

const getDataSourceLabel = (source?: ValueSource) => {
  if (source === "synced") return "Synced";
  if (source === "planned") return "Planned";

  return "Modeled";
};

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
  attention,
  attentionCount = 0,
  animalPopulation,
  dataSource,
  showDataSourceLabel = false,
}) => {
  const paused = Math.max(0, built - active);
  const dataSourceLabel = getDataSourceLabel(dataSource);
  const displaysDataSource = showDataSourceLabel && dataSource !== undefined;

  return (
    <div className="shrink-0 text-right tabular-nums">
      {!displaysDataSource && (
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
      )}
      {displaysDataSource && (
        <p className="text-sm font-medium text-muted-foreground">
          {dataSourceLabel} <span className="font-mono">{formatCount(active)}</span>
        </p>
      )}
      {!displaysDataSource && !animalPopulation && paused > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatCount(active)} active · {formatCount(paused)} paused
        </p>
      )}
      {!displaysDataSource && attention && (
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
