import { Button, Tooltip } from "@carbonid1/design-system";
import { CircleMinus, CirclePause, CirclePlus, Hammer, Play, RefreshCw } from "lucide-react";

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
  "rebalance-farms": "Rebalance farms",
  unpause: "Unpause",
} as const;

const icons = {
  "add-animals": CirclePlus,
  build: Hammer,
  "can-pause": CirclePause,
  "rebalance-farms": RefreshCw,
  "remove-animals": CircleMinus,
  unpause: Play,
} as const;

const formatCount = (value: number) => parseFloat(value.toFixed(2));

const getTooltip = (diagnostic: BuildingDiagnostic) => {
  const affected = diagnostic.affectedResources.length > 0
    ? ` Affects ${diagnostic.affectedResources.join(", ")}.`
    : "";

  if (diagnostic.attention === "add-animals" && diagnostic.animalPopulation) {
    const { additionalBuildings, label } = diagnostic.animalPopulation;
    const capacityNote = additionalBuildings > 0
      ? ` Also requires ${additionalBuildings} more ${diagnostic.buildingName}${additionalBuildings === 1 ? "" : "s"}.`
      : "";

    return `Direct output demand requires ${diagnostic.attentionCount.toLocaleString()} more ${label}.${affected}${capacityNote}`;
  }
  if (diagnostic.attention === "remove-animals" && diagnostic.animalPopulation) {
    return `Every direct output remains covered with ${diagnostic.attentionCount.toLocaleString()} fewer ${diagnostic.animalPopulation.label}.`;
  }
  if (diagnostic.attention === "rebalance-farms") {
    return `Fixed crop rotations no longer cover ${diagnostic.affectedResources.join(", ")}. Rebalance the schedules before adding Greenhouse capacity.`;
  }
  if (diagnostic.attention === "can-pause") {
    return `Current average load fits in fewer active buildings.${affected}`;
  }
  if (diagnostic.attention === "unpause") {
    return `Current capacity is constrained, but paused capacity is already built.${affected}`;
  }

  return `Current capacity is constrained and every built building is active.${affected}`;
};

const getAttentionLabel = (diagnostic: BuildingDiagnostic) => {
  if (
    diagnostic.attention === "add-animals"
    || diagnostic.attention === "remove-animals"
  ) {
    const verb = diagnostic.attention === "add-animals" ? "Add" : "Remove";
    const label = diagnostic.animalPopulation?.label ?? "animals";

    return `${verb} ${diagnostic.attentionCount.toLocaleString()} ${label}`;
  }

  if (!diagnostic.attention) return "";

  return `${labels[diagnostic.attention]}${diagnostic.attentionCount > 0
    ? ` ${diagnostic.attentionCount}`
    : ""}`;
};

const isAttentionNotice = (attention: BuildingDiagnostic["attention"]) => (
  attention === "can-pause"
  || attention === "rebalance-farms"
  || attention === "remove-animals"
);

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
          const notice = isAttentionNotice(attention);

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
                  <Icon aria-hidden="true" className={notice
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
                  <span className={notice
                    ? "block text-xs font-medium text-attention-foreground"
                    : "block text-xs font-medium text-destructive"}
                  >
                    {getAttentionLabel(diagnostic)}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {attention === "rebalance-farms"
                      ? `${diagnostic.affectedResources.join(", ")} short`
                      : diagnostic.animalPopulation
                      ? `${formatCount(diagnostic.animalPopulation.current)} / ${formatCount(diagnostic.animalPopulation.capacity)} ${diagnostic.animalPopulation.label}`
                      : `${formatCount(diagnostic.load)} / ${formatCount(diagnostic.active)} active`}
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
