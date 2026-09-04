using System;
using System.Collections.Generic;

internal static class SnapshotTracking
{
    internal const int HistoryWindowMonths = 120;
    internal const string HydrogenProductId = "Product_Hydrogen";
    internal const string MaintenanceT1ProductId = "Product_Virtual_MaintenanceT1";
    internal const string MaintenanceT2ProductId = "Product_Virtual_MaintenanceT2";
    internal const string MaintenanceT3ProductId = "Product_Virtual_MaintenanceT3";
    internal const string ChickenFarmPrototypeId = "ChickenFarm";
    internal const string GreenhousePrototypeId = "FarmT3";
    internal const string GreenhouseIiPrototypeId = "FarmT4";
    internal const string OrganicFertilizerProductId = "Product_FertilizerOrganic";
    internal const string FertilizerIProductId = "Product_Fertilizer";
    internal const string FertilizerIiProductId = "Product_Fertilizer2";
    internal const string OceanWaterPumpRuntimeTypeName =
        "Mafi.Base.Prototypes.Machines.OceanWaterPump";
    internal static readonly HashSet<string> TrackedProductionPrototypeIds =
        new HashSet<string>(new[]
        {
            "DataCenter",
            "WaterChiller",
            "FastBreederReactor",
            "OceanWaterPumpLarge",
            "NuclearReprocessingPlant",
            "UraniumEnrichmentPlant",
            "ChemicalPlant2",
            "TurbineSuperPress",
            "TurbineHighPressT2",
            "TurbineLowPressT2",
            "PowerGeneratorT2",
            "HydrogenReformer",
            "ThermalDesalinator",
            "ElectrolyzerT2",
            "EvaporationPondHeated",
            "CoolingTowerT2",
            "WasteDump",
            "SmokeStackLarge",
            "NuclearWasteStorage",
            "Shredder",
            "MaintenanceDepotT0",
            "MaintenanceDepotT1",
            "MaintenanceDepotT2",
            "MaintenanceDepotT3",
            "RocketAssemblyDepot",
            "RocketLaunchPad",
            "LocomotiveT2Electric",
            "TrainStationLoose_ELEC",
            "TrainStationFluid_ELEC",
            "TrainStationUnit_ELEC",
            "TrainStationMolten_ELEC",
            "OreSortingPlantT1",
            "OreSortingPlantT2",
            "StackerTower",
            "TrainDepot",
            "VehiclesDepot",
            "VehiclesDepotT2",
            "VehiclesDepotT3",
            "CaptainOfficeT1",
            "CaptainOfficeT2",
            "SolarPanel",
            "SolarPanelMono",
            "StatueOfMaintenanceGolden",
        }, StringComparer.Ordinal);
    internal static readonly TrackedReserveDefinition[] TrackedReserves = new[]
    {
        new TrackedReserveDefinition("gold", "Product_Gold"),
        new TrackedReserveDefinition("fuelGas", "Product_FuelGas"),
    };
    internal static readonly Dictionary<string, int> TrackedReserveProductIndices =
        createTrackedReserveProductIndices();
    internal static readonly TrackedResearchDefinition[] TrackedResearch = new[]
    {
        new TrackedResearchDefinition("vehiclesPollution", "ResearchVehiclesPollutionDec"),
        new TrackedResearchDefinition("shipsPollution", "ResearchShipsPollutionDec"),
        new TrackedResearchDefinition("trainsPollution", "ResearchTrainsPollutionDec"),
        new TrackedResearchDefinition("cropYield", "ResearchCropYieldInc"),
        new TrackedResearchDefinition("treeGrowthSpeed", "ResearchTreesGrowthSpeedInc"),
        new TrackedResearchDefinition("rainwaterYield", "ResearchRainwaterYieldInc"),
        new TrackedResearchDefinition("settlementWaterUse", "ResearchSettlementWaterDec"),
        new TrackedResearchDefinition("unityCapacity", "ResearchUnityCapInc"),
        new TrackedResearchDefinition("housingCapacity", "ResearchHousingCapInc"),
        new TrackedResearchDefinition("focusPoints", "ResearchFocusIncreaseInc"),
        new TrackedResearchDefinition("vehicleLimit", "ResearchVehicleLimitsInc"),
        new TrackedResearchDefinition("vehiclesFuelUse", "ResearchVehiclesFuelDec"),
        new TrackedResearchDefinition("shipsFuelUse", "ResearchShipsFuelDec"),
        new TrackedResearchDefinition("trainsFuelUse", "ResearchTrainsFuelDec"),
        new TrackedResearchDefinition("rocketsCapacity", "ResearchRocketsCapacityInc"),
        new TrackedResearchDefinition("maintenanceOutput", "ResearchMaintenanceProductionInc"),
        new TrackedResearchDefinition("worldMineOutput", "ResearchWorldMinesEfficiencyInc"),
        new TrackedResearchDefinition("solarPower", "ResearchSolarPowerInc"),
    };
    internal static readonly TrackedEdictDefinition[] TrackedEdicts = new[]
    {
        new TrackedEdictDefinition("growthPause", "Edict_GrowthPause"),
        new TrackedEdictDefinition("growthBoost", "Edict_PopsBoostT1", "Edict_PopsBoostT2", "Edict_PopsBoostT3"),
        new TrackedEdictDefinition("eviction", "Edict_PopsEviction"),
        new TrackedEdictDefinition("quarantine", "Edict_PopsQuarantine"),
        new TrackedEdictDefinition("foodSaver", "Edict_FoodConsumptionReduction", "Edict_FoodConsumptionReductionT2"),
        new TrackedEdictDefinition("healthBoost", "Edict_HealthBonus", "Edict_HealthBonusT2"),
        new TrackedEdictDefinition("plentyOfFood", "Edict_FoodConsumptionIncrease", "Edict_FoodConsumptionIncreaseT2"),
        new TrackedEdictDefinition("moreHouseholdGoods", "Edict_HouseholdGoodsConsumptionIncrease", "Edict_HouseholdGoodsConsumptionIncreaseT2", "Edict_HouseholdGoodsConsumptionIncreaseT3"),
        new TrackedEdictDefinition("moreAirConditioners", "Edict_HouseholdAppliancesConsumptionIncrease", "Edict_HouseholdAppliancesConsumptionIncreaseT2", "Edict_HouseholdAppliancesConsumptionIncreaseT3"),
        new TrackedEdictDefinition("moreConsumerElectronics", "Edict_ConsumerElectronicsConsumptionIncrease", "Edict_ConsumerElectronicsConsumptionIncreaseT2", "Edict_ConsumerElectronicsConsumptionIncreaseT3"),
        new TrackedEdictDefinition("vehiclesFuelSaver", "Edict_FuelReduction", "Edict_FuelReductionT2"),
        new TrackedEdictDefinition("shipsFuelSaver", "Edict_ShipFuelReduction"),
        new TrackedEdictDefinition("overloadedTrucks", "Edict_TruckCapacityIncrease", "Edict_TruckCapacityIncreaseT2"),
        new TrackedEdictDefinition("maintenanceReducer", "Edict_MaintenanceReduction", "Edict_MaintenanceReductionT2", "Edict_MaintenanceReductionT3"),
        new TrackedEdictDefinition("recyclingIncrease", "Edict_RecyclingIncrease", "Edict_RecyclingIncreaseT2", "Edict_RecyclingIncreaseT3", "Edict_RecyclingIncreaseT4", "Edict_RecyclingIncreaseT5"),
        new TrackedEdictDefinition("farmingBoost", "Edict_FarmYieldIncrease", "Edict_FarmYieldIncreaseT2", "Edict_FarmYieldIncreaseT3"),
        new TrackedEdictDefinition("waterSaver", "Edict_WaterConsumptionReduction", "Edict_WaterConsumptionReductionT2", "Edict_WaterConsumptionReductionT3"),
        new TrackedEdictDefinition("cleanPanels", "Edict_SolarPowerIncrease", "Edict_SolarPowerIncreaseT2", "Edict_SolarPowerIncreaseT3"),
        new TrackedEdictDefinition("researchEfficiency", "Edict_ResearchEfficiencyInc", "Edict_ResearchEfficiencyIncT2", "Edict_ResearchEfficiencyIncT3", "Edict_ResearchEfficiencyIncT4", "Edict_ResearchEfficiencyIncT5"),
    };
    internal static readonly Dictionary<string, int> TrackedResearchIndices =
        createTrackedResearchIndices();
    internal static readonly Dictionary<string, TrackedEdictTier> TrackedEdictTiers =
        createTrackedEdictTiers();

    private static Dictionary<string, int> createTrackedResearchIndices()
    {
        Dictionary<string, int> result = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < TrackedResearch.Length; i++)
        {
            result.Add(TrackedResearch[i].PrototypeId, i);
        }

        return result;
    }

    private static Dictionary<string, int> createTrackedReserveProductIndices()
    {
        Dictionary<string, int> result = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < TrackedReserves.Length; i++)
        {
            result.Add(TrackedReserves[i].ProductId, i);
        }

        return result;
    }

    private static Dictionary<string, TrackedEdictTier> createTrackedEdictTiers()
    {
        Dictionary<string, TrackedEdictTier> result =
            new Dictionary<string, TrackedEdictTier>(StringComparer.Ordinal);

        for (int edictIndex = 0; edictIndex < TrackedEdicts.Length; edictIndex++)
        {
            string[] prototypeIds = TrackedEdicts[edictIndex].TierPrototypeIds;
            for (int tierIndex = 0; tierIndex < prototypeIds.Length; tierIndex++)
            {
                result.Add(
                    prototypeIds[tierIndex],
                    new TrackedEdictTier(edictIndex, tierIndex + 1));
            }
        }

        return result;
    }
}
