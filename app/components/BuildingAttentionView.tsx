import { Button, Tooltip } from "@carbonid1/design-system";
import { CirclePause, Hammer, Play } from "lucide-react";

import {
  type BuildingDiagnostic,
} from "../helpers/building-diagnostics/building-diagnostics";

interface Props {
  diagnostics: BuildingDiagnostic[];
  onOpenModule: (moduleId: string) => void;
}

const labels = {
  build: "Build",
  "can-pause": "Can pause",
  unpause: "Unpause",
} as const;

const icons = {
  build: Hammer,
  "can-pause": CirclePause,
  unpause: Play,
} as const;

const formatCount = (value: number) => parseFloat(value.toFixed(2));

const getTooltip = (diagnostic: BuildingDiagnostic) => {
  const affected = diagnostic.affectedResources.length > 0
    ? ` Affects ${diagnostic.affectedResources.join(", ")}.`
    : "";

  if (diagnostic.attention === "can-pause") {
    return `Current average load fits in fewer active buildings.${affected}`;
  }
  if (diagnostic.attention === "unpause") {
    return `Current capacity is constrained, but paused capacity is already built.${affected}`;
  }

  return `Current capacity is constrained and every built building is active.${affected}`;
};

export const BuildingAttentionView: React.FC<Props> = ({ diagnostics, onOpenModule }) => {
  const actionable = diagnostics
    .filter((diagnostic) => diagnostic.attention != null)
    .toSorted((a, b) => (
      a.moduleName.localeCompare(b.moduleName)
      || a.buildingName.localeCompare(b.buildingName)
    ));

  if (actionable.length === 0) return null;

  return (
    <section className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        Building attention
      </h4>
      <div className="grid gap-1 md:grid-cols-2">
        {actionable.map((diagnostic) => {
          const attention = diagnostic.attention;

          if (!attention) return null;

          const Icon = icons[attention];
          const tooltip = getTooltip(diagnostic);

          return (
            <Tooltip key={diagnostic.key} label={tooltip} maxWidth={320}>
              <Button
                variant="ghost"
                size="small"
                fullWidth
                className="h-auto justify-between px-2 py-1.5 text-left"
                onClick={() => onOpenModule(diagnostic.moduleId)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon aria-hidden="true" className={attention === "can-pause"
                    ? "size-4 shrink-0 text-attention-foreground"
                    : "size-4 shrink-0 text-destructive"}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {diagnostic.buildingName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {diagnostic.moduleName}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={attention === "can-pause"
                    ? "block text-xs font-medium text-attention-foreground"
                    : "block text-xs font-medium text-destructive"}
                  >
                    {labels[attention]} {diagnostic.attentionCount > 0
                      ? diagnostic.attentionCount
                      : ""}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {formatCount(diagnostic.load)} / {formatCount(diagnostic.active)} active
                  </span>
                </span>
              </Button>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
};
