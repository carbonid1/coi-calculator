using System;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Mods;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;
using Mafi.Core.WebApi;

public sealed class CoiCalculatorExporterMod : IMod, IDisposable
{
    internal const string SnapshotRoute = "/api/mods/CoiCalculatorExporter/snapshot";

    private GameSnapshotCollector m_snapshotCollector;
    private ICalendar m_calendar;
    private WebApiServer m_server;
    private bool m_routeRegistered;

    public string Name { get { return "CoI Calculator Bridge"; } }
    public int Version { get { return 48; } }
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
}
