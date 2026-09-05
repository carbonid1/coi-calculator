using System.Collections.Generic;

using Mafi;
using Mafi.Core;
using Mafi.Core.Entities;
using Mafi.Core.Factory;
using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Game;
using Mafi.Core.Maintenance;
using Mafi.Core.Population;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Products;
using Mafi.Core.PropertiesDb;
using Mafi.Core.Research;
using Mafi.Core.SpaceProgram;
using Mafi.Core.Stats;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Trees;
using Mafi.Core.Vehicles;
using Mafi.Core.World.Contracts;

internal sealed partial class GameSnapshotCollector
{
    private readonly IVehiclesManager m_vehiclesManager;
    private readonly ILogisticsZonesManager m_logisticsZonesManager;
    private readonly GameNameConfig m_gameNameConfig;
    private readonly IEntitiesManager m_entitiesManager;
    private readonly IProductsManager m_productsManager;
    private readonly IPropertiesDb m_propertiesDb;
    private readonly IVirtualResourceManager m_virtualResourceManager;
    private readonly ITreesManager m_treesManager;
    private readonly ElectricityManager m_electricityManager;
    private readonly FuelStatsCollector m_fuelStatsCollector;
    private readonly MaintenanceManager m_maintenanceManager;
    private readonly ResearchManager m_researchManager;
    private readonly EdictsManager m_edictsManager;
    private readonly OrbitManager m_orbitManager;
    private readonly ContractsManager m_contractsManager;

    private HistoryAverage m_maintenanceI = HistoryAverage.Empty;
    private HistoryAverage m_maintenanceII = HistoryAverage.Empty;
    private HistoryAverage m_maintenanceIII = HistoryAverage.Empty;
    private FuelHistory m_hydrogenFuel = FuelHistory.Empty;
    private List<GenerationHistory> m_generationByType = new List<GenerationHistory>();

    private GameSnapshotCollector(DependencyResolver resolver)
    {
        m_vehiclesManager = resolver.Resolve<IVehiclesManager>();
        m_logisticsZonesManager = resolver.Resolve<ILogisticsZonesManager>();
        m_gameNameConfig = resolver.Resolve<GameNameConfig>();
        m_entitiesManager = resolver.Resolve<IEntitiesManager>();
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
        m_settlementsManager = resolver.Resolve<Mafi.Core.Buildings.Settlements.SettlementsManager>();
        m_upointsManager = resolver.Resolve<UpointsManager>();
        m_weatherConfig = getWeatherConfig(resolver);
    }

    public static GameSnapshotCollector Create(DependencyResolver resolver)
    {
        return new GameSnapshotCollector(resolver);
    }
}
