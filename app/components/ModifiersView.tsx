import { Button, Card, Field } from "@carbonid1/design-system";

import { baseConfig } from "../db/config";
import {
  cleanPanelsEdict,
  cleanPanelsLevelOrder,
  edictLevelOrder,
  farmingBoostEdict,
  farmingBoostLevelOrder,
  maintenanceReducerEdict,
  maintenanceReducerLevelOrder,
  recyclingIncreaseEdict,
  type CleanPanelsLevel,
  type EdictLevel,
  type FarmingBoostLevel,
  type MaintenanceReducerLevel,
} from "../db/edicts";
import { maintenanceStatue } from "../db/maintenance-statue";
import {
  cropYieldResearch,
  maintenanceOutputResearch,
  solarPowerResearch,
} from "../db/research";
import { planningWeather } from "../db/weather";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateMaintenanceDemandReduction } from "../helpers/modifiers/calculate-maintenance-demand";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";

interface Props {
  recyclingIncreaseLevel: EdictLevel;
  onRecyclingIncreaseLevelChange: (level: EdictLevel) => void;
  cleanPanelsLevel: CleanPanelsLevel;
  onCleanPanelsLevelChange: (level: CleanPanelsLevel) => void;
  farmingBoostLevel: FarmingBoostLevel;
  onFarmingBoostLevelChange: (level: FarmingBoostLevel) => void;
  maintenanceReducerLevel: MaintenanceReducerLevel;
  onMaintenanceReducerLevelChange: (level: MaintenanceReducerLevel) => void;
  maintenanceStatueCount: number;
  onMaintenanceStatueCountChange: (count: number) => void;
  maintenanceOutputLevel: number;
  onMaintenanceOutputLevelChange: (level: number) => void;
  solarPowerLevel: number;
  onSolarPowerLevelChange: (level: number) => void;
  cropYieldLevel: number;
  onCropYieldLevelChange: (level: number) => void;
}

