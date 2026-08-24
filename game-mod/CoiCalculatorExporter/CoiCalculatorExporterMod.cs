using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Maintenance;
using Mafi.Core.Mods;
using Mafi.Core.Population;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Prototypes;
using Mafi.Core.Research;
using Mafi.Core.Simulation;
using Mafi.Core.Stats;
using Mafi.Core.Trains;
using Mafi.Core.Vehicles;

public sealed class CoiCalculatorExporterMod : IMod, IDisposable
{
    private static readonly TimeSpan ExportInterval = TimeSpan.FromSeconds(5);
    private const int HistoryWindowMonths = 120;
    private const string GoldProductId = "Product_Gold";
    private const string HydrogenProductId = "Product_Hydrogen";
    private const string MaintenanceT1ProductId = "Product_Virtual_MaintenanceT1";
    private const string MaintenanceT2ProductId = "Product_Virtual_MaintenanceT2";
    private const string MaintenanceT3ProductId = "Product_Virtual_MaintenanceT3";
    private static readonly string[] TrackedBuildingKeys = new[]
    {
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
        "solarPanel",
        "solarPanelMono",
        "maintenanceStatue",
    };
    private static readonly string[] TrackedPrototypeIds = new[]
    {
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
        "SolarPanel",
        "SolarPanelMono",
        "StatueOfMaintenanceGolden",
    };
    private static readonly Dictionary<string, int> TrackedPrototypeIndices =
        createTrackedPrototypeIndices();
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
    private IEntitiesManager m_entitiesManager;
    private IConstructionManager m_constructionManager;
    private ElectricityManager m_electricityManager;
    private FuelStatsCollector m_fuelStatsCollector;
    private MaintenanceManager m_maintenanceManager;
    private TrainsManager m_trainsManager;
    private ResearchManager m_researchManager;
    private EdictsManager m_edictsManager;
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
    public int Version { get { return 11; } }
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
        m_entitiesManager = resolver.Resolve<IEntitiesManager>();
        m_constructionManager = resolver.Resolve<IConstructionManager>();
        m_electricityManager = resolver.Resolve<ElectricityManager>();
        m_fuelStatsCollector = resolver.Resolve<FuelStatsCollector>();
        m_maintenanceManager = resolver.Resolve<MaintenanceManager>();
        m_trainsManager = resolver.Resolve<TrainsManager>();
        m_researchManager = resolver.Resolve<ResearchManager>();
        m_edictsManager = resolver.Resolve<EdictsManager>();
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
            || m_entitiesManager == null
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
            int goldReserve = getGoldReserveQuantity();

            foreach (var vehicle in m_vehiclesManager.AllVehicles)
            {
                workersAssigned += EntityWithWorkersExtensions.WorkersAssigned(vehicle);
            }

            StringBuilder json = new StringBuilder(3600);
            json.Append('{');
            json.Append("\"schemaVersion\":12,");
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
            appendNumber(json, "gold", goldReserve, false);
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

    private static Dictionary<string, int> createTrackedResearchIndices()
    {
        Dictionary<string, int> result = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < TrackedResearch.Length; i++)
        {
            result.Add(TrackedResearch[i].PrototypeId, i);
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

    private int getGoldReserveQuantity()
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

        long total = 0;
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            Storage storage = entity as Storage;
            if (storage == null
                || storage.IsDestroyed
                || !storage.IsConstructed
                || stationLinkedStorageIds.Contains(storage.Id)
                || storage.AssignedInputs.Count > 0
                || !storage.StoredProduct.HasValue
                || !String.Equals(
                    storage.StoredProduct.Value.Id.ToString(),
                    GoldProductId,
                    StringComparison.Ordinal))
            {
                continue;
            }

            total += storage.CurrentQuantity.Value;
            if (total >= Int32.MaxValue)
            {
                return Int32.MaxValue;
            }
        }

        return (int)total;
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
