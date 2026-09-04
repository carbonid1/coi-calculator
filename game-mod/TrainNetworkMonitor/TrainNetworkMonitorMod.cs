using System;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Input;
using Mafi.Core.Mods;
using Mafi.Core.Notifications;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;
using Mafi.Core.Trains;

public sealed class TrainNetworkMonitorMod : IMod, IDisposable
{
    private NotificationProto m_fleetJamNotificationProto;
    private NotificationProto m_groupedFleetJamNotificationProto;
    private IGameLoopEvents m_gameLoopEvents;
    private ISimLoopEvents m_simLoopEvents;
    private TrainJamMonitor m_trainJamMonitor;
    private TrainNetworkMonitorUi m_ui;

    public string Name { get { return "Train Network Monitor"; } }
    public int Version { get { return 1; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public TrainNetworkMonitorMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
    }

    public void RegisterPrototypes(ProtoRegistrator registrator)
    {
        m_fleetJamNotificationProto = new NotificationProtoBuilder(registrator)
            .Start(
                "Train traffic jam",
                TrainJamMonitor.FleetJamNotificationId,
                "Critical alert shown when many active trains remain blocked by rail traffic.")
            .SetType(NotificationType.Continuous)
            .SetStyle(NotificationStyle.Critical)
            .HideInInspector()
            .BuildAndAdd(true);
        m_groupedFleetJamNotificationProto = new NotificationProtoBuilder(registrator)
            .Start(
                "Train traffic jam",
                TrainJamMonitor.GroupedFleetJamNotificationId,
                "Grouped critical alert for trains blocked by rail traffic.")
            .SetType(NotificationType.Continuous)
            .SetStyle(NotificationStyle.Critical)
            .HideInInspector()
            .MuteAudio()
            .BuildAndAdd(true);
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
        IInputScheduler inputScheduler = resolver.Resolve<IInputScheduler>();
        TrainsManager trainsManager = resolver.Resolve<TrainsManager>();
        TrainNetworksManager trainNetworksManager = resolver.Resolve<TrainNetworksManager>();
        INotificationsManager notificationsManager = resolver.Resolve<INotificationsManager>();
        notificationsManager.ClearAllNotificationsWithId(TrainJamMonitor.FleetJamNotificationId);
        notificationsManager.ClearAllNotificationsWithId(
            TrainJamMonitor.GroupedFleetJamNotificationId);

        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        m_trainJamMonitor = new TrainJamMonitor(
            m_fleetJamNotificationProto,
            m_groupedFleetJamNotificationProto,
            inputScheduler,
            trainsManager,
            notificationsManager,
            m_simLoopEvents,
            JsonConfig);
        m_ui = new TrainNetworkMonitorUi(
            trainNetworksManager,
            m_simLoopEvents,
            JsonConfig);

        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);
        m_gameLoopEvents = resolver.Resolve<IGameLoopEvents>();
        m_gameLoopEvents.RegisterRendererInitState(this, () => initializeUi(resolver));

        m_trainJamMonitor.Update();
        Log.Info("Train Network Monitor: fleet traffic alerts enabled.");
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
        if (m_ui != null)
        {
            m_ui.Dispose();
            m_ui = null;
        }

        if (m_simLoopEvents != null)
        {
            try
            {
                m_simLoopEvents.UpdateAfterCmdProc.RemoveNonSaveable(this, onSimUpdate);
            }
            catch
            {
            }

            m_simLoopEvents = null;
        }

        if (m_trainJamMonitor != null)
        {
            m_trainJamMonitor.Dispose();
            m_trainJamMonitor = null;
        }

        m_gameLoopEvents = null;
    }

    private void onSimUpdate()
    {
        if (m_trainJamMonitor != null)
        {
            m_trainJamMonitor.Update();
        }
    }

    private void initializeUi(DependencyResolver resolver)
    {
        if (m_ui != null)
        {
            m_ui.Initialize(resolver);
        }
    }
}
