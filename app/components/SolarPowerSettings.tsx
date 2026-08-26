import { Card } from "@carbonid1/design-system";

import { SOLAR_POWER_MODULE_ID } from "../db/modules/solar-power";
import { solarPanelOrder, solarPanels, type SolarPanelCounts } from "../db/solar";
import { planningWeather } from "../db/weather";
import { BuildingCardTarget } from "./BuildingCardTarget";
import { getDataSourceSurfaceClassName } from "./DataSourceState";

interface Props {
  builtCounts: SolarPanelCounts;
  currentAverageGenerationMw: number;
  focusedTargetKey?: string;
  plannedTargets: Partial<SolarPanelCounts>;
  projectedAverageGenerationMw: number;
  projectedCounts: SolarPanelCounts;
  runningCounts: SolarPanelCounts;
}

const formatPower = (megawatts: number) => `${parseFloat(megawatts.toFixed(1))} MW`;
const hasPendingPlan = (
  plannedTargets: Partial<SolarPanelCounts>,
  runningCounts: SolarPanelCounts,
) => solarPanelOrder.some((panel) => (
  plannedTargets[panel] != null
  && runningCounts[panel] < (plannedTargets[panel] ?? 0)
));

export const SolarPowerSettings: React.FC<Props> = ({
  builtCounts,
  currentAverageGenerationMw,
  focusedTargetKey,
  plannedTargets,
  projectedAverageGenerationMw,
  projectedCounts,
  runningCounts,
}) => (
  <Card.Root className="max-w-2xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Solar power</Card.Title>
        <Card.Description>
          {planningWeather.averageSunIntensityPercent}% average sunlight ({planningWeather.horizonYears}Y, {planningWeather.difficulty})
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        {solarPanelOrder.map((panel) => {
          const target = plannedTargets[panel];
          const pendingPlan = target != null && runningCounts[panel] < target;
          const remainingToBuild = target == null
            ? 0
            : Math.max(0, target - builtCounts[panel]);
          const remainingToStart = target == null
            ? 0
            : Math.max(0, target - runningCounts[panel] - remainingToBuild);
          const targetKey = `${SOLAR_POWER_MODULE_ID}:${solarPanels[panel].recipeId}`;

          return (
            <BuildingCardTarget
              key={panel}
              focused={focusedTargetKey === targetKey}
              targetKey={targetKey}
            >
              <div className={pendingPlan
                ? getDataSourceSurfaceClassName(
                    "planned",
                    "rounded-lg border px-3 py-2",
                  )
                : "rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface"
              }>
                <p className="text-sm text-muted-foreground">{solarPanels[panel].name}</p>
                <p className="font-mono font-semibold tabular-nums text-foreground">
                  {runningCounts[panel].toLocaleString()} running
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {builtCounts[panel].toLocaleString()} built
                </p>
                {target != null && (
                  <p className={pendingPlan
                    ? "mt-2 text-xs font-medium text-highlight-foreground"
                    : "mt-2 text-xs text-success"
                  }>
                    {target.toLocaleString()} target
                    {remainingToBuild > 0 && ` · ${remainingToBuild.toLocaleString()} to build`}
                    {remainingToStart > 0 && ` · ${remainingToStart.toLocaleString()} to start`}
                    {!pendingPlan && " · complete"}
                  </p>
                )}
              </div>
            </BuildingCardTarget>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">Current average generation</p>
          <p className="font-mono font-semibold text-foreground">
            {formatPower(currentAverageGenerationMw)}
          </p>
        </div>
        <div className={hasPendingPlan(plannedTargets, runningCounts)
          ? getDataSourceSurfaceClassName(
              "planned",
              "rounded-lg border px-3 py-2",
            )
          : "rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface"
        }>
          <p className="text-sm text-muted-foreground">Projected average generation</p>
          <p className="font-mono font-semibold text-foreground">
            {formatPower(projectedAverageGenerationMw)}
          </p>
          <p className="text-xs text-muted-foreground">
            {solarPanelOrder
              .map((panel) => `${projectedCounts[panel].toLocaleString()} ${panel}`)
              .join(" · ")}
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
);
