"use client";

import { Card, SegmentedControl, Tooltip } from "@carbonid1/design-system";
import { useState } from "react";

import { type ResearchModuleConfig } from "../db/modules/research";
import {
  calculateInfiniteResearchLevelCost,
  calculateInfiniteResearchRemainingCost,
  infiniteResearchCatalog,
  type InfiniteResearchDefinition,
  type InfiniteResearchId,
} from "../db/research";

interface ResearchSettingsProps {
  config: ResearchModuleConfig;
}

interface InfiniteResearchSettingsProps {
  levels: Readonly<Record<InfiniteResearchId, number>>;
}

type ResearchProgressMode = "before-space" | "full-range";

const formatResearchPoints = (value: number) => value.toLocaleString("en-US");

const getResearchTarget = (
  research: InfiniteResearchDefinition,
  mode: ResearchProgressMode,
) => mode === "before-space" ? research.spaceResearchLevel : research.maxLevel;

const getResearchProgressTooltip = (
  research: InfiniteResearchDefinition,
  currentLevel: number,
  targetLevel: number,
  mode: ResearchProgressMode,
) => {
  if (currentLevel >= research.maxLevel) {
    return `Maximum level reached · ${currentLevel}/${research.maxLevel}`;
  }

  const nextLevel = currentLevel + 1;
  const nextLevelCost = calculateInfiniteResearchLevelCost(research, nextLevel);

  if (mode === "before-space" && currentLevel >= targetLevel) {
    return `Pre-space target reached · Level ${nextLevel} costs ${formatResearchPoints(nextLevelCost)} Research Points and requires Space Research Points`;
  }

  const remainingCost = calculateInfiniteResearchRemainingCost(
    research,
    currentLevel,
    targetLevel,
  );

  return `Level ${nextLevel} costs ${formatResearchPoints(nextLevelCost)} Research Points · ${formatResearchPoints(remainingCost)} remaining to level ${targetLevel}`;
};

const ResearchProgressCard = ({
  research,
  currentLevel,
  mode,
}: {
  research: InfiniteResearchDefinition;
  currentLevel: number;
  mode: ResearchProgressMode;
}) => {
  const targetLevel = getResearchTarget(research, mode);
  const normalizedLevel = Math.min(
    research.maxLevel,
    Math.max(0, Math.trunc(currentLevel)),
  );
  const complete = normalizedLevel >= targetLevel;
  const tooltip = getResearchProgressTooltip(
    research,
    normalizedLevel,
    targetLevel,
    mode,
  );

  return (
    <Card.Root>
      <Card.Content className="gap-3 p-3">
        <Tooltip.Root>
          <Tooltip.Trigger
            delay={600}
            render={(
              <progress
                aria-label={`${research.name}: level ${normalizedLevel} of ${targetLevel}`}
                className="h-2 w-full cursor-help appearance-none overflow-hidden rounded-full bg-surface-inset accent-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-surface-inset [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
                max={targetLevel}
                tabIndex={0}
                value={Math.min(normalizedLevel, targetLevel)}
              />
            )}
          />
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup className="max-w-sm whitespace-normal">
                {tooltip}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Card.Header>
          <Card.Title className="text-sm">{research.name}</Card.Title>
          <Card.Description className="text-xs">
            {research.effectPerLevel}
          </Card.Description>
          <Card.Action>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {normalizedLevel} / {targetLevel}
            </p>
            {complete && (
              <p className="text-right text-[0.6875rem] text-muted-foreground">
                {mode === "before-space" ? "Pre-space complete" : "Maxed"}
              </p>
            )}
          </Card.Action>
        </Card.Header>
      </Card.Content>
    </Card.Root>
  );
};

export const ResearchSettings: React.FC<ResearchSettingsProps> = ({ config }) => (
  <Card.Root className="max-w-2xl">
    <Card.Content>
      <div className="max-w-xs rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <p className="text-sm text-muted-foreground">Active Research Lab IV</p>
        <p className="font-mono font-semibold text-foreground">
          {config.activeResearchLabIvCount.toLocaleString()}
        </p>
      </div>
    </Card.Content>
  </Card.Root>
);

export const InfiniteResearchSettings: React.FC<InfiniteResearchSettingsProps> = ({
  levels,
}) => {
  const [mode, setMode] = useState<ResearchProgressMode>("before-space");
  const completedCount = infiniteResearchCatalog.filter((research) => (
    levels[research.id] >= getResearchTarget(research, mode)
  )).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Infinite research
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completedCount} of {infiniteResearchCatalog.length} targets reached
          </p>
        </div>

        <SegmentedControl.Root
          aria-label="Infinite research progress target"
          onValueChange={setMode}
          value={mode}
        >
          <SegmentedControl.Item value="before-space">
            Before space points
          </SegmentedControl.Item>
          <SegmentedControl.Item value="full-range">
            With space points
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {infiniteResearchCatalog.map((research) => (
          <ResearchProgressCard
            key={research.id}
            currentLevel={levels[research.id]}
            mode={mode}
            research={research}
          />
        ))}
      </div>
    </section>
  );
};
