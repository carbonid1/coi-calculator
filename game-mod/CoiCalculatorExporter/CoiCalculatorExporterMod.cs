using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Buildings.Cargo;
using Mafi.Core.Buildings.Cargo.Modules;
using Mafi.Core.Buildings.Cargo.Ships;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Buildings.Forestry;
using Mafi.Core.Buildings.Mine;
using Mafi.Core.Buildings.Offices;
using Mafi.Core.Buildings.OreSorting;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Factory;
using Mafi.Core.Factory.Datacenters;
using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.NuclearReactors;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Maintenance;
using Mafi.Core.Map;
using Mafi.Core.Mods;
using Mafi.Core.Population;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Ports.Io;
using Mafi.Core.Prototypes;
using Mafi.Core.PropertiesDb;
using Mafi.Core.Products;
using Mafi.Core.Research;
using Mafi.Core.Simulation;
using Mafi.Core.SpaceProgram;
using Mafi.Core.Stats;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Designation;
using Mafi.Core.Terrain.Generation;
using Mafi.Core.Terrain.Trees;
using Mafi.Core.Trains;
using Mafi.Core.Vehicles;
using Mafi.Core.World.Contracts;

public sealed class CoiCalculatorExporterMod : IMod, IDisposable
{
    private static readonly TimeSpan ExportInterval = TimeSpan.FromSeconds(5);
    private const int HistoryWindowMonths = 120;
    private const string HydrogenProductId = "Product_Hydrogen";
    private const string MaintenanceT1ProductId = "Product_Virtual_MaintenanceT1";
    private const string MaintenanceT2ProductId = "Product_Virtual_MaintenanceT2";
    private const string MaintenanceT3ProductId = "Product_Virtual_MaintenanceT3";
    private const string DataCenterPrototypeId = "DataCenter";
    private const string WaterChillerPrototypeId = "WaterChiller";
    private const string ChickenFarmPrototypeId = "ChickenFarm";
    private const string GreenhousePrototypeId = "FarmT3";
    private const string GreenhouseIiPrototypeId = "FarmT4";
    private const string OrganicFertilizerProductId = "Product_FertilizerOrganic";
    private const string FertilizerIProductId = "Product_Fertilizer";
    private const string FertilizerIiProductId = "Product_Fertilizer2";
    private const string OceanWaterPumpRuntimeTypeName =
        "Mafi.Base.Prototypes.Machines.OceanWaterPump";
    private static readonly HashSet<string> TrackedProductionPrototypeIds =
        new HashSet<string>(new[]
        {
            DataCenterPrototypeId,
            WaterChillerPrototypeId,
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
        }, StringComparer.Ordinal);
    private static readonly string[] TrackedBuildingKeys = new[]
    {
        "rocketAssemblyDepot",
        "rocketLaunchPad",
        "electricLocomotiveII",
        "looseStationModuleElectrified",
        "fluidStationModuleElectrified",
        "unitStationModuleElectrified",
        "moltenStationModuleElectrified",
        "oreSortingPlant",
        "oreSortingPlantLarge",
        "stackerTower",
        "trainDepot",
        "vehiclesDepot",
        "vehiclesDepotII",
        "vehiclesDepotIII",
        "captainOfficeI",
        "captainOfficeII",
        "solarPanel",
        "solarPanelMono",
        "maintenanceStatue",
    };
    private static readonly string[] TrackedPrototypeIds = new[]
    {
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
    };
    private static readonly Dictionary<string, int> TrackedPrototypeIndices =
        createTrackedPrototypeIndices();
    private static readonly TrackedReserveDefinition[] TrackedReserves = new[]
    {
        new TrackedReserveDefinition("gold", "Product_Gold"),
        new TrackedReserveDefinition("fuelGas", "Product_FuelGas"),
    };
    private static readonly Dictionary<string, int> TrackedReserveProductIndices =
        createTrackedReserveProductIndices();
    private static readonly TrackedResearchDefinition[] TrackedResearch = new[]
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
    private static readonly TrackedEdictDefinition[] TrackedEdicts = new[]
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
    private static readonly Dictionary<string, int> TrackedResearchIndices =
        createTrackedResearchIndices();
    private static readonly Dictionary<string, TrackedEdictTier> TrackedEdictTiers =
        createTrackedEdictTiers();

    private IVehiclesManager m_vehiclesManager;
    private ILogisticsZonesManager m_logisticsZonesManager;
    private GameNameConfig m_gameNameConfig;
    private IEntitiesManager m_entitiesManager;
    private IConstructionManager m_constructionManager;
    private IProductsManager m_productsManager;
    private IPropertiesDb m_propertiesDb;
    private IVirtualResourceManager m_virtualResourceManager;
    private ITreesManager m_treesManager;
    private ElectricityManager m_electricityManager;
    private FuelStatsCollector m_fuelStatsCollector;
    private MaintenanceManager m_maintenanceManager;
    private ResearchManager m_researchManager;
    private EdictsManager m_edictsManager;
    private OrbitManager m_orbitManager;
    private ContractsManager m_contractsManager;
    private ICalendar m_calendar;
    private ISimLoopEvents m_simLoopEvents;
    private readonly int[] m_builtBuildings = new int[TrackedBuildingKeys.Length];
    private readonly int[] m_runningBuildings = new int[TrackedBuildingKeys.Length];
    private readonly Dictionary<EntityId, TrackedEntityState> m_trackedEntities =
        new Dictionary<EntityId, TrackedEntityState>();
    private readonly object m_snapshotWriteLock = new object();
    private string m_pendingSnapshotJson;
    private bool m_snapshotWriterRunning;
    private bool m_acceptSnapshotWrites = true;
    private HistoryAverage m_maintenanceI = HistoryAverage.Empty;
    private HistoryAverage m_maintenanceII = HistoryAverage.Empty;
    private HistoryAverage m_maintenanceIII = HistoryAverage.Empty;
    private FuelHistory m_hydrogenFuel = FuelHistory.Empty;
    private List<GenerationHistory> m_generationByType = new List<GenerationHistory>();
    private DateTime m_nextExportUtc = DateTime.MinValue;
    private readonly string m_snapshotPath;

    public string Name { get { return "CoI Calculator Exporter"; } }
    public int Version { get { return 27; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public CoiCalculatorExporterMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
        m_snapshotPath = Path.Combine(manifest.RootDirectoryPath, "coi-calculator-state.json");
    }

    public void RegisterPrototypes(ProtoRegistrator registrator)
    {
    }

    public void RegisterDependencies(
        DependencyResolverBuilder dependencyResolverBuilder,
        ProtosDb protosDb,
        bool gameWasLoaded)
    {
    }

    public void EarlyInit(DependencyResolver resolver)
    {
    }

    public void Initialize(DependencyResolver resolver, bool gameWasLoaded)
    {
        m_vehiclesManager = resolver.Resolve<IVehiclesManager>();
        m_logisticsZonesManager = resolver.Resolve<ILogisticsZonesManager>();
        m_gameNameConfig = resolver.Resolve<GameNameConfig>();
        m_entitiesManager = resolver.Resolve<IEntitiesManager>();
        m_constructionManager = resolver.Resolve<IConstructionManager>();
        m_productsManager = resolver.Resolve<IProductsManager>();
        m_propertiesDb = resolver.Resolve<IPropertiesDb>();
        m_virtualResourceManager = resolver.Resolve<IVirtualResourceManager>();
        m_treesManager = resolver.Resolve<ITreesManager>();
        m_electricityManager = resolver.Resolve<ElectricityManager>();
        m_fuelStatsCollector = resolver.Resolve<FuelStatsCollector>();
        m_maintenanceManager = resolver.Resolve<MaintenanceManager>();
        m_researchManager = resolver.Resolve<ResearchManager>();
        m_edictsManager = resolver.Resolve<EdictsManager>();
        m_orbitManager = resolver.Resolve<OrbitManager>();
        m_contractsManager = resolver.Resolve<ContractsManager>();
        m_calendar = resolver.Resolve<ICalendar>();
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        initializeTrackedBuildingCounts();
        refreshHistorySnapshots();
        m_entitiesManager.EntityAdded.AddNonSaveable(this, onEntityAdded);
        m_entitiesManager.EntityRemoved.AddNonSaveable(this, onEntityRemoved);
        m_entitiesManager.EntityPauseStateChanged.AddNonSaveable(
            this,
            onEntityPauseStateChanged);
        m_entitiesManager.OnUpgradeJustPerformed.AddNonSaveable(this, onEntityUpgraded);
        m_constructionManager.EntityConstructionStateChanged.AddNonSaveable(
            this,
            onEntityConstructionStateChanged);
        m_calendar.NewMonthEnd.AddNonSaveable(this, onNewMonthEnd);
        m_simLoopEvents.Update.AddNonSaveable(this, onSimUpdate);
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);

        writeSnapshot();
        Log.Info("CoI Calculator Exporter: game snapshot enabled at " + m_snapshotPath);
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
        if (m_entitiesManager != null)
        {
            try
            {
                m_entitiesManager.EntityAdded.RemoveNonSaveable(this, onEntityAdded);
                m_entitiesManager.EntityRemoved.RemoveNonSaveable(this, onEntityRemoved);
                m_entitiesManager.EntityPauseStateChanged.RemoveNonSaveable(
                    this,
                    onEntityPauseStateChanged);
                m_entitiesManager.OnUpgradeJustPerformed.RemoveNonSaveable(
                    this,
                    onEntityUpgraded);
            }
            catch
            {
            }
        }

        if (m_constructionManager != null)
        {
            try
            {
                m_constructionManager.EntityConstructionStateChanged.RemoveNonSaveable(
                    this,
                    onEntityConstructionStateChanged);
            }
            catch
            {
            }
        }

        if (m_calendar != null)
        {
            try
            {
                m_calendar.NewMonthEnd.RemoveNonSaveable(this, onNewMonthEnd);
            }
            catch
            {
            }
        }

        if (m_simLoopEvents != null)
        {
            try
            {
                m_simLoopEvents.Update.RemoveNonSaveable(this, onSimUpdate);
                m_simLoopEvents.UpdateAfterCmdProc.RemoveNonSaveable(this, onSimUpdate);
            }
            catch
            {
            }

            m_simLoopEvents = null;
        }

        lock (m_snapshotWriteLock)
        {
            m_acceptSnapshotWrites = false;
            m_pendingSnapshotJson = null;
        }

        m_vehiclesManager = null;
        m_entitiesManager = null;
        m_constructionManager = null;
        m_propertiesDb = null;
        m_virtualResourceManager = null;
        m_treesManager = null;
        m_electricityManager = null;
        m_fuelStatsCollector = null;
        m_maintenanceManager = null;
        m_researchManager = null;
        m_edictsManager = null;
        m_contractsManager = null;
        m_calendar = null;
    }

    private void onSimUpdate()
    {
        DateTime now = DateTime.UtcNow;
        if (now < m_nextExportUtc)
        {
            return;
        }

        m_nextExportUtc = now.Add(ExportInterval);
        writeSnapshot();
    }

