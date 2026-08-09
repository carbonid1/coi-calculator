import { Button, Card, Field } from "@carbonid1/design-system";

import { baseConfig } from "../db/config";
import {
  cleanPanelsEdict,
  cleanPanelsLevelOrder,
  edictLevelOrder,
  recyclingIncreaseEdict,
  type CleanPanelsLevel,
  type EdictLevel,
} from "../db/edicts";
import { maintenanceOutputResearch, solarPowerResearch } from "../db/research";
import { planningWeather } from "../db/weather";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";

interface Props {
  recyclingIncreaseLevel: EdictLevel;
  onRecyclingIncreaseLevelChange: (level: EdictLevel) => void;
  cleanPanelsLevel: CleanPanelsLevel;
  onCleanPanelsLevelChange: (level: CleanPanelsLevel) => void;
  maintenanceOutputLevel: number;
  onMaintenanceOutputLevelChange: (level: number) => void;
  solarPowerLevel: number;
  onSolarPowerLevelChange: (level: number) => void;
}

export const ModifiersView: React.FC<Props> = ({
  recyclingIncreaseLevel,
  onRecyclingIncreaseLevelChange,
  cleanPanelsLevel,
  onCleanPanelsLevelChange,
  maintenanceOutputLevel,
  onMaintenanceOutputLevelChange,
  solarPowerLevel,
  onSolarPowerLevelChange,
}) => {
  const activeRecyclingLevel = recyclingIncreaseEdict.levels[recyclingIncreaseLevel];
  const activeCleanPanelsLevel = cleanPanelsEdict.levels[cleanPanelsLevel];
  const recyclingEfficiency = calculateRecyclingEfficiency(recyclingIncreaseLevel);
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);
  const solarPower = calculateSolarPower(solarPowerLevel, cleanPanelsLevel);

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
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">Solar power</span>
              <span className="font-mono text-xl font-semibold text-foreground">
                +{solarPower.bonusPercent}%
              </span>
            </div>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-3">
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
                aria-label="Maintenance Output level"
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

        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{solarPowerResearch.name}</Card.Title>
              <Card.Description>
                +{solarPowerResearch.percentPerLevel}% solar production per level
              </Card.Description>
            </Card.Header>

            <Field.Root className="max-w-28">
              <Field.Label>Level</Field.Label>
              <Field.Control
                aria-label="Solar Power level"
                type="number"
                min={0}
                max={solarPowerResearch.maxLevel}
                step={1}
                value={solarPower.researchLevel}
                onChange={(event) => {
                  const nextLevel = event.currentTarget.valueAsNumber;

                  if (Number.isFinite(nextLevel)) onSolarPowerLevelChange(nextLevel);
                }}
              />
            </Field.Root>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Edicts
        </h3>
        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{recyclingIncreaseEdict.name}</Card.Title>
              <Card.Description>
                +{activeRecyclingLevel.efficiencyIncreasePercent}% recycling efficiency
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

        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{cleanPanelsEdict.name}</Card.Title>
              <Card.Description>
                +{activeCleanPanelsLevel.powerIncreasePercent}% solar power
              </Card.Description>
            </Card.Header>

            <div className="flex flex-wrap gap-1" role="group" aria-label="Clean Panels level">
              {cleanPanelsLevelOrder.map((level) => {
                const definition = cleanPanelsEdict.levels[level];
                const selected = level === cleanPanelsLevel;

                return (
                  <Button
                    key={level}
                    variant="ghost"
                    size="small"
                    selected={selected}
                    aria-pressed={selected}
                    onClick={() => onCleanPanelsLevelChange(level)}
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
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-foreground">
                Average sunlight ({planningWeather.horizonYears}Y)
              </span>
              <span className="font-mono font-semibold text-foreground">
                {planningWeather.averageSunIntensityPercent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {planningWeather.difficulty} weather · seed{" "}
              <span className="font-mono">{planningWeather.gameSeed}</span> · {planningWeather.gameVersion}
            </p>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  );
};
