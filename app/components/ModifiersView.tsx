import { Button, Card, Field } from "@carbonid1/design-system";

import { baseConfig } from "../db/config";
import { edictLevelOrder, recyclingIncreaseEdict, type EdictLevel } from "../db/edicts";
import { maintenanceOutputResearch } from "../db/research";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";

interface Props {
  recyclingIncreaseLevel: EdictLevel;
  onRecyclingIncreaseLevelChange: (level: EdictLevel) => void;
  maintenanceOutputLevel: number;
  onMaintenanceOutputLevelChange: (level: number) => void;
}

export const ModifiersView: React.FC<Props> = ({ recyclingIncreaseLevel, onRecyclingIncreaseLevelChange, maintenanceOutputLevel, onMaintenanceOutputLevelChange }) => {
  const activeLevel = recyclingIncreaseEdict.levels[recyclingIncreaseLevel];
  const recyclingEfficiency = calculateRecyclingEfficiency(recyclingIncreaseLevel);
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Modifiers</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Effective values
        </h3>
        <Card.Root>
          <Card.Content className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">Recycling efficiency</span>
              <span className="font-mono text-xl font-semibold text-foreground">
                {recyclingEfficiency.effectivePercent}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">Maintenance output</span>
              <span className="font-mono text-xl font-semibold text-foreground">
                +{maintenanceOutput.bonusPercent}%
              </span>
            </div>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Repeatable research
        </h3>
        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{maintenanceOutputResearch.name}</Card.Title>
              <Card.Description>
                +{maintenanceOutputResearch.percentPerLevel}% maintenance production per level
              </Card.Description>
            </Card.Header>

            <Field.Root className="max-w-28">
              <Field.Label>Level</Field.Label>
              <Field.Control
                type="number"
                min={0}
                max={maintenanceOutputResearch.maxLevel}
                step={1}
                value={maintenanceOutput.level}
                onChange={(event) => {
                  const nextLevel = event.currentTarget.valueAsNumber;

                  if (Number.isFinite(nextLevel)) onMaintenanceOutputLevelChange(nextLevel);
                }}
              />
            </Field.Root>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Edicts
        </h3>
        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{recyclingIncreaseEdict.name}</Card.Title>
              <Card.Description>
                +{activeLevel.efficiencyIncreasePercent}% recycling efficiency
              </Card.Description>
            </Card.Header>

            <div className="flex flex-wrap gap-1" role="group" aria-label="Recycling Increase level">
              {edictLevelOrder.map((level) => {
                const definition = recyclingIncreaseEdict.levels[level];
                const selected = level === recyclingIncreaseLevel;

                return (
                  <Button
                    key={level}
                    variant="ghost"
                    size="small"
                    selected={selected}
                    aria-pressed={selected}
                    onClick={() => onRecyclingIncreaseLevelChange(level)}
                  >
                    {definition.label}
                  </Button>
                );
              })}
            </div>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Base values
        </h3>
        <Card.Root>
          <Card.Content>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">Recycling efficiency</span>
              <span className="font-mono font-semibold text-foreground">
                {baseConfig.recyclingEfficiencyPercent}%
              </span>
            </div>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  );
};
