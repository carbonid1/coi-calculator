using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Buildings.Mine;
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
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Maintenance;
using Mafi.Core.Map;
using Mafi.Core.Mods;
using Mafi.Core.Population;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Prototypes;
using Mafi.Core.PropertiesDb;
using Mafi.Core.Products;
using Mafi.Core.Research;
using Mafi.Core.Simulation;
using Mafi.Core.SpaceProgram;
using Mafi.Core.Stats;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Generation;
using Mafi.Core.Trains;
using Mafi.Core.Vehicles;

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
    private IPropertiesDb m_propertiesDb;
    private IVirtualResourceManager m_virtualResourceManager;
    private ElectricityManager m_electricityManager;
    private FuelStatsCollector m_fuelStatsCollector;
    private MaintenanceManager m_maintenanceManager;
    private TrainsManager m_trainsManager;
    private ResearchManager m_researchManager;
    private EdictsManager m_edictsManager;
    private OrbitManager m_orbitManager;
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
    public int Version { get { return 23; } }
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
        m_propertiesDb = resolver.Resolve<IPropertiesDb>();
        m_virtualResourceManager = resolver.Resolve<IVirtualResourceManager>();
        m_electricityManager = resolver.Resolve<ElectricityManager>();
        m_fuelStatsCollector = resolver.Resolve<FuelStatsCollector>();
        m_maintenanceManager = resolver.Resolve<MaintenanceManager>();
        m_trainsManager = resolver.Resolve<TrainsManager>();
        m_researchManager = resolver.Resolve<ResearchManager>();
        m_edictsManager = resolver.Resolve<EdictsManager>();
        m_orbitManager = resolver.Resolve<OrbitManager>();
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
        m_electricityManager = null;
        m_fuelStatsCollector = null;
        m_maintenanceManager = null;
        m_trainsManager = null;
        m_researchManager = null;
        m_edictsManager = null;
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
            || m_trainsManager == null
            || m_researchManager == null
            || m_edictsManager == null)
        {
            return;
        }

        try
        {
            int quotaLimit = m_vehiclesManager.MaxVehiclesLimit;
            int quotaRemaining = m_vehiclesManager.VehiclesLimitLeft;
            int quotaUsed = Math.Max(0, quotaLimit - quotaRemaining);
            int workersAssigned = 0;
            TrainTrafficSnapshot trainTraffic = getTrainTrafficSnapshot();
            int[] researchLevels = getResearchLevels();
            EdictState[] edictStates = getEdictStates();
            int[] reserves = getReserveQuantities();
            ProductionSnapshot production = getProductionSnapshot();

            foreach (var vehicle in m_vehiclesManager.AllVehicles)
            {
                workersAssigned += EntityWithWorkersExtensions.WorkersAssigned(vehicle);
            }

            StringBuilder json = new StringBuilder(3600);
            json.Append('{');
            json.Append("\"schemaVersion\":31,");
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
            appendNumber(json, "highestLevelAchieved", m_orbitManager.HighestStationTierAchieved, true);
            json.Append("\"constructionPending\":");
            json.Append(m_orbitManager.IsStationConstructionPending ? "true" : "false");
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
                json.Append("],\"oreSorter\":");
                appendOreSorterConfiguration(json, entity.OreSorter);
                json.Append(",\"trainStation\":");
                appendTrainStationConfiguration(json, entity.TrainStation);
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
            appendNumber(json, "total", m_vehiclesManager.AllVehicles.Count, true);
            appendNumber(json, "workersAssigned", workersAssigned, true);
            appendNumber(json, "trucks", m_vehiclesManager.Trucks.Count, true);
            appendNumber(json, "excavators", m_vehiclesManager.Excavators.Count, true);
            appendNumber(json, "treeHarvesters", m_vehiclesManager.TreeHarvesters.Count, true);
            appendNumber(json, "treePlanters", m_vehiclesManager.TreePlanters.Count, true);
            appendNumber(json, "quotaUsed", quotaUsed, true);
            appendNumber(json, "quotaLimit", quotaLimit, true);
            appendNumber(json, "quotaRemaining", quotaRemaining, false);
            json.Append("},");
            json.Append("\"trainTraffic\":{");
            appendNumber(json, "totalTrains", trainTraffic.TotalTrains, true);
            appendNumber(json, "activeTrains", trainTraffic.ActiveTrains, true);
            appendNumber(json, "waitingForTrack", trainTraffic.WaitingForTrack, true);
            appendNumber(json, "stuckTrains", trainTraffic.StuckTrains, true);
            appendNumber(json, "criticalThreshold", trainTraffic.CriticalThreshold, true);
            appendString(json, "severity", trainTraffic.Severity, true);
            appendNumber(json, "sustainedWaitCycles", 1, true);
            json.Append("\"trains\":[");
            for (int i = 0; i < trainTraffic.Trains.Count; i++)
            {
                TrainDelay train = trainTraffic.Trains[i];
                json.Append('{');
                appendNumber(json, "id", train.Id, true);
                appendString(json, "name", train.Name, true);
                appendString(json, "state", train.State, true);
                appendDecimal(json, "blockedForCycles", train.BlockedForCycles, true);
                appendNullableNumber(json, "blockingTrainId", train.BlockingTrainId, false);
                json.Append('}');
                if (i < trainTraffic.Trains.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]},");
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
            if (staticEntity != null && isNamedAreaBuilding(entity, entityZones))
            {
                string prototypeName = staticEntity.Prototype.Strings.Name.TranslatedString;
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
                    getAreaRecipes(entity, staticEntity),
                    getOreSorterConfiguration(entity),
                    getTrainStationConfiguration(entity)));
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
                || isNamedAreaBuilding(entity, entityZones))
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
            cropFarmEntities.Add(new CropFarmEntitySnapshot(
                entity.Id.Value,
                prototypeId,
                isRunning,
                schedule,
                fertilityTargetPercent,
                entityZones));
            key.Append('|');
            key.Append(fertilityTargetPercent.ToString(CultureInfo.InvariantCulture));

            CropFarmSnapshot cropFarmSnapshot;
            if (!cropFarmConfigurations.TryGetValue(key.ToString(), out cropFarmSnapshot))
            {
                cropFarmSnapshot = new CropFarmSnapshot(
                    prototypeId,
                    schedule,
                    fertilityTargetPercent);
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
                sorter.ProductsData[product].CanBeWasted,
                sorter.GetSortedLastMonth(product).Value));
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
        IStaticEntity staticEntity)
    {
        List<AreaRecipeSnapshot> recipes = new List<AreaRecipeSnapshot>();
        MachineProto machine = staticEntity.Prototype as MachineProto;
        if (machine == null)
        {
            return recipes;
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
                recipe.Id.ToString(),
                String.IsNullOrWhiteSpace(recipeName) ? recipe.Id.ToString() : recipeName,
                Math.Max(0.001, recipeForUi.Duration.Seconds.ToDouble()),
                assignedRecipeIds.Contains(recipe.Id.ToString())
                    || (recipeEntity == null && machine.UseAllRecipesAtStartOrAfterUnlock),
                inputs,
                outputs));
        }

        recipes.Sort(delegate(AreaRecipeSnapshot left, AreaRecipeSnapshot right)
        {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        return recipes;
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

    private static bool containsNamedZone(List<LogisticsZoneSnapshot> zones)
    {
        for (int i = 0; i < zones.Count; i++)
        {
            if (!String.IsNullOrWhiteSpace(zones[i].Name))
            {
                return true;
            }
        }

        return false;
    }

    private static bool isNamedAreaBuilding(
        IEntity entity,
        List<LogisticsZoneSnapshot> zones)
    {
        if (!containsNamedZone(zones))
        {
            return false;
        }

        string entityNamespace = entity.GetType().Namespace;
        IStaticEntity staticEntity = entity as IStaticEntity;
        return (staticEntity != null && staticEntity.Prototype is MachineProto)
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

    private TrainTrafficSnapshot getTrainTrafficSnapshot()
    {
        int totalTrains = 0;
        int activeTrains = 0;
        int waitingForTrack = 0;
        int stuckTrains = 0;
        List<TrainDelay> delayedTrains = new List<TrainDelay>();

        foreach (Train train in m_trainsManager.Trains)
        {
            if (train.IsDestroyed || train.IsDespawning)
            {
                continue;
            }

            totalTrains++;
            if (!train.IsSpawned || train.IsPaused)
            {
                continue;
            }

            activeTrains++;
            if (!isWaitingForTrack(train.StateForUi))
            {
                continue;
            }

            waitingForTrack++;
            int blockedTicks = train.ReservationWaitTime.Ticks;
            if (blockedTicks < Duration.OneMonth.Ticks)
            {
                continue;
            }

            stuckTrains++;
            int? blockingTrainId = train.LastBlockingTrainIdOrNone.HasValue
                ? (int?)train.LastBlockingTrainIdOrNone.Value.Value
                : null;
            delayedTrains.Add(new TrainDelay(
                train.TrainId.Value,
                String.IsNullOrWhiteSpace(train.Name)
                    ? "Train #" + train.TrainId.Value.ToString(CultureInfo.InvariantCulture)
                    : train.Name,
                train.StateForUi.ToString(),
                (double)blockedTicks / Duration.OneMonth.Ticks,
                blockingTrainId));
        }

        delayedTrains.Sort(delegate(TrainDelay left, TrainDelay right)
        {
            int durationComparison = right.BlockedForCycles.CompareTo(left.BlockedForCycles);
            return durationComparison != 0 ? durationComparison : left.Id.CompareTo(right.Id);
        });
        if (delayedTrains.Count > 8)
        {
            delayedTrains.RemoveRange(8, delayedTrains.Count - 8);
        }

        int criticalThreshold = Math.Max(3, (int)Math.Ceiling(activeTrains * 0.1));
        string severity = stuckTrains >= criticalThreshold
            ? "critical"
            : stuckTrains > 0 ? "warning" : "clear";

        return new TrainTrafficSnapshot(
            totalTrains,
            activeTrains,
            waitingForTrack,
            stuckTrains,
            criticalThreshold,
            severity,
            delayedTrains);
    }

    private static bool isWaitingForTrack(TrainStateForUi state)
    {
        return state == TrainStateForUi.WaitingForFreeTrack
            || state == TrainStateForUi.WaitingForSuperBlock
            || state == TrainStateForUi.WaitingForBidirectionalSuperBlock;
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
            json.Append(',');
            appendNumber(json, "sortedLastCycle", product.SortedLastCycle, false);
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
        public readonly string Key;
        public int Built;
        public int Running;

        public CropFarmSnapshot(
            string prototypeId,
            string[] schedule,
            int fertilityTargetPercent)
        {
            PrototypeId = prototypeId;
            Schedule = schedule;
            FertilityTargetPercent = fertilityTargetPercent;
            Key = prototypeId + "|" + String.Join("|", schedule) + "|"
                + fertilityTargetPercent.ToString(CultureInfo.InvariantCulture);
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
        public readonly List<LogisticsZoneSnapshot> Zones;

        public CropFarmEntitySnapshot(
            int entityId,
            string prototypeId,
            bool running,
            string[] schedule,
            int fertilityTargetPercent,
            List<LogisticsZoneSnapshot> zones)
        {
            EntityId = entityId;
            PrototypeId = prototypeId;
            Running = running;
            Schedule = schedule;
            FertilityTargetPercent = fertilityTargetPercent;
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
        public readonly OreSorterConfigurationSnapshot OreSorter;
        public readonly TrainStationConfigurationSnapshot TrainStation;

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
            OreSorterConfigurationSnapshot oreSorter,
            TrainStationConfigurationSnapshot trainStation)
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
            OreSorter = oreSorter;
            TrainStation = trainStation;
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
        public readonly int SortedLastCycle;

        public OreSorterProductSnapshot(
            string productId,
            string name,
            bool canBeWasted,
            int sortedLastCycle)
        {
            ProductId = productId;
            Name = name;
            CanBeWasted = canBeWasted;
            SortedLastCycle = sortedLastCycle;
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

    private sealed class TrainTrafficSnapshot
    {
        public readonly int TotalTrains;
        public readonly int ActiveTrains;
        public readonly int WaitingForTrack;
        public readonly int StuckTrains;
        public readonly int CriticalThreshold;
        public readonly string Severity;
        public readonly List<TrainDelay> Trains;

        public TrainTrafficSnapshot(
            int totalTrains,
            int activeTrains,
            int waitingForTrack,
            int stuckTrains,
            int criticalThreshold,
            string severity,
            List<TrainDelay> trains)
        {
            TotalTrains = totalTrains;
            ActiveTrains = activeTrains;
            WaitingForTrack = waitingForTrack;
            StuckTrains = stuckTrains;
            CriticalThreshold = criticalThreshold;
            Severity = severity;
            Trains = trains;
        }
    }

    private sealed class TrainDelay
    {
        public readonly int Id;
        public readonly string Name;
        public readonly string State;
        public readonly double BlockedForCycles;
        public readonly int? BlockingTrainId;

        public TrainDelay(
            int id,
            string name,
            string state,
            double blockedForCycles,
            int? blockingTrainId)
        {
            Id = id;
            Name = name;
            State = state;
            BlockedForCycles = blockedForCycles;
            BlockingTrainId = blockingTrainId;
        }
    }
}