export const ModifiersView: React.FC<Props> = ({
  recyclingIncreaseLevel,
  onRecyclingIncreaseLevelChange,
  cleanPanelsLevel,
  onCleanPanelsLevelChange,
  farmingBoostLevel,
  onFarmingBoostLevelChange,
  maintenanceReducerLevel,
  onMaintenanceReducerLevelChange,
  maintenanceStatueCount,
  onMaintenanceStatueCountChange,
  maintenanceOutputLevel,
  onMaintenanceOutputLevelChange,
  solarPowerLevel,
  onSolarPowerLevelChange,
  cropYieldLevel,
  onCropYieldLevelChange,
}) => {
  const activeRecyclingLevel = recyclingIncreaseEdict.levels[recyclingIncreaseLevel];
  const activeCleanPanelsLevel = cleanPanelsEdict.levels[cleanPanelsLevel];
  const activeFarmingBoostLevel = farmingBoostEdict.levels[farmingBoostLevel];
  const activeMaintenanceReducerLevel = maintenanceReducerEdict.levels[maintenanceReducerLevel];
  const recyclingEfficiency = calculateRecyclingEfficiency(recyclingIncreaseLevel);
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);
  const solarPower = calculateSolarPower(solarPowerLevel, cleanPanelsLevel);
  const cropFarming = calculateCropFarmingModifiers(cropYieldLevel, farmingBoostLevel);
  const maintenanceDemand = calculateMaintenanceDemandReduction(
    maintenanceReducerLevel,
    maintenanceStatueCount,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Modifiers</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Effective values
        </h3>
        <Card.Root>
          <Card.Content className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <span className="font-medium text-foreground">Recycling efficiency</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                {recyclingEfficiency.effectivePercent}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">Maintenance output</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                +{maintenanceOutput.bonusPercent}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">Solar power</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                +{solarPower.bonusPercent}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">Crop yield</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                +{cropFarming.yieldBonusPercent}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">Crop water demand</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                +{cropFarming.waterDemandBonusPercent}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-foreground">Maintenance demand</span>
              <span className="block font-mono text-xl font-semibold text-foreground">
                −{maintenanceDemand.totalReductionPercent}%
              </span>
              <span className="block text-xs text-muted-foreground">
                Informational only
              </span>
            </div>
          </Card.Content>
        </Card.Root>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
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

        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{cropYieldResearch.name}</Card.Title>
              <Card.Description>
                +{cropYieldResearch.percentPerLevel}% crop yield and +
                {cropYieldResearch.waterDemandPercentPerLevel}% crop water demand per level
              </Card.Description>
            </Card.Header>

            <Field.Root className="max-w-28">
              <Field.Label>Level</Field.Label>
              <Field.Control
                aria-label="Crop Yield level"
                type="number"
                min={0}
                max={cropYieldResearch.maxLevel}
                step={1}
                value={cropFarming.researchLevel}
                onChange={(event) => {
                  const nextLevel = event.currentTarget.valueAsNumber;

                  if (Number.isFinite(nextLevel)) onCropYieldLevelChange(nextLevel);
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

        <Card.Root>
          <Card.Content>
            <Card.Header>
              <Card.Title>{farmingBoostEdict.name}</Card.Title>
              <Card.Description>
                +{activeFarmingBoostLevel.yieldIncreasePercent}% crop yield · +
                {activeFarmingBoostLevel.waterDemandIncreasePercent}% crop water demand
              </Card.Description>
            </Card.Header>

            <div className="flex flex-wrap gap-1" role="group" aria-label="Farming Boost level">
              {farmingBoostLevelOrder.map((level) => {
                const definition = farmingBoostEdict.levels[level];
                const selected = level === farmingBoostLevel;

                return (
                  <Button
                    key={level}
                    variant="ghost"
                    size="small"
                    selected={selected}
                    aria-pressed={selected}
                    onClick={() => onFarmingBoostLevelChange(level)}
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
              <Card.Title>{maintenanceReducerEdict.name}</Card.Title>
              <Card.Description>
                −{activeMaintenanceReducerLevel.maintenanceReductionPercent}% maintenance demand
              </Card.Description>
            </Card.Header>

            <div className="flex flex-wrap gap-1" role="group" aria-label="Maintenance Reducer level">
              {maintenanceReducerLevelOrder.map((level) => {
                const definition = maintenanceReducerEdict.levels[level];
                const selected = level === maintenanceReducerLevel;

                return (
                  <Button
                    key={level}
                    variant="ghost"
                    size="small"
                    selected={selected}
                    aria-pressed={selected}
                    onClick={() => onMaintenanceReducerLevelChange(level)}
                  >
                    {definition.label}
                  </Button>
                );
              })}
            </div>
          </Card.Content>
        </Card.Root>
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Global buildings
        </h3>
        <Card.Root>
          <Card.Content className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
            <Card.Header>
              <Card.Title>{maintenanceStatue.name}</Card.Title>
              <Card.Description>
                −{maintenanceDemand.statueReductionPercent}% maintenance demand · {maintenanceDemand.statueFuelGasPerCycle} Fuel Gas / 60s
              </Card.Description>
              <p className="text-xs text-muted-foreground">
                Maintained statues; each additional effect is halved. Demand reduction is informational only.
              </p>
            </Card.Header>

            <Field.Root>
              <Field.Label>Count</Field.Label>
              <Field.Control
                aria-label="Maintenance statue count"
                type="number"
                min={0}
                step={1}
                value={maintenanceStatueCount}
                onChange={(event) => {
                  const nextCount = event.currentTarget.valueAsNumber;

                  if (Number.isFinite(nextCount)) {
                    onMaintenanceStatueCountChange(Math.max(0, Math.trunc(nextCount)));
                  }
                }}
              />
            </Field.Root>
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Base values
        </h3>
        <Card.Root>
          <Card.Content className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
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
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {planningWeather.difficulty} weather · seed{" "}
              <span className="font-mono">{planningWeather.gameSeed}</span> · {planningWeather.gameVersion}
            </p>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  );
};
