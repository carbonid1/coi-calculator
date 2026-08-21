using System;
using System.Collections.Generic;

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
using Mafi.Localization;
using Mafi.Unity.InputControl;
using Mafi.Unity.InputControl.GameMenu.Settings;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiStatic.Toolbar;
using Mafi.Unity.UiToolkit.Library;

public sealed class CoiTrainTrafficMonitorMod : IMod, IDisposable
{
    private static readonly EntityNotificationProto.ID FleetJamNotificationId =
        new EntityNotificationProto.ID("CoiTrainTrafficMonitor_FleetJam");
    private static readonly EntityNotificationProto.ID GroupedFleetJamNotificationId =
        new EntityNotificationProto.ID("CoiTrainTrafficMonitor_FleetJam_Grouped");

    private NotificationProto m_fleetJamNotificationProto;
    private NotificationProto m_groupedFleetJamNotificationProto;
    private readonly Dictionary<TrainId, EntityNotificator> m_trainJamNotificators =
        new Dictionary<TrainId, EntityNotificator>();
    private bool m_isRedAlertActive;
    private INotificationsManager m_notificationsManager;
    private bool m_pauseHandledForCurrentAlert;
    private IGameLoopEvents m_gameLoopEvents;
    private IInputScheduler m_inputScheduler;
    private TrainTrafficSettingsController m_settingsController;
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
            .HideInInspector()
            .BuildAndAdd();
        m_groupedFleetJamNotificationProto = new NotificationProtoBuilder(registrator)
            .Start(
                "Train traffic jam",
                GroupedFleetJamNotificationId,
                "Grouped critical alert for trains blocked by rail traffic.")
            .SetType(NotificationType.Continuous)
            .SetStyle(NotificationStyle.Critical)
            .HideInInspector()
            .MuteAudio()
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
        m_notificationsManager = resolver.Resolve<INotificationsManager>();
        m_notificationsManager.ClearAllNotificationsWithId(FleetJamNotificationId);
        m_notificationsManager.ClearAllNotificationsWithId(GroupedFleetJamNotificationId);
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);
        m_gameLoopEvents = resolver.Resolve<IGameLoopEvents>();
        m_gameLoopEvents.RegisterRendererInitState(this, () => initializeSettingsUi(resolver));

        updateNotification();
        Log.Info("Train Traffic Monitor: fleet traffic alerts enabled.");
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
        if (m_settingsController != null)
        {
            try
            {
                m_settingsController.DeactivateSelf();
            }
            catch
            {
            }

            m_settingsController = null;
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

        deactivateAllTrainNotifications();

        m_inputScheduler = null;
        m_gameLoopEvents = null;
        m_notificationsManager = null;
        m_trainsManager = null;
        m_isRedAlertActive = false;
        m_pauseHandledForCurrentAlert = false;
    }

    private void initializeSettingsUi(DependencyResolver resolver)
    {
        try
        {
            m_settingsController = new TrainTrafficSettingsController(
                resolver.Resolve<ControllerContext>(),
                resolver.Resolve<ToolbarHud>(),
                JsonConfig);
            Log.Info("Train Traffic Monitor: in-game settings button enabled.");
        }
        catch (Exception exception)
        {
            Log.Info("Train Traffic Monitor: in-game settings UI unavailable: " + exception);
        }
    }

    private void onSimUpdate()
    {
        updateNotification();
    }

    private void updateNotification()
    {
        if (m_trainsManager == null || m_notificationsManager == null)
        {
            return;
        }

        int activeTrains = 0;
        List<Train> stuckTrains = new List<Train>();
        int stuckAfterCycles = Math.Min(
            12,
            Math.Max(1, JsonConfig.GetInt("stuck_after_cycles")));
        Duration stuckAfter = Duration.OneMonth * stuckAfterCycles;

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
                && train.ReservationWaitTime >= stuckAfter)
            {
                stuckTrains.Add(train);
            }
        }

        int criticalThreshold = Math.Max(3, (int)Math.Ceiling(activeTrains * 0.1));
        bool isRedAlert = stuckTrains.Count >= criticalThreshold;
        syncTrainNotifications(stuckTrains, isRedAlert);

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

    private void syncTrainNotifications(List<Train> stuckTrains, bool isRedAlert)
    {
        if (!isRedAlert)
        {
            deactivateAllTrainNotifications();
            m_isRedAlertActive = false;
            return;
        }

        HashSet<TrainId> stuckTrainIds = new HashSet<TrainId>();
        for (int i = 0; i < stuckTrains.Count; i++)
        {
            stuckTrainIds.Add(stuckTrains[i].TrainId);
        }

        List<TrainId> notificationIdsToRemove = new List<TrainId>();
        foreach (KeyValuePair<TrainId, EntityNotificator> pair in m_trainJamNotificators)
        {
            if (!stuckTrainIds.Contains(pair.Key))
            {
                notificationIdsToRemove.Add(pair.Key);
            }
        }

        for (int i = 0; i < notificationIdsToRemove.Count; i++)
        {
            TrainId trainId = notificationIdsToRemove[i];
            EntityNotificator notificator = m_trainJamNotificators[trainId];
            notificator.Deactivate(m_notificationsManager);
            m_trainJamNotificators.Remove(trainId);
        }

        stuckTrains.Sort((left, right) =>
            right.ReservationWaitTime.Ticks.CompareTo(left.ReservationWaitTime.Ticks));

        bool shouldPlayAlertAudio = !m_isRedAlertActive;
        for (int i = 0; i < stuckTrains.Count; i++)
        {
            Train train = stuckTrains[i];
            if (m_trainJamNotificators.ContainsKey(train.TrainId))
            {
                continue;
            }

            NotificationProto proto = shouldPlayAlertAudio
                ? m_fleetJamNotificationProto
                : m_groupedFleetJamNotificationProto;
            shouldPlayAlertAudio = false;
            EntityNotificator notificator = new EntityNotificator(proto);
            notificator.Activate(train, m_notificationsManager);
            m_trainJamNotificators.Add(train.TrainId, notificator);
        }

        m_isRedAlertActive = true;
    }

    private void deactivateAllTrainNotifications()
    {
        if (m_notificationsManager != null)
        {
            foreach (EntityNotificator notificator in m_trainJamNotificators.Values)
            {
                EntityNotificator activeNotificator = notificator;
                activeNotificator.Deactivate(m_notificationsManager);
            }
        }

        m_trainJamNotificators.Clear();
    }

    private static bool isWaitingForTrack(TrainStateForUi state)
    {
        return state == TrainStateForUi.WaitingForFreeTrack
            || state == TrainStateForUi.WaitingForSuperBlock
            || state == TrainStateForUi.WaitingForBidirectionalSuperBlock;
    }
}

