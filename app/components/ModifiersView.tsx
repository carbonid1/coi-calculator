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
import { type FocusEffectId } from "../db/offices";
import { type UnityBudget } from "../db/unity";
import { planningWeather } from "../db/weather";
import { type GameStateSnapshot } from "../game-state";
import { formatHistoryWindow } from "../helpers/game-history/format-history-window";
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
import { getDataSourceMode, getDataSourceSurfaceClassName } from "./DataSourceState";

interface Props {
  electricityGenerationCapacityMw: number;
  maintenanceHistory: GameStateSnapshot["history"]["maintenance"] | null;
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
const formatPower = (value: number) => (
  `${parseFloat(value.toFixed(2)).toLocaleString("en-US")} MW`
);

const maintenanceTiers = [
  ["maintenanceI", "Maintenance I"],
  ["maintenanceII", "Maintenance II"],
  ["maintenanceIII", "Maintenance III"],
] as const;

export const MaintenanceDemandOverview = ({
  history,
}: {
  history: GameStateSnapshot["history"]["maintenance"];
}) => (
  <section className="space-y-3">
    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
      Maintenance demand
    </h3>
    <Card.Root
      data-data-source="synced"
      className={getDataSourceSurfaceClassName("synced")}
    >
      <Card.Content className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-success">Synced</span>
          {" · Actual consumption across completed game cycles"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {maintenanceTiers
            .filter(([id]) => history[id].sampleMonths > 0)
            .map(([id, label]) => {
              const average = history[id];

              return (
                <div key={id} className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-mono font-semibold tabular-nums text-foreground">
                    {average.averagePerCycle.toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                    {" / cycle"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatHistoryWindow(average.sampleMonths)}
                  </p>
                </div>
              );
            })}
        </div>
      </Card.Content>
    </Card.Root>
  </section>
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
    <Card.Root
      data-data-source={getDataSourceMode(source)}
      className={cn(
        value === 0 && "[&>*]:opacity-40 shadow-none",
        getDataSourceSurfaceClassName(source, { inactive: value === 0 }),
      )}
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
  electricityGenerationCapacityMw,
  maintenanceHistory,
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
        <h2 className="text-xl font-semibold text-foreground">General Info</h2>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Factory overview</h3>
        <Card.Root>
          <Card.Content className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">Electricity generation capacity</p><p className="font-mono font-semibold text-foreground">{formatPower(electricityGenerationCapacityMw)}</p></div>
            <div><p className="text-sm text-muted-foreground">Average sunlight ({planningWeather.horizonYears}Y)</p><p className="font-mono font-semibold text-foreground">{planningWeather.averageSunIntensityPercent}%</p></div>
            <div><p className="text-sm text-muted-foreground">Base recycling</p><p className="font-mono font-semibold text-foreground">{baseConfig.recyclingEfficiencyPercent}%</p></div>
          </Card.Content>
        </Card.Root>
      </section>

      {maintenanceHistory && <MaintenanceDemandOverview history={maintenanceHistory} />}

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

    </div>
  );
};
