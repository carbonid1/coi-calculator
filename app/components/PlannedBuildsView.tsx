import { Button, Tooltip } from "@carbonid1/design-system";
import { Hammer, Settings2 } from "lucide-react";

import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  getPlannedBuildSummaries,
  getPlannedConfigurationSummaries,
} from "../helpers/planned-builds/planned-builds";
import { getDataSourceSurfaceClassName } from "./DataSourceState";

interface Props {
  diagnostics: BuildingDiagnostic[];
  onOpenBuilding: (diagnostic: BuildingDiagnostic) => void;
}

const formatCount = (value: number) => parseFloat(value.toFixed(2));

export const PlannedBuildsView: React.FC<Props> = ({ diagnostics, onOpenBuilding }) => {
  const plannedBuilds = getPlannedBuildSummaries(diagnostics);
  const plannedConfigurations = getPlannedConfigurationSummaries(diagnostics);

  if (plannedBuilds.length === 0 && plannedConfigurations.length === 0) return null;

  return (
    <section className={getDataSourceSurfaceClassName(
      "planned",
      "rounded-lg border p-3",
    )}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Plan checklist
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Complete these changes to make the projected Factory Total achievable.
      </p>
      {plannedBuilds.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">Buildings to construct</h5>
          <div className="mt-1 grid gap-1 md:grid-cols-2">
            {plannedBuilds.map((planned) => {
              return (
                <Tooltip
                  key={planned.key}
                  label={`Factory Total assumes this capacity is available. Remaining to build: ${planned.count} × ${planned.buildingName}.`}
                  maxWidth={320}
                >
                  <Button
                    variant="ghost"
                    size="small"
                    fullWidth
                    className="h-auto justify-between px-2 py-1.5 text-left"
                    onClick={() => onOpenBuilding(planned.diagnostic)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Hammer
                        aria-hidden="true"
                        className="size-4 shrink-0 text-highlight-foreground"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {planned.buildingName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {planned.moduleName}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-medium text-highlight-foreground">
                        {planned.count} to build
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {formatCount(planned.built)} built · {formatCount(planned.target)} target
                      </span>
                    </span>
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
      {plannedConfigurations.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground">Buildings to configure</h5>
          <div className="mt-1 grid gap-1 md:grid-cols-2">
            {plannedConfigurations.map((planned) => (
              <Tooltip
                key={planned.key}
                label={`Factory Total uses planned settings for ${planned.count} × ${planned.buildingName}.`}
                maxWidth={320}
              >
                <Button
                  variant="ghost"
                  size="small"
                  fullWidth
                  className="h-auto justify-between px-2 py-1.5 text-left"
                  onClick={() => onOpenBuilding(planned.diagnostic)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Settings2
                      aria-hidden="true"
                      className="size-4 shrink-0 text-highlight-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {planned.buildingName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {planned.moduleName}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-medium text-highlight-foreground">
                      {planned.count} to configure
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Planned settings
                    </span>
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