internal sealed class TrainTrafficSettingsController
    : WindowController<TrainTrafficSettingsWindow>, IToolbarItemController
{
    private const string SettingsIconPath =
        "Assets/Unity/UserInterface/General/Configure.svg";

    private readonly ModJsonConfig m_jsonConfig;

    public TrainTrafficSettingsController(
        ControllerContext context,
        ToolbarHud toolbarHud,
        ModJsonConfig jsonConfig)
        : base(context, null)
    {
        m_jsonConfig = jsonConfig;
        toolbarHud.AddMainMenuButton(
            new LocStrFormatted("Train Traffic Monitor settings"),
            this,
            SettingsIconPath,
            221f,
            null);
    }

    public event Action<IToolbarItemController> VisibilityChanged
    {
        add { }
        remove { }
    }

    public bool IsVisible { get { return true; } }

    public bool DeactivateShortcutsIfNotVisible { get { return false; } }

    protected override TrainTrafficSettingsWindow CreateWindow()
    {
        return new TrainTrafficSettingsWindow(m_jsonConfig);
    }
}

internal sealed class TrainTrafficSettingsWindow : Window
{
    public TrainTrafficSettingsWindow(ModJsonConfig jsonConfig)
        : base(new LocStrFormatted("Train Traffic Monitor"), false)
    {
        WindowSize(560.px(), 240.px());
        CloseOnClickOutside();
        AddBodySingle(new ModJsonConfigPanel(jsonConfig));
    }
}
