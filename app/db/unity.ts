import { type ContractMode } from "./contracts";
import { type EdictId, type EdictLevel, edictCatalog } from "./edicts";
import { type HousingType } from "./housing";
import { settlementFoods } from "./settlement";

export const baseUnityStorage = 20;
/** Planning assumption: settlement quality is kept perfect. */
export const settlementQualityUnityPerCycle = 1;
/** Conservative planning baseline; positive health is variable and can generate more. */
export const healthUnityPerCycleBaseline = 1;

interface UnityServiceDefinition {
  id: "food" | "electricity" | "water" | "householdGoods" | "householdAppliances" | "luxuryGoods" | "consumerElectronics" | "computing" | "medicalI" | "medicalII" | "medicalIII";
  name: string;
  baseUnityPerCycle: number;
  active: boolean;
}

export const unityServiceDefinitions: readonly UnityServiceDefinition[] = [
  { id: "food", name: "Food", baseUnityPerCycle: 1, active: true },
  { id: "electricity", name: "Electricity", baseUnityPerCycle: 1.2, active: true },
  { id: "water", name: "Water", baseUnityPerCycle: 1, active: true },
  { id: "householdGoods", name: "Household Goods", baseUnityPerCycle: 1.4, active: false },
  { id: "householdAppliances", name: "Household Appliances", baseUnityPerCycle: 1.4, active: false },
  { id: "luxuryGoods", name: "Luxury Goods", baseUnityPerCycle: 1, active: false },
  { id: "consumerElectronics", name: "Consumer Electronics", baseUnityPerCycle: 1.4, active: false },
  { id: "medicalI", name: "Hospitals", baseUnityPerCycle: 0.5, active: true },
  { id: "medicalII", name: "Hospitals", baseUnityPerCycle: 0.75, active: false },
  { id: "medicalIII", name: "Hospitals", baseUnityPerCycle: 1, active: false },
  { id: "computing", name: "Computing", baseUnityPerCycle: 1, active: true },
] as const;

export type UnityServiceId = UnityServiceDefinition["id"];

export interface UnityBreakdownItem {
  id: string;
  name: string;
  amount: number;
}

export interface UnityBudget {
  generationPerCycle: number;
  consumptionPerCycle: number;
  netPerCycle: number;
  storageCapacity: number;
  housingMultiplier: number;
  generation: UnityBreakdownItem[];
  consumption: UnityBreakdownItem[];
}

interface ContractUnityInput {
  importedPerCycle: number;
  fixedUnityPerCycle: number;
  unityPer100Imported: number;
  mode: ContractMode;
}

export const calculateUnityBudget = ({
  housing,
  housingCount,
  edictLevels,
  contracts,
  buildingConsumption = [],
}: {
  housing: HousingType;
  housingCount: number;
  edictLevels: Record<EdictId, EdictLevel>;
  contracts: ContractUnityInput[];
  buildingConsumption?: UnityBreakdownItem[];
}): UnityBudget => {
  const normalizedHousingCount = Math.max(0, Math.trunc(housingCount));
  const population = normalizedHousingCount * housing.populationCapacity;
  const activeServices = unityServiceDefinitions.filter((service) => service.active);
  const activeServiceNames = new Set(activeServices.map((service) => service.name));
  const housingMultiplier = housing.unityBonusTiers
    .filter((tier) => tier.requirements.every((requirement) => activeServiceNames.has(requirement)))
    .at(-1)?.multiplier ?? 1;
  const foodVariety = population > 0
    ? settlementFoods.reduce((total, food) => total + food.unityPerCycleWhenSupplied, 0)
    : 0;
  const serviceGeneration = activeServices.map((service) => {
    const unityIncreasePercent = edictCatalog.reduce((total, edict) => {
      const active = edict.levels.find((candidate) => candidate.level === edictLevels[edict.id]);

      return active?.unityProductionServiceId === service.id
        ? total + (active.unityProductionIncreasePercent ?? 0)
        : total;
    }, 0);
    const serviceWithEdict = service.baseUnityPerCycle * (1 + unityIncreasePercent / 100);

    return {
      id: service.id,
      name: service.name,
      amount: population > 0
        ? serviceWithEdict * housingMultiplier
          + (service.id === "food" ? foodVariety : 0)
        : 0,
    };
  });
  const edictGeneration = edictCatalog.reduce((total, edict) => {
    const active = edict.levels.find((candidate) => candidate.level === edictLevels[edict.id]);

    return total + (active?.unityProductionPerCycle ?? 0);
  }, 0);
  const generation = [
    ...serviceGeneration,
    {
      id: "settlement-quality",
      name: "Settlements quality",
      amount: population > 0 ? settlementQualityUnityPerCycle : 0,
    },
    {
      id: "health",
      name: "Health",
      amount: population > 0 ? healthUnityPerCycleBaseline : 0,
    },
    ...(edictGeneration > 0
      ? [{
          id: "production-edicts",
          name: `${parseFloat(edictGeneration.toFixed(3))}x Edicts`,
          amount: edictGeneration,
        }]
      : []),
  ];
  const edictConsumption = edictCatalog.reduce((total, edict) => {
    const active = edict.levels.find((candidate) => candidate.level === edictLevels[edict.id]);

    return total + (active?.unityCostPerCycle ?? 0);
  }, 0);
  const contractConsumption = contracts.reduce((total, contract) => {
    if (contract.mode === "temporary") return total;
    const variable = contract.unityPer100Imported * contract.importedPerCycle / 100;

    return total + contract.fixedUnityPerCycle + variable;
  }, 0);
  const consumption: UnityBreakdownItem[] = [
    ...(edictConsumption > 0 ? [{ id: "edicts", name: "Edicts", amount: edictConsumption }] : []),
    ...(contractConsumption > 0 ? [{ id: "contracts", name: "Continuous contracts", amount: contractConsumption }] : []),
    ...buildingConsumption.filter((item) => item.amount > 0),
  ];
  const generationPerCycle = generation.reduce((total, item) => total + item.amount, 0);
  const consumptionPerCycle = consumption.reduce((total, item) => total + item.amount, 0);

  return {
    generationPerCycle,
    consumptionPerCycle,
    netPerCycle: generationPerCycle - consumptionPerCycle,
    storageCapacity: baseUnityStorage + housing.unityStorage * normalizedHousingCount,
    housingMultiplier,
    generation,
    consumption,
  };
};
