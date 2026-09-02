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
  | "balanceOutputScope"
  | "consumeSurplusInputIds"
  | "consumeSurplusInputScope"
  | "demandPriority"
  | "displayName"
  | "electricityMultiplier"
  | "group"
  | "inputPriorities"
  | "sinkScope"
  | "surplusConsumptionPhase"
  | "surplusConsumptionPriority"
>>;

/** Calculator behavior for exact game recipes used by every generated module. */
export const runtimeRecipeBehaviors: Readonly<Record<string, RuntimeRecipeBehavior>> = {
  "AirSeparator:AirSeparation": {
    balanceBy: "output",
    balanceOutputIds: ["oxygen", "nitrogen"],
  },
  "AnaerobicDigester:CornDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["corn"],
  },
  "AnaerobicDigester:EggsDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["eggs"],
  },
  "AnaerobicDigester:FruitDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["fruit"],
  },
  "AnaerobicDigester:MeatTrimmingsDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["meatTrimmings"],
  },
  "AnaerobicDigester:PoppyDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["poppy"],
  },
  "AnaerobicDigester:PotatoDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["potato"],
  },
  "AnaerobicDigester:SoybeanDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["soybean"],
  },
  "AnaerobicDigester:SugarCaneDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["sugarCane"],
  },
  "AnaerobicDigester:VegetablesDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["vegetables"],
  },
  "AnaerobicDigester:WheatDigestion": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["wheat"],
  },
  "AssemblyRoboticT2:OfficeSuppliesAssembly": {
    displayName: "Office Supplies",
  },
  "AssemblyRoboticT2:FoodPackEggsAssembly": {
    balanceBy: "output",
    balanceInputIds: ["eggs"],
    balanceOutputIds: ["foodPack"],
    demandPriority: -1,
  },
  "AssemblyRoboticT2:FoodPackMeatAssembly": {
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["foodPack"],
  },
  "BakingUnit:CakeProduction": {
    balanceBy: "output",
    balanceOutputIds: ["cake"],
    demandPriority: -2,
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
  "ArcFurnace2:AluminumSmeltingScrapArcT2": {
    balanceBy: "input",
    balanceInputIds: ["aluminumScrap"],
    electricityMultiplier: 0.6,
  },
  "ArcFurnace2:GlassSmeltingArc": {
    balanceBy: "output",
    balanceOutputIds: ["moltenGlass"],
  },
  "ArcFurnace2:GlassSmeltingArcWithBroken": {
    balanceBy: "input",
    balanceInputIds: ["brokenGlass"],
    electricityMultiplier: 0.6,
  },
  "ArcFurnace2:IlmeniteSmeltingArc2": {
    balanceBy: "output",
    balanceOutputIds: ["titaniumSlag"],
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
  "ArcFurnace2:SiliconSmeltingArc2": {
    balanceBy: "output",
    balanceOutputIds: ["moltenSilicon"],
  },
  "ArcFurnace2:TitaniumSmeltingArc2": {
    balanceBy: "output",
    balanceOutputIds: ["moltenTitanium"],
  },
  "ArcFurnace2:TitaniumOreSmeltingArc2": {
    balanceBy: "output",
    balanceOutputIds: ["titaniumSlag"],
  },
  "AluminumCell:AluminumElectrolysis": {
    balanceBy: "output",
    balanceOutputIds: ["moltenAluminum"],
  },
  "CasterCooledT2:SteelCastingCooled": {
    allocation: "fallback",
    allocationPriority: 30,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["steel"],
  },
  "CharcoalMaker:CharcoalBurning": {
    balanceBy: "output",
    balanceOutputIds: ["coal"],
  },
  "ChemicalPlant2:GraphiteProductionCo2": {
    allocation: "fallback",
    allocationPriority: 20,
    balanceBy: "input",
    balanceInputIds: ["carbonDioxide"],
  },
  "ChemicalPlant2:AmmoniaSynthesis": {
    allocation: "fallback",
    allocationPriority: 50,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["ammonia"],
    electricityMultiplier: 2,
  },
  "ChemicalPlant2:CarbonToEthanolProduction": {
    balanceBy: "output",
    balanceOutputIds: ["ethanol"],
  },
  "ChemicalPlant2:BauxiteDigestion": {
    balanceBy: "output",
    balanceOutputIds: ["hydratedAlumina"],
  },
  "ChemicalPlant2:EthanolCookingOilReforming": {
    balanceBy: "output",
    balanceOutputIds: [],
    consumeSurplusInputIds: ["cookingOil"],
    surplusConsumptionPhase: "before-fallback",
    surplusConsumptionPriority: 110,
  },
  "ChemicalPlant2:GraphiteProduction": {
    allocation: "fallback",
    allocationPriority: 30,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["graphite"],
    electricityMultiplier: 2,
  },
  "ChemicalPlant2:TitaniumChlorideReduction": {
    balanceBy: "output",
    balanceOutputIds: ["titaniumSponge"],
    electricityMultiplier: 2,
  },
  "ChemicalPlant2:TitaniumChlorination": {
    balanceBy: "output",
    balanceOutputIds: ["titaniumChloride"],
    electricityMultiplier: 2,
  },
  "CoolingTowerT2:SteamDepletedCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamHpCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamLpCondensationT2": { group: "sink" },
  "CoolingTowerT2:SteamSpCondensationT2": { group: "sink" },
  "CrackingUnit:DieselReforming": {
    allocation: "surplus",
    allocationPriority: 100,
    balanceBy: "input",
    balanceInputIds: ["fuelGas"],
    balanceOutputIds: ["diesel"],
  },
  "DistillationTowerT3:TitaniumPurification": {
    balanceBy: "output",
    balanceOutputIds: ["titaniumChloridePure"],
  },
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
  "ExhaustScrubber:ExhaustFilteringLime": {
    balanceBy: "input",
    balanceInputIds: ["exhaust"],
    group: "waste",
    inputPriorities: { exhaust: 1 },
  },
  "FermentationTank:AntibioticsFermentation": {
    balanceBy: "output",
    balanceOutputIds: ["antibiotics"],
  },
  "FoodMill:CanolaMilling": {
    balanceBy: "output",
    balanceOutputIds: ["cookingOil"],
    consumeSurplusInputIds: ["canola"],
    surplusConsumptionPhase: "before-fallback",
    surplusConsumptionPriority: 100,
  },
  "FoodMill:WheatMilling": {
    balanceBy: "output",
    balanceOutputIds: ["flour"],
  },
  "FoodProcessor:MeatProcessing": {
    balanceBy: "output",
    balanceOutputIds: ["meat"],
  },
  "FoodProcessor:MeatProcessingTrimmings": {
    allocation: "fallback",
    allocationPriority: 10,
    balanceBy: "input",
    balanceInputIds: ["chickenCarcass"],
  },
  "FoodProcessor:SnackProductionCorn": {
    balanceBy: "output",
    balanceOutputIds: ["snack"],
  },
  "FoodProcessor:SnackProductionPotato": {
    balanceBy: "output",
    balanceOutputIds: ["snack"],
  },
  "FoodProcessor:SugarRefiningCane": {
    balanceBy: "output",
    balanceOutputIds: ["sugar"],
  },
  "FoodProcessor:TofuProduction": {
    balanceBy: "output",
    balanceOutputIds: ["tofu"],
  },
  "GoldFurnace:GoldSmelting": {
    balanceBy: "output",
    balanceOutputIds: ["gold"],
  },
  "GoldFurnace:GoldScrapSmelting": {
    balanceBy: "input",
    balanceInputIds: ["goldScrap"],
    electricityMultiplier: 0.6,
  },
  "HydrogenReformer:HydrogenProductionFromSteamSp": {
    balanceBy: "output",
    balanceOutputIds: ["hydrogen", "oxygen"],
  },
  "HydroCrackerT1:FuelGasReforming": {
    allocation: "surplus",
    allocationPriority: 100,
    balanceBy: "input",
    balanceInputIds: ["fuelGas"],
    balanceOutputIds: ["diesel"],
  },
  "IndustrialMixerT2:BiomassCompost": {
    allocation: "surplus",
    allocationPriority: 10,
    balanceBy: "input",
    balanceInputIds: ["biomass"],
    balanceInputScope: "module",
  },
  "IndustrialMixerT2:AnimalFeedCompost": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["animalFeed"],
  },
  "IndustrialMixerT2:DirtMixing": {
    allocation: "surplus",
    allocationPriority: 20,
    balanceBy: "input",
    balanceInputIds: ["compost"],
  },
  "IndustrialMixerT2:MeatTrimmingsCompost": {
    allocation: "surplus",
    allocationPriority: 15,
    balanceBy: "input",
    balanceInputIds: ["meatTrimmings"],
  },
  "IncinerationPlant:IncinerationOfWaste": {
    balanceBy: "output",
    balanceInputIds: ["waste"],
    balanceOutputIds: ["steamHigh"],
    balanceOutputScope: "module",
    group: "waste",
  },
  "OxygenFurnace:SteelSmelting": {
    allocation: "fallback",
    allocationPriority: 10,
    balanceBy: "output",
    balanceOutputIds: ["moltenSteel"],
  },
  "OxygenFurnaceT2:SteelSmeltingT2": {
    allocation: "fallback",
    allocationPriority: 40,
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["moltenSteel"],
    consumeSurplusInputIds: [],
  },
  "PolymerizationPlant:PlasticMakingEthanol": {
    balanceBy: "output",
    balanceOutputIds: ["plastic"],
  },
  "RotaryKilnGas:AluminaCalcificationGas": {
    balanceBy: "output",
    balanceOutputIds: ["alumina"],
  },
  "RotaryKilnGas:CementProductionGas": {
    balanceBy: "output",
    balanceOutputIds: ["cement"],
  },
  "SettlingTank:FluorideLeaching": {
    balanceBy: "output",
    balanceOutputIds: ["hydrogenFluoride"],
  },
  "SettlingTank:GoldSettling": {
    balanceBy: "output",
    balanceOutputIds: ["goldOreConcentrate"],
  },
  "SettlingTank:RedMudSettlingAcid": {
    allocation: "fallback",
    allocationPriority: 10,
    balanceBy: "input",
    balanceInputIds: ["redMud"],
  },
  "SettlingTank:UraniumLeaching": {
    balanceBy: "output",
    balanceOutputIds: ["yellowcake"],
  },
  "Shredder:ShreddingRetiredWaste": { appliesRecyclingEfficiency: false },
  "Shredder:ShreddingSaplings": {
    allocation: "surplus",
    allocationPriority: 5,
    balanceBy: "input",
    balanceInputIds: ["treeSapling"],
  },
  "SourWaterStripper:SourWaterStripping": {
    allocation: "fallback",
    allocationPriority: 40,
    balanceBy: "input",
    balanceInputIds: ["sourWater"],
    group: "waste",
  },
  "ThermalDesalinator:DesalinationFromLP": {
    balanceBy: "output",
    balanceOutputIds: ["water"],
  },
  "SmokeStack:SmokeStackCarbonDioxide": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackDepletedSteam": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackExhaust": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackHpSteam": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackLpSteam": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackNitrogen": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackOxygen": { group: "sink", sinkScope: "module" },
  "SmokeStack:SmokeStackSpSteam": { group: "sink", sinkScope: "module" },
  "SmokeStackLarge:SmokeStackCarbonDioxide": { group: "sink" },
  "SmokeStackLarge:SmokeStackDepletedSteam": { group: "sink" },
  "SmokeStackLarge:SmokeStackExhaust": { group: "sink" },
  "SmokeStackLarge:SmokeStackHpSteam": { group: "sink" },
  "SmokeStackLarge:SmokeStackLpSteam": { group: "sink" },
  "SmokeStackLarge:SmokeStackNitrogen": { group: "sink" },
  "SmokeStackLarge:SmokeStackOxygen": { group: "sink" },
  "SmokeStackLarge:SmokeStackSpSteam": { group: "sink" },
  "WasteDump:BrineDumping": { group: "sink", sinkScope: "module" },
  "WasteDump:OceanWaterDumping": { group: "sink" },
  "WaterTreatmentPlant:WaterTreatmentT2": {
    balanceBy: "input",
    balanceInputIds: ["wasteWater"],
  },
  "WaterTreatmentPlant:ToxicSlurryTreatment": {
    allocation: "surplus",
    balanceBy: "input",
    balanceInputIds: ["toxicSlurry"],
  },
};

