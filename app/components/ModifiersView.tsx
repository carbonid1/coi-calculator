import { Card, cn } from "@carbonid1/design-system";
import { Sparkles } from "lucide-react";

import { baseConfig } from "../db/config";
import {
  edictCatalog,
  type EdictDefinition,
  type EdictId,
  type EdictLevel,
  getEdict,
  normalizeCleanPanelsLevel,
  normalizeFarmingBoostLevel,
  normalizeMaintenanceReducerLevel,
} from "../db/edicts";
import {
  cropYieldResearch,
  maintenanceOutputResearch,
  solarPowerResearch,
  treeGrowthSpeedResearch,
  worldMineOutputResearch,
} from "../db/research";
import { type UnityBudget } from "../db/unity";
import { planningWeather } from "../db/weather";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceDemandReduction } from "../helpers/modifiers/calculate-maintenance-demand";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../helpers/modifiers/calculate-tree-growth-speed";
import { calculateWorldMineOutput } from "../helpers/modifiers/calculate-world-mine-output";

interface Props {
  edictLevels: Record<EdictId, EdictLevel>;
  unityBudget: UnityBudget;
  maintenanceStatueCount: number;
  maintenanceOutputLevel: number;
  solarPowerLevel: number;
  cropYieldLevel: number;
  treeGrowthSpeedLevel: number;
  worldMineOutputLevel: number;
}

const formatUnity = (value: number) => parseFloat(value.toFixed(3)).toLocaleString("en-US");
const formatSignedPercent = (value: number) => (
  value > 0 ? `+${value}%` : `${value}%`
);

