import { Button, Card } from "@carbonid1/design-system";

import { baseConfig } from "../db/config";
import { edictLevelOrder, recyclingIncreaseEdict, type EdictLevel } from "../db/edicts";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";

interface Props {
  recyclingIncreaseLevel: EdictLevel;
  onRecyclingIncreaseLevelChange: (level: EdictLevel) => void;
}

export const ModifiersView: React.FC<Props> = ({ recyclingIncreaseLevel, onRecyclingIncreaseLevelChange }) => {
  const activeLevel = recyclingIncreaseEdict.levels[recyclingIncreaseLevel];
  const recyclingEfficiency = calculateRecyclingEfficiency(recyclingIncreaseLevel);

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Modifiers</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Effective values
        </h3>
        <Card.Root>
          <Card.Content>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">Recycling efficiency</span>
              <span className="font-mono text-xl font-semibold text-foreground">
                {recyclingEfficiency.effectivePercent}%
              </span>
            </div>
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