    private void writeSnapshot()
    {
        if (m_vehiclesManager == null
            || m_logisticsZonesManager == null
            || m_gameNameConfig == null
            || m_entitiesManager == null
            || m_propertiesDb == null
            || m_virtualResourceManager == null
            || m_electricityManager == null
            || m_fuelStatsCollector == null
            || m_maintenanceManager == null
            || m_researchManager == null
            || m_edictsManager == null
            || m_contractsManager == null)
        {
            return;
        }

        try
        {
            int workersAssigned = 0;
            int[] researchLevels = getResearchLevels();
            EdictState[] edictStates = getEdictStates();
            int[] reserves = getReserveQuantities();
            ProductionSnapshot production = getProductionSnapshot();
            ContractStateSnapshot contracts = getContractStateSnapshot();

            foreach (var vehicle in m_vehiclesManager.AllVehicles)
            {
                workersAssigned += EntityWithWorkersExtensions.WorkersAssigned(vehicle);
            }

            StringBuilder json = new StringBuilder(3600);
            json.Append('{');
            json.Append("\"schemaVersion\":38,");
            appendString(json, "saveId", m_gameNameConfig.GameName, true);
            json.Append("\"exportedAtUtc\":\"");
            json.Append(DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture));
            json.Append("\",");
            json.Append("\"buildings\":{");
            for (int i = 0; i < TrackedBuildingKeys.Length; i++)
            {
                json.Append('\"');
                json.Append(TrackedBuildingKeys[i]);
                json.Append("\":{");
                appendNumber(json, "built", m_builtBuildings[i], true);
                appendNumber(json, "running", m_runningBuildings[i], false);
                json.Append('}');
                if (i < TrackedBuildingKeys.Length - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("},");
            SpaceStation spaceStation = m_orbitManager.SpaceStation.ValueOrNull;
            json.Append("\"spaceStation\":{");
            appendNumber(json, "currentLevel", spaceStation == null ? 0 : spaceStation.CurrentTier, true);
            appendNumber(json, "highestLevelAchieved", m_orbitManager.HighestStationTierAchieved, false);
            json.Append("},");
            json.Append("\"computing\":{");
            appendBuildingCount(json, "dataCenters", production.DataCenters, true);
            appendBuildingCount(json, "racks", production.Racks, true);
            appendBuildingCount(json, "waterChillers", production.WaterChillers, false);
            json.Append("},");
            json.Append("\"logisticsZones\":[");
            for (int i = 0; i < production.LogisticsZones.Count; i++)
            {
                LogisticsZoneSnapshot zone = production.LogisticsZones[i];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (i < production.LogisticsZones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            json.Append("\"chickenFarms\":{");
            json.Append("\"configurations\":[");
            for (int i = 0; i < production.ChickenFarms.Count; i++)
            {
                ChickenFarmSnapshot farm = production.ChickenFarms[i];
                json.Append('{');
                json.Append("\"slaughtering\":");
                json.Append(farm.Slaughtering ? "true" : "false");
                json.Append(',');
                appendNumber(json, "built", farm.Built, true);
                appendNumber(json, "running", farm.Running, true);
                appendNumber(json, "chickens", farm.Chickens, true);
                appendNumber(json, "runningChickens", farm.RunningChickens, false);
                json.Append('}');
                if (i < production.ChickenFarms.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"entities\":[");
            for (int i = 0; i < production.ChickenFarmEntities.Count; i++)
            {
                ChickenFarmEntitySnapshot farm = production.ChickenFarmEntities[i];
                json.Append('{');
                appendNumber(json, "entityId", farm.EntityId, true);
                appendString(json, "prototypeId", ChickenFarmPrototypeId, true);
                json.Append("\"running\":");
                json.Append(farm.Running ? "true" : "false");
                json.Append(',');
                json.Append("\"slaughtering\":");
                json.Append(farm.Slaughtering ? "true" : "false");
                json.Append(',');
                appendNumber(json, "chickens", farm.Chickens, true);
                json.Append("\"zones\":[");
                for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
                {
                    LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                    json.Append('{');
                    appendNumber(json, "id", zone.Id, true);
                    appendNullableString(json, "name", zone.Name, false);
                    json.Append('}');
                    if (zoneIndex < farm.Zones.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("]}");
                if (i < production.ChickenFarmEntities.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]},");
            json.Append("\"cropFarms\":{");
            json.Append("\"configurations\":[");
            for (int i = 0; i < production.CropFarms.Count; i++)
            {
                CropFarmSnapshot farm = production.CropFarms[i];
                json.Append('{');
                appendString(json, "prototypeId", farm.PrototypeId, true);
                appendNumber(json, "built", farm.Built, true);
                appendNumber(json, "running", farm.Running, true);
                appendNumber(json, "fertilityTargetPercent", farm.FertilityTargetPercent, true);
                appendNullableString(json, "fertilizerProductId", farm.FertilizerProductId, true);
                json.Append("\"schedule\":[");
                for (int scheduleIndex = 0; scheduleIndex < farm.Schedule.Length; scheduleIndex++)
                {
                    string cropId = farm.Schedule[scheduleIndex];
                    if (cropId == null)
                    {
                        json.Append("null");
                    }
                    else
                    {
                        json.Append('"');
                        appendEscapedString(json, cropId);
                        json.Append('"');
                    }

                    if (scheduleIndex < farm.Schedule.Length - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("]}");
                if (i < production.CropFarms.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"entities\":[");
            for (int i = 0; i < production.CropFarmEntities.Count; i++)
            {
                CropFarmEntitySnapshot farm = production.CropFarmEntities[i];
                json.Append('{');
                appendNumber(json, "entityId", farm.EntityId, true);
                appendString(json, "prototypeId", farm.PrototypeId, true);
                json.Append("\"running\":");
                json.Append(farm.Running ? "true" : "false");
                json.Append(',');
                appendNumber(json, "fertilityTargetPercent", farm.FertilityTargetPercent, true);
                appendNullableString(json, "fertilizerProductId", farm.FertilizerProductId, true);
                json.Append("\"schedule\":[");
                for (int scheduleIndex = 0; scheduleIndex < farm.Schedule.Length; scheduleIndex++)
                {
                    string cropId = farm.Schedule[scheduleIndex];
                    if (cropId == null)
                    {
                        json.Append("null");
                    }
                    else
                    {
                        json.Append('"');
                        appendEscapedString(json, cropId);
                        json.Append('"');
                    }

                    if (scheduleIndex < farm.Schedule.Length - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],\"zones\":[");
                for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
                {
                    LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                    json.Append('{');
                    appendNumber(json, "id", zone.Id, true);
                    appendNullableString(json, "name", zone.Name, false);
                    json.Append('}');
                    if (zoneIndex < farm.Zones.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("]}");
                if (i < production.CropFarmEntities.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]},");
            json.Append("\"machines\":[");
            for (int i = 0; i < production.Machines.Count; i++)
            {
                MachineInventorySnapshot machine = production.Machines[i];
                json.Append('{');
                appendNumber(json, "entityId", machine.EntityId, true);
                appendString(json, "kind", "groundwater-pump", true);
                appendString(json, "prototypeId", machine.PrototypeId, true);
                json.Append("\"running\":");
                json.Append(machine.Running ? "true" : "false");
                json.Append(',');
                appendNullableString(json, "customTitle", machine.CustomTitle, true);
                json.Append("\"tile\":{");
                appendNumber(json, "x", machine.TileX, true);
                appendNumber(json, "y", machine.TileY, false);
                json.Append("},\"zones\":[");
                for (int zoneIndex = 0; zoneIndex < machine.Zones.Count; zoneIndex++)
                {
                    LogisticsZoneSnapshot zone = machine.Zones[zoneIndex];
                    json.Append('{');
                    appendNumber(json, "id", zone.Id, true);
                    appendNullableString(json, "name", zone.Name, false);
                    json.Append('}');
                    if (zoneIndex < machine.Zones.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],\"aquifer\":");
                if (machine.Aquifer == null)
                {
                    json.Append("null");
                }
                else
                {
                    json.Append('{');
                    appendString(json, "id", machine.Aquifer.Id, true);
                    json.Append("\"position\":{");
                    appendNumber(json, "x", machine.Aquifer.PositionX, true);
                    appendNumber(json, "y", machine.Aquifer.PositionY, false);
                    json.Append("},");
                    appendNumber(json, "quantity", machine.Aquifer.Quantity, true);
                    appendNumber(json, "capacity", machine.Aquifer.Capacity, true);
                    appendNumber(
                        json,
                        "configuredCapacity",
                        machine.Aquifer.ConfiguredCapacity,
                        false);
                    json.Append('}');
                }
                json.Append('}');
                if (i < production.Machines.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            json.Append("\"groundwater\":{");
            appendNumber(
                json,
                "depletedPumpSpeedPercent",
                m_propertiesDb.GetProperty(
                    IdsCore.PropertyIds.GroundWaterPumpSpeedWhenDepleted)
                    .Value
                    .ToIntPercentRounded(),
                true);
            appendNumber(
                json,
                "replenishWhenLowPercent",
                m_propertiesDb.GetProperty(
                    IdsCore.PropertyIds.GroundWaterReplenishWhenLow)
                    .Value
                    .ToIntPercentRounded(),
                false);
            json.Append("},");
            appendContractState(json, contracts);
            json.Append(',');
            json.Append("\"productionEntities\":[");
            for (int i = 0; i < production.ProductionEntities.Count; i++)
            {
                ProductionEntitySnapshot entity = production.ProductionEntities[i];
                json.Append('{');
                appendNumber(json, "entityId", entity.EntityId, true);
                appendString(json, "prototypeId", entity.PrototypeId, true);
                json.Append("\"running\":");
                json.Append(entity.Running ? "true" : "false");
                json.Append(',');
                json.Append("\"recipeIds\":[");
                for (int recipeIndex = 0; recipeIndex < entity.RecipeIds.Count; recipeIndex++)
                {
                    json.Append('"');
                    appendEscapedString(json, entity.RecipeIds[recipeIndex]);
                    json.Append('"');
                    if (recipeIndex < entity.RecipeIds.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],\"zones\":[");
                for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
                {
                    LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                    json.Append('{');
                    appendNumber(json, "id", zone.Id, true);
                    appendNullableString(json, "name", zone.Name, false);
                    json.Append('}');
                    if (zoneIndex < entity.Zones.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],\"nuclearReactor\":");
                if (entity.NuclearReactor == null)
                {
                    json.Append("null");
                }
                else
                {
                    json.Append('{');
                    appendNumber(
                        json,
                        "enrichmentStep",
                        entity.NuclearReactor.EnrichmentStep,
                        true);
                    appendNumber(
                        json,
                        "targetPowerPercent",
                        entity.NuclearReactor.TargetPowerPercent,
                        false);
                    json.Append('}');
                }
                json.Append(",\"dataCenterRacks\":");
                if (entity.DataCenterRacks.HasValue)
                {
                    json.Append(entity.DataCenterRacks.Value.ToString(CultureInfo.InvariantCulture));
                }
                else
                {
                    json.Append("null");
                }
                json.Append(",\"trainStation\":");
                appendTrainStationConfiguration(json, entity.TrainStation);
                json.Append('}');
                if (i < production.ProductionEntities.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            json.Append("\"areaEntities\":[");
            for (int i = 0; i < production.AreaEntities.Count; i++)
            {
                AreaEntitySnapshot entity = production.AreaEntities[i];
                json.Append('{');
                appendNumber(json, "entityId", entity.EntityId, true);
                appendString(json, "prototypeId", entity.PrototypeId, true);
                appendString(json, "prototypeName", entity.PrototypeName, true);
                appendString(json, "constructionState", entity.ConstructionState, true);
                json.Append("\"constructed\":");
                json.Append(entity.Constructed ? "true" : "false");
                json.Append(',');
                json.Append("\"running\":");
                json.Append(entity.Running ? "true" : "false");
                json.Append(',');
                json.Append("\"tile\":{");
                appendNumber(json, "x", entity.TileX, true);
                appendNumber(json, "y", entity.TileY, false);
                json.Append("},\"zones\":[");
                for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
                {
                    LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                    json.Append('{');
                    appendNumber(json, "id", zone.Id, true);
                    appendNullableString(json, "name", zone.Name, false);
                    json.Append('}');
                    if (zoneIndex < entity.Zones.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],\"recipes\":[");
                for (int recipeIndex = 0; recipeIndex < entity.Recipes.Count; recipeIndex++)
                {
                    AreaRecipeSnapshot recipe = entity.Recipes[recipeIndex];
                    json.Append('{');
                    appendString(json, "id", recipe.Id, true);
                    appendString(json, "name", recipe.Name, true);
                    appendDecimal(json, "durationSeconds", recipe.DurationSeconds, true);
                    json.Append("\"assigned\":");
                    json.Append(recipe.Assigned ? "true" : "false");
                    json.Append(',');
                    appendAreaRecipeProducts(json, "inputs", recipe.Inputs, true);
                    appendAreaRecipeProducts(json, "outputs", recipe.Outputs, false);
                    json.Append('}');
                    if (recipeIndex < entity.Recipes.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("],");
                appendNumber(
                    json,
                    "availableRecipeCount",
                    entity.AvailableRecipeCount,
                    true);
                json.Append("\"oreSorter\":");
                appendOreSorterConfiguration(json, entity.OreSorter);
                json.Append(",\"trainStation\":");
                appendTrainStationConfiguration(json, entity.TrainStation);
                json.Append(",\"forestry\":");
                appendForestryConfiguration(json, entity.Forestry);
                json.Append(",\"office\":");
                appendOfficeConfiguration(json, entity.Office);
                json.Append('}');
                if (i < production.AreaEntities.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            json.Append("\"mineTowers\":[");
            for (int i = 0; i < production.MineTowers.Count; i++)
            {
                MineTowerSnapshot tower = production.MineTowers[i];
                json.Append('{');
                appendNumber(json, "entityId", tower.EntityId, true);
                json.Append("\"assignedOreSorterEntityIds\":[");
                for (int sorterIndex = 0;
                    sorterIndex < tower.AssignedOreSorterEntityIds.Count;
                    sorterIndex++)
                {
                    json.Append(tower.AssignedOreSorterEntityIds[sorterIndex]
                        .ToString(CultureInfo.InvariantCulture));
                    if (sorterIndex < tower.AssignedOreSorterEntityIds.Count - 1)
                    {
                        json.Append(',');
                    }
                }
                json.Append("]}");
                if (i < production.MineTowers.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            json.Append("\"vehicles\":{");
            appendNumber(json, "workersAssigned", workersAssigned, false);
            json.Append("},");
            json.Append("\"research\":{");
            for (int i = 0; i < TrackedResearch.Length; i++)
            {
                appendNumber(
                    json,
                    TrackedResearch[i].Key,
                    researchLevels[i],
                    i < TrackedResearch.Length - 1);
            }
            json.Append("},");
            json.Append("\"edicts\":{");
            for (int i = 0; i < TrackedEdicts.Length; i++)
            {
                EdictState state = edictStates[i];
                json.Append('\"');
                json.Append(TrackedEdicts[i].Key);
                json.Append("\":{");
                appendNumber(json, "enabledLevel", state.EnabledLevel, true);
                appendNumber(json, "activeLevel", state.ActiveLevel, true);
                appendNullableString(json, "inactiveReason", state.InactiveReason, false);
                json.Append('}');
                if (i < TrackedEdicts.Length - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("},");
            json.Append("\"reserves\":{");
            for (int i = 0; i < TrackedReserves.Length; i++)
            {
                appendNumber(
                    json,
                    TrackedReserves[i].Key,
                    reserves[i],
                    i < TrackedReserves.Length - 1);
            }
            json.Append("},");
            json.Append("\"history\":{");
            appendNumber(json, "windowMonths", HistoryWindowMonths, true);
            json.Append("\"maintenance\":{");
            appendHistoryAverage(json, "maintenanceI", m_maintenanceI, true);
            appendHistoryAverage(json, "maintenanceII", m_maintenanceII, true);
            appendHistoryAverage(json, "maintenanceIII", m_maintenanceIII, false);
            json.Append("},");
            json.Append("\"hydrogenFuel\":{");
            appendHistoryAverage(json, "total", m_hydrogenFuel.Total, true);
            json.Append("\"byUse\":{");
            appendHistoryAverage(json, "vehicles", m_hydrogenFuel.Vehicles, true);
            appendHistoryAverage(json, "cargoShips", m_hydrogenFuel.CargoShips, true);
            appendHistoryAverage(json, "battleShip", m_hydrogenFuel.BattleShip, true);
            appendHistoryAverage(json, "powerGenerators", m_hydrogenFuel.PowerGenerators, true);
            appendHistoryAverage(json, "trains", m_hydrogenFuel.Trains, false);
            json.Append("}},");
            json.Append("\"electricityGeneration\":{");
            json.Append("\"byType\":[");
            for (int i = 0; i < m_generationByType.Count; i++)
            {
                GenerationHistory generation = m_generationByType[i];
                json.Append('{');
                appendString(json, "prototypeId", generation.PrototypeId, true);
                appendString(json, "name", generation.Name, true);
                appendDecimal(json, "averageMw", generation.Average.Value, true);
                appendNumber(json, "sampleMonths", generation.Average.SampleMonths, false);
                json.Append('}');
                if (i < m_generationByType.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]}}}");

            queueSnapshotWrite(json.ToString());
        }
        catch (Exception ex)
        {
            Log.Info("CoI Calculator Exporter: unable to write game snapshot: " + ex);
        }
    }

    private static Dictionary<string, int> createTrackedPrototypeIndices()
    {
        Dictionary<string, int> result = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < TrackedPrototypeIds.Length; i++)
        {
            result.Add(TrackedPrototypeIds[i], i);
        }

        return result;
    }

    private ContractStateSnapshot getContractStateSnapshot()
    {
        Dictionary<string, EstablishedContractSnapshot> establishedById =
            new Dictionary<string, EstablishedContractSnapshot>(StringComparer.Ordinal);
        for (int i = 0; i < m_contractsManager.ActiveContracts.Count; i++)
        {
            ContractProto contract = m_contractsManager.ActiveContracts[i];
            EstablishedContractSnapshot snapshot = getEstablishedContractSnapshot(contract);
            establishedById[snapshot.GameId] = snapshot;
        }

        List<ContractRouteSnapshot> routes = new List<ContractRouteSnapshot>();
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            CargoDepot depot = entity as CargoDepot;
            if (depot == null || depot.IsDestroyed || !depot.IsConstructed)
            {
                continue;
            }

            ContractProto contract = depot.ContractAssigned.ValueOrNull;
            if (contract == null)
            {
                continue;
            }

            EstablishedContractSnapshot established;
            if (!establishedById.TryGetValue(contract.Id.ToString(), out established))
            {
                established = getEstablishedContractSnapshot(contract);
                establishedById.Add(established.GameId, established);
            }

            List<ContractModuleSnapshot> modules = new List<ContractModuleSnapshot>();
            for (int slot = 0; slot < depot.Modules.Length; slot++)
            {
                CargoDepotModule module = depot.Modules[slot].ValueOrNull;
                if (module == null || module.IsDestroyed || !module.IsConstructed)
                {
                    continue;
                }

                ProductProto product = module.StoredProduct.ValueOrNull;
                Mafi.Core.Buildings.Cargo.Ships.Modules.CargoShipModule shipModule =
                    module.GetShipModule().ValueOrNull;
                modules.Add(new ContractModuleSnapshot(
                    module.Id.Value,
                    slot,
                    module.Prototype.Id.ToString(),
                    getPrototypeName(module.Prototype.Id.ToString(), module.Prototype.Strings.Name.TranslatedString),
                    !module.IsPaused,
                    EntityWithWorkersExtensions.WorkersAssigned(module),
                    product == null ? null : getProductSnapshot(product),
                    product == null ? null : (module.IsForImport() ? "import" : "export"),
                    shipModule == null ? 0 : shipModule.Capacity.Value));
            }

            CargoShipV2 ship = depot.CargoShip.ValueOrNull;
            ContractShipSnapshot shipSnapshot = null;
            if (ship != null && !ship.IsDestroyed)
            {
                CargoShipAssignedToDockJobProviderBase jobProvider =
                    ship.JobProvider as CargoShipAssignedToDockJobProviderBase;
                shipSnapshot = new ContractShipSnapshot(
                    ship.Id.Value,
                    ship.Prototype.Id.ToString(),
                    getPrototypeName(ship.Prototype.Id.ToString(), ship.Prototype.Strings.Name.TranslatedString),
                    !ship.IsPaused,
                    EntityWithWorkersExtensions.WorkersAssigned(ship),
                    getProductSnapshot(ship.FuelProto),
                    ship.IsFuelReductionEnabled,
                    ship.JourneyDuration.HasValue
                        ? (double?)ship.JourneyDuration.Value.Seconds.ToDouble()
                        : null,
                    jobProvider == null
                        ? (int?)null
                        : jobProvider.FuelPerJourneyNeeded().Value);
            }

            routes.Add(new ContractRouteSnapshot(
                depot.Id.Value,
                depot.Prototype.Id.ToString(),
                getPrototypeName(depot.Prototype.Id.ToString(), depot.Prototype.Strings.Name.TranslatedString),
                depot.CustomTitle.ValueOrNull,
                !depot.IsPaused,
                depot.SlotCount,
                contract.Id.ToString(),
                getLogisticsZones(depot),
                modules,
                shipSnapshot));
        }

        List<EstablishedContractSnapshot> establishedContracts =
            new List<EstablishedContractSnapshot>(establishedById.Values);
        establishedContracts.Sort(delegate(
            EstablishedContractSnapshot left,
            EstablishedContractSnapshot right)
        {
            return StringComparer.Ordinal.Compare(left.GameId, right.GameId);
        });
        routes.Sort(delegate(ContractRouteSnapshot left, ContractRouteSnapshot right)
        {
            return left.DepotEntityId.CompareTo(right.DepotEntityId);
        });

        return new ContractStateSnapshot(establishedContracts, routes);
    }

    private static EstablishedContractSnapshot getEstablishedContractSnapshot(
        ContractProto contract)
    {
        return new EstablishedContractSnapshot(
            contract.Id.ToString(),
            getProductSnapshot(contract.ProductToPayWith),
            contract.QuantityToPayWith.Value,
            getProductSnapshot(contract.ProductToBuy),
            contract.GetQuantityToBuy(Percent.Hundred).Value,
            contract.UpointsPerMonthBase.Value.ToDouble(),
            contract.UpointsPer100ProductsBoughtBase.Value.ToDouble(),
            contract.UpointsToEstablish.Value.ToDouble(),
            contract.MinReputationRequired);
    }

    private static ContractProductSnapshot getProductSnapshot(ProductProto product)
    {
        string productId = product.Id.ToString();
        return new ContractProductSnapshot(
            productId,
            getPrototypeName(productId, product.Strings.Name.TranslatedString));
    }

    private static string getPrototypeName(string prototypeId, string translatedName)
    {
        return String.IsNullOrWhiteSpace(translatedName) ? prototypeId : translatedName;
    }

    private static void appendContractState(
        StringBuilder json,
        ContractStateSnapshot contracts)
    {
        json.Append("\"contracts\":{\"established\":[");
        for (int i = 0; i < contracts.Established.Count; i++)
        {
            EstablishedContractSnapshot contract = contracts.Established[i];
            json.Append('{');
            appendString(json, "gameId", contract.GameId, true);
            appendContractProduct(json, "exportedProduct", contract.ExportedProduct, true);
            appendNumber(json, "exportedQuantity", contract.ExportedQuantity, true);
            appendContractProduct(json, "importedProduct", contract.ImportedProduct, true);
            appendNumber(json, "importedQuantity", contract.ImportedQuantity, true);
            appendDecimal(json, "unityPerCycle", contract.UnityPerCycle, true);
            appendDecimal(json, "unityPer100Imported", contract.UnityPer100Imported, true);
            appendDecimal(json, "unityToEstablish", contract.UnityToEstablish, true);
            appendNumber(json, "minimumReputation", contract.MinimumReputation, false);
            json.Append('}');
            if (i < contracts.Established.Count - 1)
            {
                json.Append(',');
            }
        }

        json.Append("],\"routes\":[");
        for (int i = 0; i < contracts.Routes.Count; i++)
        {
            ContractRouteSnapshot route = contracts.Routes[i];
            json.Append('{');
            appendNumber(json, "depotEntityId", route.DepotEntityId, true);
            appendString(json, "depotPrototypeId", route.DepotPrototypeId, true);
            appendString(json, "depotPrototypeName", route.DepotPrototypeName, true);
            appendNullableString(json, "depotCustomTitle", route.DepotCustomTitle, true);
            json.Append("\"running\":");
            json.Append(route.Running ? "true" : "false");
            json.Append(',');
            appendNumber(json, "slotCount", route.SlotCount, true);
            appendString(json, "contractGameId", route.ContractGameId, true);
            json.Append("\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < route.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = route.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < route.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }

            json.Append("],\"modules\":[");
            for (int moduleIndex = 0; moduleIndex < route.Modules.Count; moduleIndex++)
            {
                ContractModuleSnapshot module = route.Modules[moduleIndex];
                json.Append('{');
                appendNumber(json, "entityId", module.EntityId, true);
                appendNumber(json, "slot", module.Slot, true);
                appendString(json, "prototypeId", module.PrototypeId, true);
                appendString(json, "prototypeName", module.PrototypeName, true);
                json.Append("\"running\":");
                json.Append(module.Running ? "true" : "false");
                json.Append(',');
                appendNumber(json, "workers", module.Workers, true);
                appendNullableContractProduct(json, "selectedProduct", module.SelectedProduct, true);
                appendNullableString(json, "direction", module.Direction, true);
                appendNumber(json, "onboardCapacity", module.OnboardCapacity, false);
                json.Append('}');
                if (moduleIndex < route.Modules.Count - 1)
                {
                    json.Append(',');
                }
            }

            json.Append("],\"ship\":");
            if (route.Ship == null)
            {
                json.Append("null");
            }
            else
            {
                ContractShipSnapshot ship = route.Ship;
                json.Append('{');
                appendNumber(json, "entityId", ship.EntityId, true);
                appendString(json, "prototypeId", ship.PrototypeId, true);
                appendString(json, "prototypeName", ship.PrototypeName, true);
                json.Append("\"running\":");
                json.Append(ship.Running ? "true" : "false");
                json.Append(',');
                appendNumber(json, "workers", ship.Workers, true);
                appendContractProduct(json, "fuelProduct", ship.FuelProduct, true);
                json.Append("\"saveFuel\":");
                json.Append(ship.SaveFuel ? "true" : "false");
                json.Append(',');
                appendNullableDecimal(
                    json,
                    "journeyDurationSeconds",
                    ship.JourneyDurationSeconds,
                    true);
                appendNullableNumber(json, "fuelPerTrip", ship.FuelPerTrip, false);
                json.Append('}');
            }

            json.Append('}');
            if (i < contracts.Routes.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendContractProduct(
        StringBuilder json,
        string key,
        ContractProductSnapshot product,
        bool appendComma)
    {
        json.Append('"');
        json.Append(key);
        json.Append("\":{");
        appendString(json, "productId", product.ProductId, true);
        appendString(json, "name", product.Name, false);
        json.Append('}');
        if (appendComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableContractProduct(
        StringBuilder json,
        string key,
        ContractProductSnapshot product,
        bool appendComma)
    {
        if (product == null)
        {
            json.Append('"');
            json.Append(key);
            json.Append("\":null");
            if (appendComma)
            {
                json.Append(',');
            }
            return;
        }

        appendContractProduct(json, key, product, appendComma);
    }

    private ProductionSnapshot getProductionSnapshot()
    {
        BuildingCountSnapshot dataCenters = new BuildingCountSnapshot();
        BuildingCountSnapshot racks = new BuildingCountSnapshot();
        BuildingCountSnapshot waterChillers = new BuildingCountSnapshot();
        ChickenFarmSnapshot slaughteringFarms = new ChickenFarmSnapshot(true);
        ChickenFarmSnapshot eggsOnlyFarms = new ChickenFarmSnapshot(false);
        List<ChickenFarmEntitySnapshot> chickenFarmEntities =
            new List<ChickenFarmEntitySnapshot>();
        Dictionary<string, CropFarmSnapshot> cropFarmConfigurations =
            new Dictionary<string, CropFarmSnapshot>(StringComparer.Ordinal);
        List<CropFarmEntitySnapshot> cropFarmEntities = new List<CropFarmEntitySnapshot>();
        List<MachineInventorySnapshot> machines = new List<MachineInventorySnapshot>();
        List<ProductionEntitySnapshot> productionEntities =
            new List<ProductionEntitySnapshot>();
        List<AreaEntitySnapshot> areaEntities = new List<AreaEntitySnapshot>();
        List<MineTowerSnapshot> mineTowers = new List<MineTowerSnapshot>();

        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            IStaticEntity staticEntity = entity as IStaticEntity;
            if (entity.IsDestroyed)
            {
                continue;
            }

            List<LogisticsZoneSnapshot> entityZones = getLogisticsZones(staticEntity);
            MineTower mineTower = entity as MineTower;
            if (mineTower != null && staticEntity != null && staticEntity.IsConstructed)
            {
                List<int> assignedOreSorterEntityIds = new List<int>();
                foreach (OreSortingPlant assignedSorter in mineTower.AssignedInputOreSorters)
                {
                    if (!assignedSorter.IsDestroyed)
                    {
                        assignedOreSorterEntityIds.Add(assignedSorter.Id.Value);
                    }
                }
                assignedOreSorterEntityIds.Sort();
                mineTowers.Add(new MineTowerSnapshot(
                    entity.Id.Value,
                    assignedOreSorterEntityIds));
            }
            if (staticEntity != null && isAreaBuilding(entity))
            {
                string prototypeName = staticEntity.Prototype.Strings.Name.TranslatedString;
                int availableRecipeCount;
                List<AreaRecipeSnapshot> areaRecipes = getAreaRecipes(
                    entity,
                    staticEntity,
                    out availableRecipeCount);
                areaEntities.Add(new AreaEntitySnapshot(
                    entity.Id.Value,
                    entity.Prototype.Id.ToString(),
                    String.IsNullOrWhiteSpace(prototypeName)
                        ? entity.Prototype.Id.ToString()
                        : prototypeName,
                    staticEntity.ConstructionState.ToString(),
                    staticEntity.IsConstructed,
                    staticEntity.IsConstructed && !entity.IsPaused,
                    staticEntity.CenterTile.X,
                    staticEntity.CenterTile.Y,
                    entityZones,
                    areaRecipes,
                    availableRecipeCount,
                    getOreSorterConfiguration(entity),
                    getTrainStationConfiguration(entity),
                    getForestryConfiguration(entity as ForestryTower),
                    getOfficeConfiguration(entity as OfficeBuilding)));
            }

            if (staticEntity != null && !staticEntity.IsConstructed)
            {
                continue;
            }

            bool isRunning = !entity.IsPaused;
            string prototypeId = entity.Prototype.Id.ToString();
            bool isOceanWaterPump = String.Equals(
                entity.GetType().FullName,
                OceanWaterPumpRuntimeTypeName,
                StringComparison.Ordinal);
            DataCenter dataCenterEntity = entity as DataCenter;
            if (TrackedProductionPrototypeIds.Contains(prototypeId)
                || TrackedPrototypeIndices.ContainsKey(prototypeId)
                || isOceanWaterPump
                || isAreaBuilding(entity))
            {
                NuclearReactor reactor = entity as NuclearReactor;
                productionEntities.Add(new ProductionEntitySnapshot(
                    entity.Id.Value,
                    prototypeId,
                    isRunning,
                    getAssignedRecipeIds(entity),
                    entityZones,
                    reactor == null
                        ? null
                        : new NuclearReactorConfigurationSnapshot(
                            reactor.EnrichmentStep,
                            reactor.TargetPowerLevel.ToIntPercentRounded()),
                    dataCenterEntity == null
                        ? (int?)null
                        : dataCenterEntity.RacksCount,
                    getTrainStationConfiguration(entity)));
            }

            WellPump groundwaterPump = entity as WellPump;
            if (groundwaterPump != null)
            {
                machines.Add(new MachineInventorySnapshot(
                    entity.Id.Value,
                    prototypeId,
                    isRunning,
                    groundwaterPump.CustomTitle.ValueOrNull,
                    groundwaterPump.CenterTile.X,
                    groundwaterPump.CenterTile.Y,
                    entityZones,
                    getGroundwaterAquifer(groundwaterPump)));
            }

            if (dataCenterEntity != null
                && String.Equals(prototypeId, DataCenterPrototypeId, StringComparison.Ordinal))
            {
                dataCenters.Add(isRunning, 1);
                racks.Add(isRunning, dataCenterEntity.RacksCount);
                continue;
            }

            if (String.Equals(prototypeId, WaterChillerPrototypeId, StringComparison.Ordinal))
            {
                waterChillers.Add(isRunning, 1);
                continue;
            }

            AnimalFarm animalFarm = entity as AnimalFarm;
            if (animalFarm != null
                && String.Equals(prototypeId, ChickenFarmPrototypeId, StringComparison.Ordinal))
            {
                ChickenFarmSnapshot farm = animalFarm.IsSlaughteringEnabled
                    ? slaughteringFarms
                    : eggsOnlyFarms;
                farm.Add(isRunning, animalFarm.AnimalsCount);
                chickenFarmEntities.Add(new ChickenFarmEntitySnapshot(
                    entity.Id.Value,
                    isRunning,
                    animalFarm.IsSlaughteringEnabled,
                    animalFarm.AnimalsCount,
                    entityZones));
                continue;
            }

            Farm cropFarm = entity as Farm;
            if (cropFarm == null
                || (!String.Equals(prototypeId, GreenhousePrototypeId, StringComparison.Ordinal)
                    && !String.Equals(prototypeId, GreenhouseIiPrototypeId, StringComparison.Ordinal)))
            {
                continue;
            }

            string[] schedule = new string[cropFarm.Schedule.Length];
            StringBuilder key = new StringBuilder(prototypeId);
            for (int i = 0; i < cropFarm.Schedule.Length; i++)
            {
                CropProto crop = cropFarm.Schedule[i].ValueOrNull;
                schedule[i] = crop == null ? null : crop.Id.ToString();
                key.Append('|');
                key.Append(schedule[i] ?? "null");
            }

            int fertilityTargetPercent = cropFarm.FertilityTargetValue.ToIntPercentRounded();
            string fertilizerProductId = getCropFarmFertilizerProductId(cropFarm);
            cropFarmEntities.Add(new CropFarmEntitySnapshot(
                entity.Id.Value,
                prototypeId,
                isRunning,
                schedule,
                fertilityTargetPercent,
                fertilizerProductId,
                entityZones));
            key.Append('|');
            key.Append(fertilityTargetPercent.ToString(CultureInfo.InvariantCulture));
            key.Append('|');
            key.Append(fertilizerProductId ?? "null");

            CropFarmSnapshot cropFarmSnapshot;
            if (!cropFarmConfigurations.TryGetValue(key.ToString(), out cropFarmSnapshot))
            {
                cropFarmSnapshot = new CropFarmSnapshot(
                    prototypeId,
                    schedule,
                    fertilityTargetPercent,
                    fertilizerProductId);
                cropFarmConfigurations.Add(key.ToString(), cropFarmSnapshot);
            }

            cropFarmSnapshot.Add(isRunning);
        }

        List<ChickenFarmSnapshot> chickenFarms = new List<ChickenFarmSnapshot>();
        if (slaughteringFarms.Built > 0)
        {
            chickenFarms.Add(slaughteringFarms);
        }
        if (eggsOnlyFarms.Built > 0)
        {
            chickenFarms.Add(eggsOnlyFarms);
        }

        List<CropFarmSnapshot> cropFarms = new List<CropFarmSnapshot>(cropFarmConfigurations.Values);
        cropFarms.Sort(delegate(CropFarmSnapshot left, CropFarmSnapshot right)
        {
            return String.CompareOrdinal(left.Key, right.Key);
        });
        cropFarmEntities.Sort(delegate(CropFarmEntitySnapshot left, CropFarmEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        machines.Sort(delegate(MachineInventorySnapshot left, MachineInventorySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        chickenFarmEntities.Sort(delegate(
            ChickenFarmEntitySnapshot left,
            ChickenFarmEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        productionEntities.Sort(delegate(
            ProductionEntitySnapshot left,
            ProductionEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        areaEntities.Sort(delegate(AreaEntitySnapshot left, AreaEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        mineTowers.Sort(delegate(MineTowerSnapshot left, MineTowerSnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });

        return new ProductionSnapshot(
            dataCenters,
            racks,
            waterChillers,
            getNamedLogisticsZones(),
            chickenFarms,
            chickenFarmEntities,
            cropFarms,
            cropFarmEntities,
            machines,
            productionEntities,
            areaEntities,
            mineTowers);
    }

    private string getCropFarmFertilizerProductId(Farm farm)
    {
        bool pipeIsAmbiguous;
        string pipeProductId = getCropFarmPipeFertilizerProductId(
            farm,
            out pipeIsAmbiguous);
        if (pipeIsAmbiguous)
        {
            return null;
        }

        if (pipeProductId != null)
        {
            return pipeProductId;
        }

        if (!farm.StoredFertilizerCount.IsPositive)
        {
            return null;
        }

        Percent maximumFertility = farm.MaxFertilityProvidedByFertilizer;
        Percent fertilityPerUnit = farm.FertilityPerFertilizer;
        if (maximumFertility == 100.Percent()
            && fertilityPerUnit == 1.Percent())
        {
            return OrganicFertilizerProductId;
        }
        if (maximumFertility == 120.Percent()
            && fertilityPerUnit == 2.Percent())
        {
            return FertilizerIProductId;
        }
        if (maximumFertility == 140.Percent()
            && fertilityPerUnit == 2.5.Percent())
        {
            return FertilizerIiProductId;
        }

        return null;
    }

    private string getCropFarmPipeFertilizerProductId(
        Farm farm,
        out bool isAmbiguous)
    {
        isAmbiguous = false;

        foreach (IoPort port in farm.Ports)
        {
            if (port.Name != Farm.INPUT_FERTILIZER_PORT_NAME
                || !port.ConnectedPort.HasValue)
            {
                continue;
            }

            Transport transport = port.ConnectedPort.Value.OwnerEntity as Transport;
            if (transport == null)
            {
                continue;
            }

            string transportedProductId = null;
            foreach (TransportedProductMutable product in transport.TransportedProducts)
            {
                string productId = getFertilizerProductId(product.SlimId);
                if (productId == null)
                {
                    isAmbiguous = true;
                    return null;
                }
                if (transportedProductId != null
                    && !String.Equals(
                        transportedProductId,
                        productId,
                        StringComparison.Ordinal))
                {
                    isAmbiguous = true;
                    return null;
                }

                transportedProductId = productId;
            }

            string lastProductId = getFertilizerProductId(
                transport.LastInsertedProduct);
            if (transportedProductId != null
                && lastProductId != null
                && !String.Equals(
                    transportedProductId,
                    lastProductId,
                    StringComparison.Ordinal))
            {
                isAmbiguous = true;
                return null;
            }

            return transportedProductId ?? lastProductId;
        }

        return null;
    }

    private string getFertilizerProductId(ProductSlimId slimId)
    {
        ProductProto product = slimId.ToFullOrPhantom(m_productsManager.SlimIdManager);
        string productId = product.Id.ToString();

        if (String.Equals(productId, OrganicFertilizerProductId, StringComparison.Ordinal)
            || String.Equals(productId, FertilizerIProductId, StringComparison.Ordinal)
            || String.Equals(productId, FertilizerIiProductId, StringComparison.Ordinal))
        {
            return productId;
        }

        return null;
    }

    private static OreSorterConfigurationSnapshot getOreSorterConfiguration(IEntity entity)
    {
        OreSortingPlant sorter = entity as OreSortingPlant;
        if (sorter == null)
        {
            return null;
        }

        double throughputPerCycle = sorter.SortedPerDuration.Value
            * 60.0
            / sorter.Prototype.Duration.Seconds.ToDouble();
        List<OreSorterProductSnapshot> products = new List<OreSorterProductSnapshot>();
        foreach (ProductProto product in sorter.AllowedProducts)
        {
            string name = product.Strings.Name.TranslatedString;
            products.Add(new OreSorterProductSnapshot(
                product.Id.ToString(),
                String.IsNullOrWhiteSpace(name) ? product.Id.ToString() : name,
                sorter.ProductsData[product].CanBeWasted));
        }
        products.Sort(delegate(OreSorterProductSnapshot left, OreSorterProductSnapshot right)
        {
            return String.CompareOrdinal(left.ProductId, right.ProductId);
        });

        return new OreSorterConfigurationSnapshot(
            throughputPerCycle,
            sorter.Prototype.ConversionLoss.ToIntPercentRounded(),
            products);
    }

    private static List<AreaRecipeSnapshot> getAreaRecipes(
        IEntity entity,
        IStaticEntity staticEntity,
        out int availableRecipeCount)
    {
        List<AreaRecipeSnapshot> recipes = new List<AreaRecipeSnapshot>();
        availableRecipeCount = 0;
        MachineProto machine = staticEntity.Prototype as MachineProto;
        if (machine == null)
        {
            return recipes;
        }

        foreach (RecipeProto recipe in machine.Recipes)
        {
            availableRecipeCount++;
        }

        IEntityWithAssignedRecipes recipeEntity = entity as IEntityWithAssignedRecipes;
        HashSet<string> assignedRecipeIds = new HashSet<string>(StringComparer.Ordinal);
        if (recipeEntity != null)
        {
            foreach (RecipeProto assignedRecipe in recipeEntity.RecipesAssigned)
            {
                assignedRecipeIds.Add(assignedRecipe.Id.ToString());
            }
        }

        foreach (RecipeProto recipe in machine.Recipes)
        {
            string recipeId = recipe.Id.ToString();
            bool assigned = assignedRecipeIds.Contains(recipeId)
                || (recipeEntity == null && machine.UseAllRecipesAtStartOrAfterUnlock);
            if (!assigned && availableRecipeCount != 1)
            {
                continue;
            }

            IRecipeForUi recipeForUi = machine.GetRecipeForUi(recipe);
            List<AreaRecipeProductSnapshot> inputs =
                new List<AreaRecipeProductSnapshot>();
            List<AreaRecipeProductSnapshot> outputs =
                new List<AreaRecipeProductSnapshot>();

            foreach (RecipeInput input in recipeForUi.AllUserVisibleInputs)
            {
                inputs.Add(new AreaRecipeProductSnapshot(
                    input.Product.Id.ToString(),
                    getProtoName(input.Product),
                    input.Quantity.Value));
            }
            foreach (RecipeOutput output in recipeForUi.AllUserVisibleOutputs)
            {
                outputs.Add(new AreaRecipeProductSnapshot(
                    output.Product.Id.ToString(),
                    getProtoName(output.Product),
                    output.Quantity.Value));
            }

            string recipeName = recipe.Strings.Name.TranslatedString;
            recipes.Add(new AreaRecipeSnapshot(
                recipeId,
                String.IsNullOrWhiteSpace(recipeName) ? recipeId : recipeName,
                Math.Max(0.001, recipeForUi.Duration.Seconds.ToDouble()),
                assigned,
                inputs,
                outputs));
        }

        recipes.Sort(delegate(AreaRecipeSnapshot left, AreaRecipeSnapshot right)
        {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        return recipes;
    }

    private static OfficeConfigurationSnapshot getOfficeConfiguration(OfficeBuilding office)
    {
        return office == null
            ? null
            : new OfficeConfigurationSnapshot(office.ComputingBoostStep);
    }

    private static TrainStationConfigurationSnapshot getTrainStationConfiguration(
        IEntity entity)
    {
        ITrainStationModule stationModule = entity as ITrainStationModule;
        if (stationModule == null)
        {
            return null;
        }

        TrainStationProductSnapshot selectedProduct = null;
        if (stationModule.StoredProduct.HasValue)
        {
            var product = stationModule.StoredProduct.Value;
            selectedProduct = new TrainStationProductSnapshot(
                product.Id.ToString(),
                getProtoName(product));
        }

        return new TrainStationConfigurationSnapshot(
            stationModule.IsForLoading,
            selectedProduct);
    }

    private ForestryConfigurationSnapshot getForestryConfiguration(ForestryTower tower)
    {
        if (tower == null)
        {
            return null;
        }

        int treeCount = countManagedForestryTrees(tower);
        int targetHarvestPercent = (int)Math.Round(
            tower.TargetHarvestPercent.ToFloat() * 100.0);
        bool cuttingEnabled = tower.TargetHarvestPercent < ForestryTower.NO_CUT_AT;
        List<ForestryProductSnapshot> outputs = new List<ForestryProductSnapshot>();

        if (!cuttingEnabled || treeCount <= 0)
        {
            return new ForestryConfigurationSnapshot(
                treeCount,
                cuttingEnabled,
                targetHarvestPercent,
                0,
                null,
                outputs);
        }

        double targetGrowth = Math.Max(0.01, tower.TargetHarvestPercent.ToFloat());
        double totalWeight = 0;
        double harvestsPerTreePerCycleWeighted = 0;
        Dictionary<string, ForestryProductAccumulator> outputByProduct =
            new Dictionary<string, ForestryProductAccumulator>(StringComparer.Ordinal);

        for (int i = 0; i < tower.TreeTypes.Count; i++)
        {
            KeyValuePair<TreePlantingGroupProto, int> configuredGroup = tower.TreeTypes[i];
            if (configuredGroup.Value <= 0 || configuredGroup.Key.Trees.Length == 0)
            {
                continue;
            }

            double treeWeight = (double)configuredGroup.Value / configuredGroup.Key.Trees.Length;
            foreach (TreeProto treeProto in configuredGroup.Key.Trees)
            {
                accumulateForestryYield(
                    treeProto,
                    treeWeight,
                    targetGrowth,
                    tower.TargetHarvestPercent,
                    outputByProduct,
                    ref harvestsPerTreePerCycleWeighted);
                totalWeight += treeWeight;
            }
        }

        if (totalWeight <= 0 && m_treesManager != null)
        {
            foreach (TreeId treeId in tower.Trees)
            {
                if (!isManagedForestryTree(tower, treeId))
                {
                    continue;
                }

                TreeData treeData;
                if (!m_treesManager.Trees.TryGetValue(treeId, out treeData))
                {
                    continue;
                }

                accumulateForestryYield(
                    treeData.Proto,
                    1,
                    targetGrowth,
                    tower.TargetHarvestPercent,
                    outputByProduct,
                    ref harvestsPerTreePerCycleWeighted);
                totalWeight += 1;
            }
        }

        if (totalWeight <= 0)
        {
            return new ForestryConfigurationSnapshot(
                treeCount,
                cuttingEnabled,
                targetHarvestPercent,
                0,
                null,
                outputs);
        }

        double harvestsPerTreePerCycle = harvestsPerTreePerCycleWeighted / totalWeight;
        double harvestsPerCycle = treeCount * harvestsPerTreePerCycle;
        foreach (ForestryProductAccumulator accumulator in outputByProduct.Values)
        {
            outputs.Add(new ForestryProductSnapshot(
                accumulator.ProductId,
                accumulator.Name,
                treeCount * accumulator.QuantityPerTreePerCycleWeighted / totalWeight));
        }
        outputs.Sort(delegate(ForestryProductSnapshot left, ForestryProductSnapshot right)
        {
            return String.CompareOrdinal(left.ProductId, right.ProductId);
        });

        return new ForestryConfigurationSnapshot(
            treeCount,
            cuttingEnabled,
            targetHarvestPercent,
            harvestsPerCycle,
            harvestsPerTreePerCycle > 0 ? (double?)(1 / harvestsPerTreePerCycle) : null,
            outputs);
    }

    private static void accumulateForestryYield(
        TreeProto treeProto,
        double weight,
        double targetGrowth,
        Percent harvestPercent,
        Dictionary<string, ForestryProductAccumulator> outputByProduct,
        ref double harvestsPerTreePerCycleWeighted)
    {
        double durationMonths = Math.Max(
            0.01,
            treeProto.GetTreeMaxAge().Years.ToFloat() * 12.0 * targetGrowth);
        double harvestRate = 1 / durationMonths;
        ProductProto product = treeProto.ProductWhenHarvested.Product;
        string productId = product.Id.ToString();
        ForestryProductAccumulator accumulator;
        if (!outputByProduct.TryGetValue(productId, out accumulator))
        {
            accumulator = new ForestryProductAccumulator(productId, getProtoName(product));
            outputByProduct.Add(productId, accumulator);
        }

        harvestsPerTreePerCycleWeighted += weight * harvestRate;
        accumulator.QuantityPerTreePerCycleWeighted +=
            weight * harvestRate * treeProto.GetHarvestedQuantity(harvestPercent).Value;
    }

    private int countManagedForestryTrees(ForestryTower tower)
    {
        int count = 0;
        foreach (TreeId treeId in tower.Trees)
        {
            if (isManagedForestryTree(tower, treeId)
                && (m_treesManager == null || m_treesManager.Trees.ContainsKey(treeId)))
            {
                count++;
            }
        }
        return count;
    }

    private static bool isManagedForestryTree(ForestryTower tower, TreeId treeId)
    {
        foreach (TerrainDesignation designation in tower.ManagedDesignations)
        {
            if (designation.IsForestry && designation.Area.ContainsTile(treeId.Position))
            {
                return true;
            }
        }
        return false;
    }

    private static string getProtoName(Proto proto)
    {
        string name = proto.Strings.Name.TranslatedString;
        return String.IsNullOrWhiteSpace(name) ? proto.Id.ToString() : name;
    }

    private GroundwaterAquiferSnapshot getGroundwaterAquifer(WellPump pump)
    {
        IVirtualTerrainResource resource = m_virtualResourceManager
            .RetrieveResourcesAt(pump.ProductToMine, pump.CenterTile.Tile2i)
            .FirstOrDefault();
        SimpleVirtualResource simpleResource = resource as SimpleVirtualResource;
        if (resource == null || simpleResource == null)
        {
            return null;
        }

        Tile3i position = simpleResource.Position;
        return new GroundwaterAquiferSnapshot(
            position.X.ToString(CultureInfo.InvariantCulture)
                + ":"
                + position.Y.ToString(CultureInfo.InvariantCulture),
            position.X,
            position.Y,
            resource.Quantity.Value,
            resource.Capacity.Value,
            resource.ConfiguredCapacity.Value);
    }

    private static List<string> getAssignedRecipeIds(IEntity entity)
    {
        List<string> recipeIds = new List<string>();
        IEntityWithAssignedRecipes recipeEntity = entity as IEntityWithAssignedRecipes;
        if (recipeEntity == null)
        {
            return recipeIds;
        }

        foreach (RecipeProto recipe in recipeEntity.RecipesAssigned)
        {
            recipeIds.Add(recipe.Id.ToString());
        }

        recipeIds.Sort(StringComparer.Ordinal);
        return recipeIds;
    }

    private List<LogisticsZoneSnapshot> getLogisticsZones(IStaticEntity staticEntity)
    {
        List<LogisticsZoneSnapshot> zones = new List<LogisticsZoneSnapshot>();
        if (staticEntity == null)
        {
            return zones;
        }

        foreach (LogisticsZoneFast zoneFast in m_logisticsZonesManager.PlayerZonesFast)
        {
            if (!zoneFast.IsEmpty && zoneFast.Contains(staticEntity))
            {
                LogisticsZone zone = zoneFast.Zone;
                zones.Add(new LogisticsZoneSnapshot(
                    zone.Id.Value,
                    zone.CustomName.ValueOrNull));
            }
        }
        zones.Sort(delegate(LogisticsZoneSnapshot left, LogisticsZoneSnapshot right)
        {
            return left.Id.CompareTo(right.Id);
        });
        return zones;
    }

    private static bool isAreaBuilding(IEntity entity)
    {
        IStaticEntity staticEntity = entity as IStaticEntity;
        if (staticEntity == null)
        {
            return false;
        }

        string entityNamespace = entity.GetType().Namespace;
        return entity is ForestryTower
            || staticEntity.Prototype is MachineProto
            || entity is IEntityWithAssignedRecipes
            || entity is IEntityWithWorkers
            || (!String.IsNullOrWhiteSpace(entityNamespace)
                && entityNamespace.StartsWith(
                    "Mafi.Core.Buildings.Settlements",
                    StringComparison.Ordinal));
    }

    private List<LogisticsZoneSnapshot> getNamedLogisticsZones()
    {
        List<LogisticsZoneSnapshot> zones = new List<LogisticsZoneSnapshot>();
        foreach (LogisticsZoneFast zoneFast in m_logisticsZonesManager.PlayerZonesFast)
        {
            LogisticsZone zone = zoneFast.Zone;
            string name = zone.CustomName.ValueOrNull;
            if (!String.IsNullOrWhiteSpace(name))
            {
                zones.Add(new LogisticsZoneSnapshot(zone.Id.Value, name));
            }
        }
        zones.Sort(delegate(LogisticsZoneSnapshot left, LogisticsZoneSnapshot right)
        {
            return left.Id.CompareTo(right.Id);
        });
        return zones;
    }

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

    private int[] getResearchLevels()
    {
        int[] levels = new int[TrackedResearch.Length];

        foreach (ResearchNode node in m_researchManager.AllNodes)
        {
            int index;
            if (TrackedResearchIndices.TryGetValue(node.Proto.Id.ToString(), out index))
            {
                levels[index] = Math.Max(0, node.TimesResearched);
            }
        }

        return levels;
    }

    private EdictState[] getEdictStates()
    {
        EdictState[] states = new EdictState[TrackedEdicts.Length];
        for (int i = 0; i < states.Length; i++)
        {
            states[i] = new EdictState();
        }

        foreach (Edict edict in m_edictsManager.AllEdicts)
        {
            TrackedEdictTier tier;
            if (!TrackedEdictTiers.TryGetValue(edict.Prototype.Id.ToString(), out tier))
            {
                continue;
            }

            EdictState state = states[tier.EdictIndex];
            if (edict.IsEnabled && tier.Level >= state.EnabledLevel)
            {
                state.EnabledLevel = tier.Level;
                state.InactiveReason = edict.IsActive
                    || String.IsNullOrWhiteSpace(edict.LastReasonForNotBeingActive)
                    ? null
                    : edict.LastReasonForNotBeingActive;
            }

            if (edict.IsActive && tier.Level > state.ActiveLevel)
            {
                state.ActiveLevel = tier.Level;
            }
        }

        for (int i = 0; i < states.Length; i++)
        {
            if (states[i].ActiveLevel == states[i].EnabledLevel)
            {
                states[i].InactiveReason = null;
            }
        }

        return states;
    }

    private int[] getReserveQuantities()
    {
        HashSet<EntityId> stationLinkedStorageIds = new HashSet<EntityId>();

        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            ITrainStationModule stationModule = entity as ITrainStationModule;
            if (stationModule == null)
            {
                continue;
            }

            foreach (StorageBase connectedStorage in stationModule.GetConnectedStorages())
            {
                stationLinkedStorageIds.Add(connectedStorage.Id);
            }
        }

        long[] quantities = new long[TrackedReserves.Length];
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            Storage storage = entity as Storage;
            if (storage == null
                || storage.IsDestroyed
                || !storage.IsConstructed
                || stationLinkedStorageIds.Contains(storage.Id)
                || storage.AssignedInputs.Count > 0
                || !storage.StoredProduct.HasValue)
            {
                continue;
            }

            string productId = storage.StoredProduct.Value.Id.ToString();
            int reserveIndex;
            if (!TrackedReserveProductIndices.TryGetValue(productId, out reserveIndex))
            {
                continue;
            }

            quantities[reserveIndex] = Math.Min(
                Int32.MaxValue,
                quantities[reserveIndex] + storage.CurrentQuantity.Value);
        }

        int[] result = new int[TrackedReserves.Length];
        for (int i = 0; i < quantities.Length; i++)
        {
            result[i] = (int)quantities[i];
        }

        return result;
    }

    private void initializeTrackedBuildingCounts()
    {
        Array.Clear(m_builtBuildings, 0, m_builtBuildings.Length);
        Array.Clear(m_runningBuildings, 0, m_runningBuildings.Length);
        m_trackedEntities.Clear();

        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            syncTrackedEntity(entity);
        }
    }

    private void onEntityAdded(IEntity entity)
    {
        syncTrackedEntity(entity);
    }

    private void onEntityRemoved(IEntity entity)
    {
        removeTrackedEntity(entity.Id);
    }

    private void onEntityPauseStateChanged(IEntity entity, bool isPaused)
    {
        syncTrackedEntity(entity);
    }

    private void onEntityConstructionStateChanged(
        IStaticEntity entity,
        ConstructionState constructionState)
    {
        syncTrackedEntity(entity);
    }

    private void onEntityUpgraded(IUpgradableEntity entity, IEntityProto newPrototype)
    {
        syncTrackedEntity(entity);
    }

    private void onNewMonthEnd()
    {
        refreshHistorySnapshots();
    }

    private void refreshHistorySnapshots()
    {
        m_maintenanceI = HistoryAverage.Empty;
        m_maintenanceII = HistoryAverage.Empty;
        m_maintenanceIII = HistoryAverage.Empty;

        foreach (IMaintenanceBufferReadonly buffer in m_maintenanceManager.MaintenanceBuffers)
        {
            string productId = buffer.Product.Id.ToString();
            HistoryAverage average = getHistoryAverage(buffer.ConsumedTotalStats, 1.0);

            if (String.Equals(productId, MaintenanceT1ProductId, StringComparison.Ordinal))
            {
                m_maintenanceI = average;
            }
            else if (String.Equals(productId, MaintenanceT2ProductId, StringComparison.Ordinal))
            {
                m_maintenanceII = average;
            }
            else if (String.Equals(productId, MaintenanceT3ProductId, StringComparison.Ordinal))
            {
                m_maintenanceIII = average;
            }
        }

        m_hydrogenFuel = getHydrogenFuelHistory();
        m_generationByType = getGenerationHistory();
    }

    private void syncTrackedEntity(IEntity entity)
    {
        TrackedEntityState previous;
        if (m_trackedEntities.TryGetValue(entity.Id, out previous))
        {
            m_builtBuildings[previous.Index]--;
            if (previous.IsRunning)
            {
                m_runningBuildings[previous.Index]--;
            }

            m_trackedEntities.Remove(entity.Id);
        }

        int index;
        if (!TrackedPrototypeIndices.TryGetValue(entity.Prototype.Id.ToString(), out index))
        {
            return;
        }

        IStaticEntity staticEntity = entity as IStaticEntity;
        if (entity.IsDestroyed || (staticEntity != null && !staticEntity.IsConstructed))
        {
            return;
        }

        bool isRunning = !entity.IsPaused;
        m_builtBuildings[index]++;
        if (isRunning)
        {
            m_runningBuildings[index]++;
        }

        m_trackedEntities.Add(entity.Id, new TrackedEntityState(index, isRunning));
    }

    private void removeTrackedEntity(EntityId entityId)
    {
        TrackedEntityState previous;
        if (!m_trackedEntities.TryGetValue(entityId, out previous))
        {
            return;
        }

        m_builtBuildings[previous.Index]--;
        if (previous.IsRunning)
        {
            m_runningBuildings[previous.Index]--;
        }

        m_trackedEntities.Remove(entityId);
    }

    private void queueSnapshotWrite(string json)
    {
        lock (m_snapshotWriteLock)
        {
            if (!m_acceptSnapshotWrites)
            {
                return;
            }

            m_pendingSnapshotJson = json;
            if (m_snapshotWriterRunning)
            {
                return;
            }

            m_snapshotWriterRunning = true;
        }

        ThreadPool.QueueUserWorkItem(delegate
        {
            flushPendingSnapshotWrites();
        });
    }

    private void flushPendingSnapshotWrites()
    {
        while (true)
        {
            string json;
            lock (m_snapshotWriteLock)
            {
                json = m_pendingSnapshotJson;
                m_pendingSnapshotJson = null;
                if (json == null)
                {
                    m_snapshotWriterRunning = false;
                    return;
                }
            }

            try
            {
                writeSnapshotFile(json);
            }
            catch (Exception ex)
            {
                Log.Info("CoI Calculator Exporter: unable to write game snapshot: " + ex);
            }
        }
    }

    private void writeSnapshotFile(string json)
    {
        string temporaryPath = m_snapshotPath + ".tmp";
        File.WriteAllText(temporaryPath, json, new UTF8Encoding(false));

        if (File.Exists(m_snapshotPath))
        {
            File.Replace(temporaryPath, m_snapshotPath, null);
        }
        else
        {
            File.Move(temporaryPath, m_snapshotPath);
        }
    }

    private FuelHistory getHydrogenFuelHistory()
    {
        foreach (FuelStatsCollector.StatsPerProduct stats in m_fuelStatsCollector.Stats)
        {
            if (!String.Equals(stats.Product.Id.ToString(), HydrogenProductId, StringComparison.Ordinal))
            {
                continue;
            }

            HistoryAverage vehicles = getHistoryAverage(stats.TotalConsumedInVehicles, 1.0);
            HistoryAverage cargoShips = getHistoryAverage(stats.TotalConsumedInCargoShips, 1.0);
            HistoryAverage battleShip = getHistoryAverage(stats.TotalConsumedInBattleship, 1.0);
            HistoryAverage powerGenerators = getHistoryAverage(
                stats.TotalConsumedInPowerGenerators,
                1.0);
            HistoryAverage trains = getHistoryAverage(stats.TotalConsumedInTrains, 1.0);
            int sampleMonths = Math.Max(
                Math.Max(vehicles.SampleMonths, cargoShips.SampleMonths),
                Math.Max(
                    Math.Max(battleShip.SampleMonths, powerGenerators.SampleMonths),
                    trains.SampleMonths));
            double totalAverage = sampleMonths == 0
                ? 0
                : (vehicles.Value * vehicles.SampleMonths
                    + cargoShips.Value * cargoShips.SampleMonths
                    + battleShip.Value * battleShip.SampleMonths
                    + powerGenerators.Value * powerGenerators.SampleMonths
                    + trains.Value * trains.SampleMonths)
                    / sampleMonths;

            return new FuelHistory(
                new HistoryAverage(totalAverage, sampleMonths),
                vehicles,
                cargoShips,
                battleShip,
                powerGenerators,
                trains);
        }

        return FuelHistory.Empty;
    }

    private List<GenerationHistory> getGenerationHistory()
    {
        List<GenerationHistory> result = new List<GenerationHistory>();

        foreach (ElectricityManager.ProductionPerProto production
            in m_electricityManager.GetProductionStatsPerProto())
        {
            Proto producerProto = production.ProducerProto as Proto;
            string prototypeId = producerProto == null
                ? production.ProducerProto.ToString()
                : producerProto.Id.ToString();
            string name = producerProto == null
                ? prototypeId
                : producerProto.Strings.Name.TranslatedString;

            result.Add(new GenerationHistory(
                prototypeId,
                String.IsNullOrWhiteSpace(name) ? prototypeId : name,
                getHistoryAverage(production.ProductionStats, 0.001)));
        }

        result.Sort(delegate(GenerationHistory left, GenerationHistory right)
        {
            return String.Compare(left.PrototypeId, right.PrototypeId, StringComparison.Ordinal);
        });
        return result;
    }

    private static HistoryAverage getHistoryAverage(ItemStats stats, double scale)
    {
        Lyst<long> monthly = new Lyst<long>(HistoryWindowMonths);
        stats.GetLatestData(StatsDataRange.Last120Months, monthly);
        int sampleMonths = Math.Min(HistoryWindowMonths, monthly.Count);

        if (sampleMonths == 0)
        {
            return HistoryAverage.Empty;
        }

        double total = 0;
        for (int i = 0; i < sampleMonths; i++)
        {
            total += monthly[i];
        }

        return new HistoryAverage(total / sampleMonths * scale, sampleMonths);
    }

    private static void appendNumber(
        StringBuilder json,
        string name,
        int value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        json.Append(value.ToString(CultureInfo.InvariantCulture));
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendDecimal(
        StringBuilder json,
        string name,
        double value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        json.Append(value.ToString("0.######", CultureInfo.InvariantCulture));
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableDecimal(
        StringBuilder json,
        string name,
        double? value,
        bool trailingComma)
    {
        json.Append('"');
        json.Append(name);
        json.Append("\":");
        if (value.HasValue)
        {
            json.Append(value.Value.ToString("0.######", CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableNumber(
        StringBuilder json,
        string name,
        int? value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        if (value.HasValue)
        {
            json.Append(value.Value.ToString(CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendAreaRecipeProducts(
        StringBuilder json,
        string key,
        List<AreaRecipeProductSnapshot> products,
        bool appendComma)
    {
        json.Append('"');
        json.Append(key);
        json.Append("\":[");
        for (int i = 0; i < products.Count; i++)
        {
            AreaRecipeProductSnapshot product = products[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            appendNumber(json, "quantity", product.Quantity, false);
            json.Append('}');
            if (i < products.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append(']');
        if (appendComma)
        {
            json.Append(',');
        }
    }

    private static void appendTrainStationConfiguration(
        StringBuilder json,
        TrainStationConfigurationSnapshot station)
    {
        if (station == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        json.Append("\"isForLoading\":");
        json.Append(station.IsForLoading ? "true" : "false");
        json.Append(",\"selectedProduct\":");
        if (station.SelectedProduct == null)
        {
            json.Append("null");
        }
        else
        {
            json.Append('{');
            appendString(json, "productId", station.SelectedProduct.ProductId, true);
            appendString(json, "name", station.SelectedProduct.Name, false);
            json.Append('}');
        }
        json.Append('}');
    }

    private static void appendForestryConfiguration(
        StringBuilder json,
        ForestryConfigurationSnapshot forestry)
    {
        if (forestry == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendNumber(json, "treeCount", forestry.TreeCount, true);
        json.Append("\"cuttingEnabled\":");
        json.Append(forestry.CuttingEnabled ? "true" : "false");
        json.Append(',');
        appendNumber(json, "targetHarvestPercent", forestry.TargetHarvestPercent, true);
        appendDecimal(json, "harvestsPerCycle", forestry.HarvestsPerCycle, true);
        json.Append("\"harvestDurationMonths\":");
        if (forestry.HarvestDurationMonths.HasValue)
        {
            json.Append(forestry.HarvestDurationMonths.Value.ToString(
                "0.######",
                CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }
        json.Append(",\"outputs\":[");
        for (int i = 0; i < forestry.Outputs.Count; i++)
        {
            ForestryProductSnapshot product = forestry.Outputs[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            appendDecimal(json, "quantityPerCycle", product.QuantityPerCycle, false);
            json.Append('}');
            if (i < forestry.Outputs.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendOfficeConfiguration(
        StringBuilder json,
        OfficeConfigurationSnapshot office)
    {
        if (office == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendNumber(json, "computingBoostStep", office.ComputingBoostStep, false);
        json.Append('}');
    }

    private static void appendOreSorterConfiguration(
        StringBuilder json,
        OreSorterConfigurationSnapshot sorter)
    {
        if (sorter == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendDecimal(json, "throughputPerCycle", sorter.ThroughputPerCycle, true);
        appendNumber(json, "conversionLossPercent", sorter.ConversionLossPercent, true);
        json.Append("\"products\":[");
        for (int i = 0; i < sorter.Products.Count; i++)
        {
            OreSorterProductSnapshot product = sorter.Products[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            json.Append("\"canBeWasted\":");
            json.Append(product.CanBeWasted ? "true" : "false");
            json.Append('}');
            if (i < sorter.Products.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendHistoryAverage(
        StringBuilder json,
        string name,
        HistoryAverage average,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":{");
        appendDecimal(json, "averagePerCycle", average.Value, true);
        appendNumber(json, "sampleMonths", average.SampleMonths, false);
        json.Append('}');
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendBuildingCount(
        StringBuilder json,
        string name,
        BuildingCountSnapshot count,
        bool trailingComma)
    {
        json.Append('"');
        json.Append(name);
        json.Append("\":{");
        appendNumber(json, "built", count.Built, true);
        appendNumber(json, "running", count.Running, false);
        json.Append('}');
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendString(
        StringBuilder json,
        string name,
        string value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":\"");
        appendEscapedString(json, value);
        json.Append('\"');
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableString(
        StringBuilder json,
        string name,
        string value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        if (value == null)
        {
            json.Append("null");
        }
        else
        {
            json.Append('\"');
            appendEscapedString(json, value);
            json.Append('\"');
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendEscapedString(StringBuilder json, string value)
    {
        for (int i = 0; i < value.Length; i++)
        {
            char character = value[i];
            switch (character)
            {
                case '\"': json.Append("\\\""); break;
                case '\\': json.Append("\\\\"); break;
                case '\b': json.Append("\\b"); break;
                case '\f': json.Append("\\f"); break;
                case '\n': json.Append("\\n"); break;
                case '\r': json.Append("\\r"); break;
                case '\t': json.Append("\\t"); break;
                default:
                    if (character < ' ')
                    {
                        json.Append("\\u");
                        json.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        json.Append(character);
                    }
                    break;
            }
        }
    }

    private sealed class ContractStateSnapshot
    {
        public readonly List<EstablishedContractSnapshot> Established;
        public readonly List<ContractRouteSnapshot> Routes;

        public ContractStateSnapshot(
            List<EstablishedContractSnapshot> established,
            List<ContractRouteSnapshot> routes)
        {
            Established = established;
            Routes = routes;
        }
    }

    private sealed class EstablishedContractSnapshot
    {
        public readonly string GameId;
        public readonly ContractProductSnapshot ExportedProduct;
        public readonly int ExportedQuantity;
        public readonly ContractProductSnapshot ImportedProduct;
        public readonly int ImportedQuantity;
        public readonly double UnityPerCycle;
        public readonly double UnityPer100Imported;
        public readonly double UnityToEstablish;
        public readonly int MinimumReputation;

        public EstablishedContractSnapshot(
            string gameId,
            ContractProductSnapshot exportedProduct,
            int exportedQuantity,
            ContractProductSnapshot importedProduct,
            int importedQuantity,
            double unityPerCycle,
            double unityPer100Imported,
            double unityToEstablish,
            int minimumReputation)
        {
            GameId = gameId;
            ExportedProduct = exportedProduct;
            ExportedQuantity = exportedQuantity;
            ImportedProduct = importedProduct;
            ImportedQuantity = importedQuantity;
            UnityPerCycle = unityPerCycle;
            UnityPer100Imported = unityPer100Imported;
            UnityToEstablish = unityToEstablish;
            MinimumReputation = minimumReputation;
        }
    }

    private sealed class ContractProductSnapshot
    {
        public readonly string ProductId;
        public readonly string Name;

        public ContractProductSnapshot(string productId, string name)
        {
            ProductId = productId;
            Name = name;
        }
    }

    private sealed class ContractRouteSnapshot
    {
        public readonly int DepotEntityId;
        public readonly string DepotPrototypeId;
        public readonly string DepotPrototypeName;
        public readonly string DepotCustomTitle;
        public readonly bool Running;
        public readonly int SlotCount;
        public readonly string ContractGameId;
        public readonly List<LogisticsZoneSnapshot> Zones;
        public readonly List<ContractModuleSnapshot> Modules;
        public readonly ContractShipSnapshot Ship;

        public ContractRouteSnapshot(
            int depotEntityId,
            string depotPrototypeId,
            string depotPrototypeName,
            string depotCustomTitle,
            bool running,
            int slotCount,
            string contractGameId,
            List<LogisticsZoneSnapshot> zones,
            List<ContractModuleSnapshot> modules,
            ContractShipSnapshot ship)
        {
            DepotEntityId = depotEntityId;
            DepotPrototypeId = depotPrototypeId;
            DepotPrototypeName = depotPrototypeName;
            DepotCustomTitle = depotCustomTitle;
            Running = running;
            SlotCount = slotCount;
            ContractGameId = contractGameId;
            Zones = zones;
            Modules = modules;
            Ship = ship;
        }
    }

    private sealed class ContractModuleSnapshot
    {
        public readonly int EntityId;
        public readonly int Slot;
        public readonly string PrototypeId;
        public readonly string PrototypeName;
        public readonly bool Running;
        public readonly int Workers;
        public readonly ContractProductSnapshot SelectedProduct;
        public readonly string Direction;
        public readonly int OnboardCapacity;

        public ContractModuleSnapshot(
            int entityId,
            int slot,
            string prototypeId,
            string prototypeName,
            bool running,
            int workers,
            ContractProductSnapshot selectedProduct,
            string direction,
            int onboardCapacity)
        {
            EntityId = entityId;
            Slot = slot;
            PrototypeId = prototypeId;
            PrototypeName = prototypeName;
            Running = running;
            Workers = workers;
            SelectedProduct = selectedProduct;
            Direction = direction;
            OnboardCapacity = onboardCapacity;
        }
    }

    private sealed class ContractShipSnapshot
    {
        public readonly int EntityId;
        public readonly string PrototypeId;
        public readonly string PrototypeName;
        public readonly bool Running;
        public readonly int Workers;
        public readonly ContractProductSnapshot FuelProduct;
        public readonly bool SaveFuel;
        public readonly double? JourneyDurationSeconds;
        public readonly int? FuelPerTrip;

        public ContractShipSnapshot(
            int entityId,
            string prototypeId,
            string prototypeName,
            bool running,
            int workers,
            ContractProductSnapshot fuelProduct,
            bool saveFuel,
            double? journeyDurationSeconds,
            int? fuelPerTrip)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            PrototypeName = prototypeName;
            Running = running;
            Workers = workers;
            FuelProduct = fuelProduct;
            SaveFuel = saveFuel;
            JourneyDurationSeconds = journeyDurationSeconds;
            FuelPerTrip = fuelPerTrip;
        }
    }

    private sealed class HistoryAverage
    {
        public static readonly HistoryAverage Empty = new HistoryAverage(0, 0);

        public readonly double Value;
        public readonly int SampleMonths;

        public HistoryAverage(double value, int sampleMonths)
        {
            Value = value;
            SampleMonths = sampleMonths;
        }
    }

    private sealed class BuildingCountSnapshot
    {
        public int Built;
        public int Running;

        public void Add(bool isRunning, int count)
        {
            Built += count;
            if (isRunning)
            {
                Running += count;
            }
        }
    }

    private sealed class ChickenFarmSnapshot
    {
        public readonly bool Slaughtering;
        public int Built;
        public int Running;
        public int Chickens;
        public int RunningChickens;

        public ChickenFarmSnapshot(bool slaughtering)
        {
            Slaughtering = slaughtering;
        }

        public void Add(bool isRunning, int chickens)
        {
            Built++;
            Chickens += chickens;
            if (isRunning)
            {
                Running++;
                RunningChickens += chickens;
            }
        }
    }

    private sealed class ChickenFarmEntitySnapshot
    {
        public readonly int EntityId;
        public readonly bool Running;
        public readonly bool Slaughtering;
        public readonly int Chickens;
        public readonly List<LogisticsZoneSnapshot> Zones;

        public ChickenFarmEntitySnapshot(
            int entityId,
            bool running,
            bool slaughtering,
            int chickens,
            List<LogisticsZoneSnapshot> zones)
        {
            EntityId = entityId;
            Running = running;
            Slaughtering = slaughtering;
            Chickens = chickens;
            Zones = zones;
        }
    }

    private sealed class CropFarmSnapshot
    {
        public readonly string PrototypeId;
        public readonly string[] Schedule;
        public readonly int FertilityTargetPercent;
        public readonly string FertilizerProductId;
        public readonly string Key;
        public int Built;
        public int Running;

        public CropFarmSnapshot(
            string prototypeId,
            string[] schedule,
            int fertilityTargetPercent,
            string fertilizerProductId)
        {
            PrototypeId = prototypeId;
            Schedule = schedule;
            FertilityTargetPercent = fertilityTargetPercent;
            FertilizerProductId = fertilizerProductId;
            Key = prototypeId + "|" + String.Join("|", schedule) + "|"
                + fertilityTargetPercent.ToString(CultureInfo.InvariantCulture) + "|"
                + (fertilizerProductId ?? "null");
        }

        public void Add(bool isRunning)
        {
            Built++;
            if (isRunning)
            {
                Running++;
            }
        }
    }

    private sealed class CropFarmEntitySnapshot
    {
        public readonly int EntityId;
        public readonly string PrototypeId;
        public readonly bool Running;
        public readonly string[] Schedule;
        public readonly int FertilityTargetPercent;
        public readonly string FertilizerProductId;
        public readonly List<LogisticsZoneSnapshot> Zones;

        public CropFarmEntitySnapshot(
            int entityId,
            string prototypeId,
            bool running,
            string[] schedule,
            int fertilityTargetPercent,
            string fertilizerProductId,
            List<LogisticsZoneSnapshot> zones)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            Running = running;
            Schedule = schedule;
            FertilityTargetPercent = fertilityTargetPercent;
            FertilizerProductId = fertilizerProductId;
            Zones = zones;
        }
    }

    private sealed class ProductionSnapshot
    {
        public readonly BuildingCountSnapshot DataCenters;
        public readonly BuildingCountSnapshot Racks;
        public readonly BuildingCountSnapshot WaterChillers;
        public readonly List<LogisticsZoneSnapshot> LogisticsZones;
        public readonly List<ChickenFarmSnapshot> ChickenFarms;
        public readonly List<ChickenFarmEntitySnapshot> ChickenFarmEntities;
        public readonly List<CropFarmSnapshot> CropFarms;
        public readonly List<CropFarmEntitySnapshot> CropFarmEntities;
        public readonly List<MachineInventorySnapshot> Machines;
        public readonly List<ProductionEntitySnapshot> ProductionEntities;
        public readonly List<AreaEntitySnapshot> AreaEntities;
        public readonly List<MineTowerSnapshot> MineTowers;

        public ProductionSnapshot(
            BuildingCountSnapshot dataCenters,
            BuildingCountSnapshot racks,
            BuildingCountSnapshot waterChillers,
            List<LogisticsZoneSnapshot> logisticsZones,
            List<ChickenFarmSnapshot> chickenFarms,
            List<ChickenFarmEntitySnapshot> chickenFarmEntities,
            List<CropFarmSnapshot> cropFarms,
            List<CropFarmEntitySnapshot> cropFarmEntities,
            List<MachineInventorySnapshot> machines,
            List<ProductionEntitySnapshot> productionEntities,
            List<AreaEntitySnapshot> areaEntities,
            List<MineTowerSnapshot> mineTowers)
        {
            DataCenters = dataCenters;
            Racks = racks;
            WaterChillers = waterChillers;
            LogisticsZones = logisticsZones;
            ChickenFarms = chickenFarms;
            ChickenFarmEntities = chickenFarmEntities;
            CropFarms = cropFarms;
            CropFarmEntities = cropFarmEntities;
            Machines = machines;
            ProductionEntities = productionEntities;
            AreaEntities = areaEntities;
            MineTowers = mineTowers;
        }
    }

    private sealed class MineTowerSnapshot
    {
        public readonly int EntityId;
        public readonly List<int> AssignedOreSorterEntityIds;

        public MineTowerSnapshot(int entityId, List<int> assignedOreSorterEntityIds)
        {
            EntityId = entityId;
            AssignedOreSorterEntityIds = assignedOreSorterEntityIds;
        }
    }

    private sealed class MachineInventorySnapshot
    {
        public readonly int EntityId;
        public readonly string PrototypeId;
        public readonly bool Running;
        public readonly string CustomTitle;
        public readonly int TileX;
        public readonly int TileY;
        public readonly List<LogisticsZoneSnapshot> Zones;
        public readonly GroundwaterAquiferSnapshot Aquifer;

        public MachineInventorySnapshot(
            int entityId,
            string prototypeId,
            bool running,
            string customTitle,
            int tileX,
            int tileY,
            List<LogisticsZoneSnapshot> zones,
            GroundwaterAquiferSnapshot aquifer)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            Running = running;
            CustomTitle = customTitle;
            TileX = tileX;
            TileY = tileY;
            Zones = zones;
            Aquifer = aquifer;
        }
    }

    private sealed class GroundwaterAquiferSnapshot
    {
        public readonly string Id;
        public readonly int PositionX;
        public readonly int PositionY;
        public readonly int Quantity;
        public readonly int Capacity;
        public readonly int ConfiguredCapacity;

        public GroundwaterAquiferSnapshot(
            string id,
            int positionX,
            int positionY,
            int quantity,
            int capacity,
            int configuredCapacity)
        {
            Id = id;
            PositionX = positionX;
            PositionY = positionY;
            Quantity = quantity;
            Capacity = capacity;
            ConfiguredCapacity = configuredCapacity;
        }
    }

    private sealed class ProductionEntitySnapshot
    {
        public readonly int EntityId;
        public readonly string PrototypeId;
        public readonly bool Running;
        public readonly List<string> RecipeIds;
        public readonly List<LogisticsZoneSnapshot> Zones;
        public readonly NuclearReactorConfigurationSnapshot NuclearReactor;
        public readonly int? DataCenterRacks;
        public readonly TrainStationConfigurationSnapshot TrainStation;

        public ProductionEntitySnapshot(
            int entityId,
            string prototypeId,
            bool running,
            List<string> recipeIds,
            List<LogisticsZoneSnapshot> zones,
            NuclearReactorConfigurationSnapshot nuclearReactor,
            int? dataCenterRacks,
            TrainStationConfigurationSnapshot trainStation)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            Running = running;
            RecipeIds = recipeIds;
            Zones = zones;
            NuclearReactor = nuclearReactor;
            DataCenterRacks = dataCenterRacks;
            TrainStation = trainStation;
        }
    }

    private sealed class AreaEntitySnapshot
    {
        public readonly int EntityId;
        public readonly string PrototypeId;
        public readonly string PrototypeName;
        public readonly string ConstructionState;
        public readonly bool Constructed;
        public readonly bool Running;
        public readonly int TileX;
        public readonly int TileY;
        public readonly List<LogisticsZoneSnapshot> Zones;
        public readonly List<AreaRecipeSnapshot> Recipes;
        public readonly int AvailableRecipeCount;
        public readonly OreSorterConfigurationSnapshot OreSorter;
        public readonly TrainStationConfigurationSnapshot TrainStation;
        public readonly ForestryConfigurationSnapshot Forestry;
        public readonly OfficeConfigurationSnapshot Office;

        public AreaEntitySnapshot(
            int entityId,
            string prototypeId,
            string prototypeName,
            string constructionState,
            bool constructed,
            bool running,
            int tileX,
            int tileY,
            List<LogisticsZoneSnapshot> zones,
            List<AreaRecipeSnapshot> recipes,
            int availableRecipeCount,
            OreSorterConfigurationSnapshot oreSorter,
            TrainStationConfigurationSnapshot trainStation,
            ForestryConfigurationSnapshot forestry,
            OfficeConfigurationSnapshot office)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            PrototypeName = prototypeName;
            ConstructionState = constructionState;
            Constructed = constructed;
            Running = running;
            TileX = tileX;
            TileY = tileY;
            Zones = zones;
            Recipes = recipes;
            AvailableRecipeCount = availableRecipeCount;
            OreSorter = oreSorter;
            TrainStation = trainStation;
            Forestry = forestry;
            Office = office;
        }
    }

    private sealed class OfficeConfigurationSnapshot
    {
        public readonly int ComputingBoostStep;

        public OfficeConfigurationSnapshot(int computingBoostStep)
        {
            ComputingBoostStep = computingBoostStep;
        }
    }

    private sealed class ForestryConfigurationSnapshot
    {
        public readonly int TreeCount;
        public readonly bool CuttingEnabled;
        public readonly int TargetHarvestPercent;
        public readonly double HarvestsPerCycle;
        public readonly double? HarvestDurationMonths;
        public readonly List<ForestryProductSnapshot> Outputs;

        public ForestryConfigurationSnapshot(
            int treeCount,
            bool cuttingEnabled,
            int targetHarvestPercent,
            double harvestsPerCycle,
            double? harvestDurationMonths,
            List<ForestryProductSnapshot> outputs)
        {
            TreeCount = treeCount;
            CuttingEnabled = cuttingEnabled;
            TargetHarvestPercent = targetHarvestPercent;
            HarvestsPerCycle = harvestsPerCycle;
            HarvestDurationMonths = harvestDurationMonths;
            Outputs = outputs;
        }
    }

    private sealed class ForestryProductSnapshot
    {
        public readonly string ProductId;
        public readonly string Name;
        public readonly double QuantityPerCycle;

        public ForestryProductSnapshot(
            string productId,
            string name,
            double quantityPerCycle)
        {
            ProductId = productId;
            Name = name;
            QuantityPerCycle = quantityPerCycle;
        }
    }

    private sealed class ForestryProductAccumulator
    {
        public readonly string ProductId;
        public readonly string Name;
        public double QuantityPerTreePerCycleWeighted;

        public ForestryProductAccumulator(string productId, string name)
        {
            ProductId = productId;
            Name = name;
        }
    }

    private sealed class OreSorterConfigurationSnapshot
    {
        public readonly double ThroughputPerCycle;
        public readonly int ConversionLossPercent;
        public readonly List<OreSorterProductSnapshot> Products;

        public OreSorterConfigurationSnapshot(
            double throughputPerCycle,
            int conversionLossPercent,
            List<OreSorterProductSnapshot> products)
        {
            ThroughputPerCycle = throughputPerCycle;
            ConversionLossPercent = conversionLossPercent;
            Products = products;
        }
    }

    private sealed class OreSorterProductSnapshot
    {
        public readonly string ProductId;
        public readonly string Name;
        public readonly bool CanBeWasted;

        public OreSorterProductSnapshot(
            string productId,
            string name,
            bool canBeWasted)
        {
            ProductId = productId;
            Name = name;
            CanBeWasted = canBeWasted;
        }
    }

    private sealed class TrainStationConfigurationSnapshot
    {
        public readonly bool IsForLoading;
        public readonly TrainStationProductSnapshot SelectedProduct;

        public TrainStationConfigurationSnapshot(
            bool isForLoading,
            TrainStationProductSnapshot selectedProduct)
        {
            IsForLoading = isForLoading;
            SelectedProduct = selectedProduct;
        }
    }

    private sealed class TrainStationProductSnapshot
    {
        public readonly string ProductId;
        public readonly string Name;

        public TrainStationProductSnapshot(string productId, string name)
        {
            ProductId = productId;
            Name = name;
        }
    }

    private sealed class AreaRecipeSnapshot
    {
        public readonly string Id;
        public readonly string Name;
        public readonly double DurationSeconds;
        public readonly bool Assigned;
        public readonly List<AreaRecipeProductSnapshot> Inputs;
        public readonly List<AreaRecipeProductSnapshot> Outputs;

        public AreaRecipeSnapshot(
            string id,
            string name,
            double durationSeconds,
            bool assigned,
            List<AreaRecipeProductSnapshot> inputs,
            List<AreaRecipeProductSnapshot> outputs)
        {
            Id = id;
            Name = name;
            DurationSeconds = durationSeconds;
            Assigned = assigned;
            Inputs = inputs;
            Outputs = outputs;
        }
    }

    private sealed class AreaRecipeProductSnapshot
    {
        public readonly string ProductId;
        public readonly string Name;
        public readonly int Quantity;

        public AreaRecipeProductSnapshot(string productId, string name, int quantity)
        {
            ProductId = productId;
            Name = name;
            Quantity = quantity;
        }
    }

    private sealed class NuclearReactorConfigurationSnapshot
    {
        public readonly int EnrichmentStep;
        public readonly int TargetPowerPercent;

        public NuclearReactorConfigurationSnapshot(
            int enrichmentStep,
            int targetPowerPercent)
        {
            EnrichmentStep = enrichmentStep;
            TargetPowerPercent = targetPowerPercent;
        }
    }

    private sealed class LogisticsZoneSnapshot
    {
        public readonly int Id;
        public readonly string Name;

        public LogisticsZoneSnapshot(int id, string name)
        {
            Id = id;
            Name = name;
        }
    }

    private sealed class TrackedReserveDefinition
    {
        public readonly string Key;
        public readonly string ProductId;

        public TrackedReserveDefinition(string key, string productId)
        {
            Key = key;
            ProductId = productId;
        }
    }

    private sealed class TrackedResearchDefinition
    {
        public readonly string Key;
        public readonly string PrototypeId;

        public TrackedResearchDefinition(string key, string prototypeId)
        {
            Key = key;
            PrototypeId = prototypeId;
        }
    }

    private sealed class TrackedEdictDefinition
    {
        public readonly string Key;
        public readonly string[] TierPrototypeIds;

        public TrackedEdictDefinition(string key, params string[] tierPrototypeIds)
        {
            Key = key;
            TierPrototypeIds = tierPrototypeIds;
        }
    }

    private sealed class TrackedEdictTier
    {
        public readonly int EdictIndex;
        public readonly int Level;

        public TrackedEdictTier(int edictIndex, int level)
        {
            EdictIndex = edictIndex;
            Level = level;
        }
    }

    private sealed class EdictState
    {
        public int EnabledLevel;
        public int ActiveLevel;
        public string InactiveReason;
    }

    private sealed class TrackedEntityState
    {
        public readonly int Index;
        public readonly bool IsRunning;

        public TrackedEntityState(int index, bool isRunning)
        {
            Index = index;
            IsRunning = isRunning;
        }
    }

    private sealed class FuelHistory
    {
        public static readonly FuelHistory Empty = new FuelHistory(
            HistoryAverage.Empty,
            HistoryAverage.Empty,
            HistoryAverage.Empty,
            HistoryAverage.Empty,
            HistoryAverage.Empty,
            HistoryAverage.Empty);

        public readonly HistoryAverage Total;
        public readonly HistoryAverage Vehicles;
        public readonly HistoryAverage CargoShips;
        public readonly HistoryAverage BattleShip;
        public readonly HistoryAverage PowerGenerators;
        public readonly HistoryAverage Trains;

        public FuelHistory(
            HistoryAverage total,
            HistoryAverage vehicles,
            HistoryAverage cargoShips,
            HistoryAverage battleShip,
            HistoryAverage powerGenerators,
            HistoryAverage trains)
        {
            Total = total;
            Vehicles = vehicles;
            CargoShips = cargoShips;
            BattleShip = battleShip;
            PowerGenerators = powerGenerators;
            Trains = trains;
        }
    }

    private sealed class GenerationHistory
    {
        public readonly string PrototypeId;
        public readonly string Name;
        public readonly HistoryAverage Average;

        public GenerationHistory(
            string prototypeId,
            string name,
            HistoryAverage average)
        {
            PrototypeId = prototypeId;
            Name = name;
            Average = average;
        }
    }

}
