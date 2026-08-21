using System;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.Input;
using Mafi.Core.Mods;
using Mafi.Core.Notifications;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;
using Mafi.Core.Trains;

public sealed class CoiTrainTrafficMonitorMod : IMod, IDisposable
{
    private static readonly GeneralNotificationProto.ID FleetJamNotificationId =
        new GeneralNotificationProto.ID("CoiTrainTrafficMonitor_FleetJam");

    private NotificationProto m_fleetJamNotificationProto;
    private Notificator m_fleetJamNotificator;
    private bool m_fleetJamNotificatorInitialized;
    private bool m_pauseHandledForCurrentAlert;
    private IInputScheduler m_inputScheduler;
    private TrainsManager m_trainsManager;
    private ISimLoopEvents m_simLoopEvents;

    public string Name { get { return "Train Traffic Monitor"; } }
    public int Version { get { return 1; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public CoiTrainTrafficMonitorMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
    }

    public void RegisterPrototypes(ProtoRegistrator registrator)
    {
        m_fleetJamNotificationProto = new NotificationProtoBuilder(registrator)
            .Start(
                "Train traffic jam",
                FleetJamNotificationId,
                "Critical alert shown when many active trains remain blocked by rail traffic.")
            .SetType(NotificationType.Continuous)
            .SetStyle(NotificationStyle.Critical)
            .BuildAndAdd();
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
        m_inputScheduler = resolver.Resolve<IInputScheduler>();
        m_trainsManager = resolver.Resolve<TrainsManager>();
        INotificationsManager notificationsManager = resolver.Resolve<INotificationsManager>();
        m_fleetJamNotificator = new Notificator(
            notificationsManager,
            m_fleetJamNotificationProto);
        m_fleetJamNotificatorInitialized = true;
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);

        updateNotification();
        Log.Info("Train Traffic Monitor: fleet traffic alerts enabled.");
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
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

        if (m_fleetJamNotificatorInitialized)
        {
            try
            {
                m_fleetJamNotificator.Deactivate();
            }
            catch
            {
            }

            m_fleetJamNotificator = default(Notificator);
            m_fleetJamNotificatorInitialized = false;
        }

        m_inputScheduler = null;
        m_trainsManager = null;
        m_pauseHandledForCurrentAlert = false;
    }

    private void onSimUpdate()
    {
        updateNotification();
    }

    private void updateNotification()
    {
        if (m_trainsManager == null || !m_fleetJamNotificatorInitialized)
        {
            return;
        }

        int activeTrains = 0;
        int stuckTrains = 0;

        foreach (Train train in m_trainsManager.Trains)
        {
            if (train.IsDestroyed
                || train.IsDespawning
                || !train.IsSpawned
                || train.IsPaused)
            {
                continue;
            }

            activeTrains++;
            if (isWaitingForTrack(train.StateForUi)
                && train.ReservationWaitTime.Ticks >= Duration.OneMonth.Ticks)
            {
                stuckTrains++;
            }
        }

        int criticalThreshold = Math.Max(3, (int)Math.Ceiling(activeTrains * 0.1));
        bool isRedAlert = stuckTrains >= criticalThreshold;
        m_fleetJamNotificator.NotifyIff(isRedAlert);

        if (!isRedAlert)
        {
            m_pauseHandledForCurrentAlert = false;
            return;
        }

        if (JsonConfig.GetBool("pause_on_red_alert")
            && !m_pauseHandledForCurrentAlert)
        {
            m_pauseHandledForCurrentAlert = true;
            if (!m_simLoopEvents.IsSimPaused && m_inputScheduler != null)
            {
                m_inputScheduler.ScheduleInputCmd(new SetSimPauseStateCmd(true));
            }
        }
    }

    private static bool isWaitingForTrack(TrainStateForUi state)
    {
        return state == TrainStateForUi.WaitingForFreeTrack
            || state == TrainStateForUi.WaitingForSuperBlock
            || state == TrainStateForUi.WaitingForBidirectionalSuperBlock;
    }
}