const EdictCard = ({
  edict,
  value,
}: {
  edict: EdictDefinition;
  value: EdictLevel;
}) => {
  const active = edict.levels.find((candidate) => candidate.level === value)
    ?? edict.levels.at(0);

  if (!active) return null;

  let unitySummary = "No direct Unity cost";

  if (active.unityCostPerCycle > 0) {
    unitySummary = `${active.unityCostPerCycle} Unity / cycle`;
  } else if (active.unityProductionPerCycle) {
    unitySummary = `Produces ${active.unityProductionPerCycle} Unity / cycle`;
  }

  return (
    <Card.Root>
      <Card.Content className="space-y-3">
        <Card.Header>
          <Card.Title>{edict.name}</Card.Title>
          <Card.Description>{active.effect}</Card.Description>
        </Card.Header>
        <div className="flex flex-wrap gap-1" aria-label={`${edict.name} level`}>
          {edict.levels.map((definition) => {
            const selected = definition.level === value;

            return (
              <span
                key={definition.level}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs text-muted-foreground",
                  selected && "bg-primary/10 text-foreground ring-1 ring-primary/20",
                )}
              >
                {definition.label}
              </span>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {unitySummary}
        </p>
      </Card.Content>
    </Card.Root>
  );
};

const ResearchField = ({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: number;
}) => (
  <Card.Root>
    <Card.Content className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
      <Card.Header>
        <Card.Title>{label}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <p className="text-xs text-muted-foreground">Level</p>
        <p className="font-mono font-semibold text-foreground">{value}</p>
      </div>
    </Card.Content>
  </Card.Root>
);

export const ModifiersView: React.FC<Props> = ({
  edictLevels,
  unityBudget,
  maintenanceStatueCount,
  maintenanceOutputLevel,
  solarPowerLevel,
  cropYieldLevel,
  treeGrowthSpeedLevel,
  worldMineOutputLevel,
}) => {
  const recyclingEfficiency = calculateRecyclingEfficiency(edictLevels.recyclingIncrease);
  const foodConsumption = calculateFoodConsumption(
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
  );
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);
  const solarPower = calculateSolarPower(solarPowerLevel, normalizeCleanPanelsLevel(edictLevels.cleanPanels));
  const cropFarming = calculateCropFarmingModifiers(cropYieldLevel, normalizeFarmingBoostLevel(edictLevels.farmingBoost));
  const waterSaver = getEdict("waterSaver").levels.find(
    (level) => level.level === edictLevels.waterSaver,
  );
  const waterDemandReductionPercent = waterSaver?.modeledEffects
    ?.waterDemandReductionPercent ?? 0;
  const waterSaverMultiplier = 1 - waterDemandReductionPercent / 100;
  const effectiveCropWaterDemandPercent = (
    cropFarming.waterDemandMultiplier * waterSaverMultiplier - 1
  ) * 100;
  const treeGrowthSpeed = calculateTreeGrowthSpeed(treeGrowthSpeedLevel);
  const worldMineOutput = calculateWorldMineOutput(worldMineOutputLevel);
  const maintenanceDemand = calculateMaintenanceDemandReduction(
    normalizeMaintenanceReducerLevel(edictLevels.maintenanceReducer),
    maintenanceStatueCount,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Unity &amp; Policies</h2>
        <p className="text-sm text-muted-foreground">
          Steady-state Unity generation, recurring demand, edicts, and global bonuses.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Unity budget</h3>
        <Card.Root>
          <Card.Content className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["Generation", unityBudget.generationPerCycle],
                ["Recurring demand", unityBudget.consumptionPerCycle],
                ["Net", unityBudget.netPerCycle],
                ["Storage capacity", unityBudget.storageCapacity],
              ] satisfies [string, number][]).map(([label, amount]) => (
                <div key={label} className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles aria-hidden="true" className="size-3.5" />
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                    {formatUnity(amount)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generation</p>
                <dl>
                  {unityBudget.generation.map((item) => (
                    <div key={item.id} className="-mx-2 flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                      <dt className="text-muted-foreground">{item.name}</dt>
                      <dd className="font-mono font-semibold tabular-nums text-foreground">+{formatUnity(item.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurring demand</p>
                <dl>
                  {unityBudget.consumption.length > 0 ? unityBudget.consumption.map((item) => (
                    <div key={item.id} className="-mx-2 flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                      <dt className="text-muted-foreground">{item.name}</dt>
                      <dd className="font-mono font-semibold tabular-nums text-foreground">-{formatUnity(item.amount)}</dd>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">None</p>}
                </dl>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </section>

      {(["population", "industrial"] as const).map((category) => (
        <section key={category} className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {category === "population" ? "Population edicts" : "Industrial edicts"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {edictCatalog.filter((edict) => edict.category === category).map((edict) => (
              <EdictCard
                key={edict.id}
                edict={edict}
                value={edictLevels[edict.id]}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Calculated bonuses</h3>
        <Card.Root>
          <Card.Content className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Food consumption vs base", formatSignedPercent(foodConsumption.effectivePercent)],
              ["Recycling efficiency", `${recyclingEfficiency.effectivePercent}%`],
              ["Maintenance output", `+${maintenanceOutput.bonusPercent}%`],
              ["Solar power", `+${solarPower.bonusPercent}%`],
              ["Crop yield", `+${cropFarming.yieldBonusPercent}%`],
              ["Crop water demand", formatSignedPercent(
                parseFloat(effectiveCropWaterDemandPercent.toFixed(2)),
              )],
              ["Settlement water demand", formatSignedPercent(-waterDemandReductionPercent)],
              ["Tree growth speed", `+${treeGrowthSpeed.bonusPercent}%`],
              ["World mine bonus output", `+${worldMineOutput.bonusPercent}%`],
              ["Maintenance demand", `-${maintenanceDemand.totalReductionPercent}% (informational)`],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </Card.Content>
        </Card.Root>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Repeatable research</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <ResearchField label={maintenanceOutputResearch.name} description={`+${maintenanceOutputResearch.percentPerLevel}% maintenance production per level`} value={maintenanceOutputLevel} />
          <ResearchField label={solarPowerResearch.name} description={`+${solarPowerResearch.percentPerLevel}% solar production per level`} value={solarPowerLevel} />
          <ResearchField label={cropYieldResearch.name} description={`+${cropYieldResearch.percentPerLevel}% crop yield and +${cropYieldResearch.waterDemandPercentPerLevel}% water demand per level`} value={cropYieldLevel} />
          <ResearchField label={treeGrowthSpeedResearch.name} description={`+${treeGrowthSpeedResearch.percentPerLevel}% tree growth speed per level`} value={treeGrowthSpeedLevel} />
          <ResearchField label={worldMineOutputResearch.name} description={`+${worldMineOutputResearch.percentPerLevel}% world mine and oil rig output per level without extra reserve depletion`} value={worldMineOutputLevel} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Game base</h3>
        <Card.Root>
          <Card.Content className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-muted-foreground">Base recycling</p><p className="font-mono font-semibold text-foreground">{baseConfig.recyclingEfficiencyPercent}%</p></div>
            <div><p className="text-sm text-muted-foreground">Average sunlight ({planningWeather.horizonYears}Y)</p><p className="font-mono font-semibold text-foreground">{planningWeather.averageSunIntensityPercent}%</p></div>
          </Card.Content>
        </Card.Root>
      </section>
    </div>
  );
};
