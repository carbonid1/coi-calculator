import { type Recipe } from "./recipes";

type RuntimeRecipeBehavior = Partial<Pick<
  Recipe,
  | "allocation"
  | "allocationPriority"
  | "appliesRecyclingEfficiency"
  | "balanceBy"
  | "balanceInputIds"
  | "balanceInputScope"
  | "balanceOutputIds"
  | "consumeSurplusInputIds"
  | "consumeSurplusInputScope"
  | "displayName"
  | "electricityMultiplier"
  | "group"
  | "inputPriorities"
  | "sinkScope"
  | "surplusConsumptionPriority"
>>;

/** Calculator behavior for exact game recipes used by every generated module. */
export const runtimeRecipeBehaviors: Readonly<Record<string, RuntimeRecipeBehavior>> = {
  "AssemblyRoboticT2:OfficeSuppliesAssembly": {
    displayName: "Office Supplies",
  },
  "AnaerobicDigester:SludgeDigestion": {
    balanceBy: "input",
    balanceInputIds: ["sludge"],
  },
  "ArcFurnace2:CopperSmeltingArc": {
    balanceBy: "output",
    balanceOutputIds: ["moltenCopper"],
  },
  "ArcFurnace2:CopperSmeltingArcScrap": {
    balanceBy: "input",
    balanceInputIds: ["copperScrap"],
    electricityMultiplier: 0.6,
  },
  "ArcFurnace2:IronSmeltingArc": {
    allocation: "fallback",
    allocationPriority: 50,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["moltenIron"],
  },
  "ArcFurnace2:IronSmeltingArcScrap": {
    balanceBy: "input",
    balanceInputIds: ["ironScrap"],
    electricityMultiplier: 0.6,
  },
  "CasterCooledT2:SteelCastingCooled": {
    allocation: "fallback",
    allocationPriority: 30,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["steel"],
  },
  "ChemicalPlant2:GraphiteProductionCo2": {
    consumeSurplusInputIds: ["carbonDioxide"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 10,
  },
  "CoolingTowerT2:SteamDepletedCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamHpCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamLpCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamSpCondensationT2": { group: "sink" },
  "ElectrolyzerT2:BrineElectrolysis": {
    balanceBy: "output",
    balanceInputIds: ["brine"],
    balanceOutputIds: ["chlorine"],
    inputPriorities: { brine: 2 },
  },
  "EvaporationPondHeated:SaltMakingFromBrine": {
    balanceBy: "output",
    balanceInputIds: ["brine"],
    balanceOutputIds: ["salt"],
    inputPriorities: { brine: 3 },
  },
  "HydrogenReformer:HydrogenProductionFromSteamSp": {
    balanceBy: "output",
    balanceOutputIds: ["hydrogen"],
  },
  "IndustrialMixerT2:BiomassCompost": {
    balanceBy: "input",
    balanceInputIds: ["biomass"],
    balanceInputScope: "module",
  },
  "OxygenFurnaceT2:SteelSmeltingT2": {
    allocation: "fallback",
    allocationPriority: 40,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["moltenSteel"],
    consumeSurplusInputIds: [],
  },
  "Shredder:ShreddingRetiredWaste": { appliesRecyclingEfficiency: false },
  "SmokeStack:SmokeStackCarbonDioxide": {
    consumeSurplusInputIds: ["carbonDioxide"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 100,
  },
  "SmokeStack:SmokeStackExhaust": {
    consumeSurplusInputIds: ["exhaust"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 100,
  },
  "SmokeStackLarge:SmokeStackCarbonDioxide": {
    consumeSurplusInputIds: ["carbonDioxide"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 100,
  },
  "SmokeStackLarge:SmokeStackExhaust": {
    consumeSurplusInputIds: ["exhaust"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 100,
  },
  "SmokeStackLarge:SmokeStackOxygen": { group: "sink" },
  "WasteDump:BrineDumping": { group: "sink", sinkScope: "module" },
  "WasteDump:OceanWaterDumping": { group: "sink" },
  "WaterTreatmentPlant:WaterTreatmentT2": {
    balanceBy: "input",
    balanceInputIds: ["wasteWater"],
  },
};

/** Exact game UI order where an exported prototype's recipe list is not display-ordered. */
export const runtimeRecipePriorities: Readonly<Record<string, number>> = {
  "ArcFurnace2:CopperSmeltingArcScrap": 0,
  "ArcFurnace2:CopperSmeltingArc": 1,
  "ArcFurnace2:IronSmeltingArcScrap": 0,
  "ArcFurnace2:IronSmeltingArc": 1,
  "CoolingTowerT2:SteamDepletedCondensationT2": 0,
  "CoolingTowerT2:SteamHpCondensationT2": 1,
  "CoolingTowerT2:SteamLpCondensationT2": 2,
  "CoolingTowerT2:SteamSpCondensationT2": 3,
};