/** Exact game UI order where an exported prototype's recipe list is not display-ordered. */
export const runtimeRecipePriorities: Readonly<Record<string, number>> = {
  "AnaerobicDigester:MeatTrimmingsDigestion": 0,
  "AnaerobicDigester:SugarCaneDigestion": 1,
  "AnaerobicDigester:PotatoDigestion": 2,
  "AnaerobicDigester:WheatDigestion": 3,
  "AnaerobicDigester:CornDigestion": 4,
  "AnaerobicDigester:FruitDigestion": 5,
  "AnaerobicDigester:SoybeanDigestion": 6,
  "AnaerobicDigester:VegetablesDigestion": 7,
  "AnaerobicDigester:PoppyDigestion": 8,
  "ArcFurnace2:CopperSmeltingArcScrap": 0,
  "ArcFurnace2:CopperSmeltingArc": 1,
  "ArcFurnace2:IronSmeltingArcScrap": 0,
  "ArcFurnace2:IronSmeltingArc": 1,
  "ArcFurnace2:GlassSmeltingArcWithBroken": 0,
  "ArcFurnace2:GlassSmeltingArc": 1,
  "CoolingTowerT2:SteamDepletedCondensationT2": 0,
  "CoolingTowerT2:SteamHpCondensationT2": 1,
  "CoolingTowerT2:SteamLpCondensationT2": 2,
  "CoolingTowerT2:SteamSpCondensationT2": 3,
  "GoldFurnace:GoldScrapSmelting": 0,
  "GoldFurnace:GoldSmelting": 1,
  "ChemicalPlant2:FertilizerProductionFromOrganic": 0,
  "ChemicalPlant2:FertilizerProduction": 1,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage1A": 0,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage2A": 0,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage3A": 0,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage1B": 1,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage2B": 1,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage3B": 1,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage1C": 2,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage2C": 2,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage3C": 2,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage1D": 3,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdStage2D": 3,
  "MicrochipMachineT2:MicrochipMachineT2_MicrochipProdFinalStage": 3,
};
