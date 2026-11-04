using System;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Entities;
using Mafi.Core.Mods;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;
using Mafi.Core.Terrain;
using Mafi.Core.Vehicles;
using Mafi.Core.WebApi;
using Mafi.Logging;

public sealed class CoiCalculatorExporterMod : IMod, IDisposable
{
    internal const string SnapshotRoute = "/api/mods/CoiCalculatorExporter/snapshot";
    internal const string MapRoute = "/api/mods/CoiCalculatorExporter/island-map";
    internal const string LayoutRoute = "/api/mods/CoiCalculatorExporter/factory-layout";

    private GameSnapshotCollector m_snapshotCollector;
    private ICalendar m_calendar;
    private WebApiServer m_server;
    private bool m_routeRegistered;
    private bool m_mapRouteRegistered;
    private IslandMapCollector m_mapCollector;
    private FactoryLayoutCollector m_layoutCollector;
    private bool m_layoutRouteRegistered;

    public string Name { get { return "CoI Calculator Bridge"; } }
    public int Version { get { return 60; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public CoiCalculatorExporterMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
    }

    public void RegisterPrototypes(ProtoRegistrator registrator) { }
    public void RegisterDependencies(
        DependencyResolverBuilder dependencyResolverBuilder,
        ProtosDb protosDb,
        bool gameWasLoaded) { }
    public void EarlyInit(DependencyResolver resolver) { }

    public void Initialize(DependencyResolver resolver, bool gameWasLoaded)
    {
        m_snapshotCollector = GameSnapshotCollector.Create(resolver);
        m_mapCollector = new IslandMapCollector(resolver.Resolve<TerrainManager>(), resolver.Resolve<IGameIdProvider>());
        m_layoutCollector = new FactoryLayoutCollector(resolver.Resolve<IEntitiesManager>(),
            resolver.Resolve<ILogisticsZonesManager>(), resolver.Resolve<IGameIdProvider>());
        m_calendar = resolver.Resolve<ICalendar>();
        m_server = resolver.Resolve<WebApiServer>();
        m_snapshotCollector.RefreshHistory();
        m_calendar.NewMonthEnd.AddNonSaveable(this, onNewMonthEnd);

        // The server invokes this handler on the simulation thread, including
        // while paused. Capture only on demand; no file or export timer remains.
        m_routeRegistered = m_server.RegisterRoute(
            SnapshotRoute,
            WebRouteStage.Sim,
            new Func<WebRouteResponse>(getSnapshot),
            "GET",
            "Factory configuration and operating history for CoI Calculator.");

        if (!m_routeRegistered)
        {
            throw new InvalidOperationException("Could not register calculator snapshot route.");
        }
        m_mapRouteRegistered = m_server.RegisterRoute(MapRoute, WebRouteStage.Sim,
            new Func<WebRouteResponse>(getIslandMap), "GET", "Current island coastline, including terrain changes.");
        if (!m_mapRouteRegistered) throw new InvalidOperationException("Could not register island map route.");
        m_layoutRouteRegistered = m_server.RegisterRoute(LayoutRoute, WebRouteStage.Sim,
            new Func<WebRouteResponse>(getFactoryLayout), "GET", "Current factory area polygons and occupied building footprints.");
        if (!m_layoutRouteRegistered) throw new InvalidOperationException("Could not register factory layout route.");

        // Route discovery sees resolved dependencies only. Wait until the game
        // has instantiated its own API handlers before starting the server.
        resolver.Resolve<IGameLoopEvents>().InvokeInSyncNotSaved(startServer);
    }

    private void startServer()
    {
        if (m_server == null) return;

        string error;
        if (!m_server.IsRunning && !m_server.TryStart(WebApiServer.DEFAULT_PORT, out error))
        {
            Log.Error("CoI Calculator Bridge: could not start game web server: " + error);
            return;
        }

        Log.Info("CoI Calculator Bridge: http://127.0.0.1:"
            + m_server.Port + SnapshotRoute);
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues) { }

    public void Dispose()
    {
        if (m_calendar != null)
        {
            m_calendar.NewMonthEnd.RemoveNonSaveable(this, onNewMonthEnd);
            m_calendar = null;
        }
        if (m_server != null && m_routeRegistered)
        {
            m_server.UnregisterRoute(SnapshotRoute);
        }
        m_routeRegistered = false;
        if (m_server != null && m_mapRouteRegistered) m_server.UnregisterRoute(MapRoute);
        m_mapRouteRegistered = false;
        if (m_mapCollector != null) m_mapCollector.Dispose();
        m_mapCollector = null;
        if (m_server != null && m_layoutRouteRegistered) m_server.UnregisterRoute(LayoutRoute);
        m_layoutRouteRegistered = false;
        m_layoutCollector = null;
        m_server = null;
        m_snapshotCollector = null;
    }

    private void onNewMonthEnd()
    {
        if (m_snapshotCollector != null) m_snapshotCollector.RefreshHistory();
    }

    private WebRouteResponse getSnapshot()
    {
        if (m_snapshotCollector == null)
        {
            return WebRouteResponse.Error(503, "Calculator data is not ready.");
        }
        return WebRouteResponse.Json(SnapshotJsonWriter.Serialize(m_snapshotCollector.Capture()))
            .WithHeader("Cache-Control", "no-store");
    }

    private WebRouteResponse getIslandMap()
    {
        string json = m_mapCollector == null ? null : m_mapCollector.CaptureJson();
        return json == null ? WebRouteResponse.Error(503, "Island map is not ready.")
            : WebRouteResponse.Json(json).WithHeader("Cache-Control", "no-store");
    }

    private WebRouteResponse getFactoryLayout()
    {
        return m_layoutCollector == null ? WebRouteResponse.Error(503, "Factory layout is not ready.")
            : WebRouteResponse.Json(m_layoutCollector.CaptureJson()).WithHeader("Cache-Control", "no-store");
    }
}
