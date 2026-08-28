import { Card } from "@carbonid1/design-system";
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
import { type FocusEffectId } from "../db/offices";
import { type UnityBudget } from "../db/unity";
import { planningWeather } from "../db/weather";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceDemandReduction } from "../helpers/modifiers/calculate-maintenance-demand";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRainwaterYield } from "../helpers/modifiers/calculate-rainwater-yield";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSettlementWaterUse } from "../helpers/modifiers/calculate-settlement-water-use";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../helpers/modifiers/calculate-tree-growth-speed";
import { calculateWorldMineOutput } from "../helpers/modifiers/calculate-world-mine-output";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";
import { getDataSourceSurfaceClassName } from "./DataSourceState";

interface Props {
  edictLevels: Record<EdictId, EdictLevel>;
  edictSources: Record<EdictId, ValueSource>;
  unityBudget: UnityBudget;
  maintenanceStatueCount: number;
  maintenanceOutputLevel: number;
  solarPowerLevel: number;
  cropYieldLevel: number;
  rainwaterYieldLevel: number;
  settlementWaterUseLevel: number;
  treeGrowthSpeedLevel: number;
  worldMineOutputLevel: number;
  focusBonuses: Readonly<Record<FocusEffectId, number>>;
}

const formatUnity = (value: number) => parseFloat(value.toFixed(3)).toLocaleString("en-US");
const formatSignedPercent = (value: number) => (
  value > 0 ? `+${value}%` : `${value}%`
);

export const EdictCard = ({
  edict,
  source,
  value,
}: {
  edict: EdictDefinition;
  source: ValueSource;
  value: EdictLevel;
}) => {
  const active = edict.levels.find((candidate) => candidate.level === value)
    ?? edict.levels.at(0);

  if (!active) return null;

  const maxLevel = edict.levels.at(-1)?.level ?? 0;
  const unityPerCycle = active.unityProductionPerCycle
    ?? (active.unityCostPerCycle > 0 ? -active.unityCostPerCycle : 0);

  return (
    <Card.Root className={source === "planned"
      ? getDataSourceSurfaceClassName("planned")
      : undefined}
    >
      <Card.Content className="p-3">
        <Card.Header>
          <Card.Title>{edict.name}</Card.Title>
          <Card.Description>{active.effect}</Card.Description>
          <Card.Action>
            <span className="flex flex-col items-end gap-0.5 text-right">
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {value} / {maxLevel}
              </span>
              {unityPerCycle !== 0 && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  Unity {unityPerCycle > 0 ? "+" : ""}{unityPerCycle} / cycle
                </span>
              )}
            </span>
          </Card.Action>
        </Card.Header>
      </Card.Content>
    </Card.Root>
  );
};

export const ModifiersView: React.FC<Props> = ({
  edictLevels,
  edictSources,
  unityBudget,
  maintenanceStatueCount,
  maintenanceOutputLevel,
  solarPowerLevel,
  cropYieldLevel,
  rainwaterYieldLevel,
  settlementWaterUseLevel,
  treeGrowthSpeedLevel,
  worldMineOutputLevel,
  focusBonuses,
}) => {
  const recyclingEfficiency = calculateRecyclingEfficiency(
    edictLevels.recyclingIncrease,
    focusBonuses.recyclingEfficiency,
  );
  const foodConsumption = calculateFoodConsumption(
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
    focusBonuses.foodConsumption,
  );
  const maintenanceOutput = calculateMaintenanceOutput(
    maintenanceOutputLevel,
    focusBonuses.maintenanceProduction,
  );
  const solarPower = calculateSolarPower(solarPowerLevel, normalizeCleanPanelsLevel(edictLevels.cleanPanels));
  const cropFarming = calculateCropFarmingModifiers(
    cropYieldLevel,
    normalizeFarmingBoostLevel(edictLevels.farmingBoost),
    focusBonuses.cropYield,
  );
  const waterSaver = getEdict("waterSaver").levels.find(
    (level) => level.level === edictLevels.waterSaver,
  );
  const waterDemandReductionPercent = waterSaver?.modeledEffects
    ?.waterDemandReductionPercent ?? 0;
  const waterSaverMultiplier = 1 - waterDemandReductionPercent / 100;
  const rainwaterYield = calculateRainwaterYield(rainwaterYieldLevel);
  const settlementWaterUse = calculateSettlementWaterUse(settlementWaterUseLevel);
  const effectiveCropWaterDemandPercent = (
    cropFarming.waterDemandMultiplier * waterSaverMultiplier - 1
  ) * 100;
  const effectiveSettlementWaterReductionPercent = (
    1 - settlementWaterUse.multiplier * waterSaverMultiplier
  ) * 100;
  const treeGrowthSpeed = calculateTreeGrowthSpeed(treeGrowthSpeedLevel);
  const worldMineOutput = calculateWorldMineOutput(
    worldMineOutputLevel,
    focusBonuses.worldMinesEfficiency,
  );
  const maintenanceDemand = calculateMaintenanceDemandReduction(
    normalizeMaintenanceReducerLevel(edictLevels.maintenanceReducer),
    maintenanceStatueCount,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Unity &amp; Policies</h2>
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
                source={edictSources[edict.id]}
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
              ["Settlement Water and Waste Water", formatSignedPercent(
                -effectiveSettlementWaterReductionPercent,
              )],
              ["Rainwater yield", `+${rainwaterYield.bonusPercent}%`],
              ["Tree growth speed", `+${treeGrowthSpeed.bonusPercent}%`],
              ["World mine bonus output", `+${worldMineOutput.bonusPercent}%`],
              ["Goods & services consumption", formatSignedPercent(
                focusBonuses.settlementConsumption,
              )],
              ["Settlement Unity", `+${focusBonuses.unityProduction}%`],
              ["Contracts profitability", `+${focusBonuses.contractsProfitability}%`],
              ["Contracts Unity cost", formatSignedPercent(
                focusBonuses.contractsUnityCost,
              )],
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
