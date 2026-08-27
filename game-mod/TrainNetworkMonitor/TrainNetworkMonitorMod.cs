using System;
using System.Collections.Generic;

using CoI.AutoHelpers.Settings;
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
using Mafi.Unity;
using Mafi.Unity.InputControl;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiStatic.Toolbar;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;
using Mafi.Unity.UiToolkit.Themes;

public sealed class TrainNetworkMonitorMod : IMod, IDisposable
{
    private const string SettingsIconPath =
        "Assets/Unity/UserInterface/General/Configure.svg";

    private static readonly EntityNotificationProto.ID FleetJamNotificationId =
        new EntityNotificationProto.ID("TrainNetworkMonitor_FleetJam");
    private static readonly EntityNotificationProto.ID GroupedFleetJamNotificationId =
        new EntityNotificationProto.ID("TrainNetworkMonitor_FleetJam_Grouped");

    private NotificationProto m_fleetJamNotificationProto;
    private NotificationProto m_groupedFleetJamNotificationProto;
    private readonly Dictionary<TrainId, EntityNotificator> m_trainJamNotificators =
        new Dictionary<TrainId, EntityNotificator>();
    // In game version 0.8.7a, Train.ReservationWaitTime never resets after its
    // first failed reservation. Track uninterrupted UI wait states ourselves.
    private readonly Dictionary<TrainId, SimStep> m_trainWaitStartSteps =
        new Dictionary<TrainId, SimStep>();
    private readonly HashSet<TrainId> m_waitingTrainIdsThisUpdate =
        new HashSet<TrainId>();
    private readonly List<TrainId> m_waitTrackingIdsToRemove =
        new List<TrainId>();
    private bool m_isRedAlertActive;
    private INotificationsManager m_notificationsManager;
    private bool m_pauseHandledForCurrentAlert;
    private IGameLoopEvents m_gameLoopEvents;
    private IInputScheduler m_inputScheduler;
    private TrainNetworkSettingsController m_settingsController;
    private TrainsManager m_trainsManager;
    private ISimLoopEvents m_simLoopEvents;

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
                FleetJamNotificationId,
                "Critical alert shown when many active trains remain blocked by rail traffic.")
            .SetType(NotificationType.Continuous)
            .SetStyle(NotificationStyle.Critical)
            .HideInInspector()
            .BuildAndAdd(true);
        m_groupedFleetJamNotificationProto = new NotificationProtoBuilder(registrator)
            .Start(
                "Train traffic jam",
                GroupedFleetJamNotificationId,
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
        m_inputScheduler = resolver.Resolve<IInputScheduler>();
        m_trainsManager = resolver.Resolve<TrainsManager>();
        m_notificationsManager = resolver.Resolve<INotificationsManager>();
        m_notificationsManager.ClearAllNotificationsWithId(FleetJamNotificationId);
        m_notificationsManager.ClearAllNotificationsWithId(GroupedFleetJamNotificationId);
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);
        m_gameLoopEvents = resolver.Resolve<IGameLoopEvents>();
        m_gameLoopEvents.RegisterRendererInitState(this, () => initializeSettingsUi(resolver));

        clearTrainWaitTracking();
        updateNotification();
        Log.Info("Train Network Monitor: fleet traffic alerts enabled.");
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
        clearTrainWaitTracking();

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
            ModSettings.EnsureInitialized(
                resolver.Resolve<HudController>(),
                resolver.Resolve<UiRoot>(),
                resolver.Resolve<IRootEscapeManager>());
            ModSettings.RegisterTab(new ModSettingsTab(
                "TrainNetworkMonitor",
                new LocStrFormatted("Train Network Monitor"),
                new LocStrFormatted("Settings"),
                300,
                () => new TrainNetworkSettingsPanel(JsonConfig),
                SettingsIconPath,
                SettingsIconPath));
            Log.Info(
                "Train Network Monitor: registered in cooperative Mod Settings hub.");
            return;
        }
        catch (Exception exception)
        {
            Log.Info(
                "Train Network Monitor: cooperative Mod Settings hub failed; "
                + "using standalone settings: "
                + exception);
        }

        try
        {
            m_settingsController = new TrainNetworkSettingsController(
                resolver.Resolve<ControllerContext>(),
                resolver.Resolve<ToolbarHud>(),
                JsonConfig);
            Log.Info(
                "Train Network Monitor: shared Mod Settings hub not found; "
                + "standalone settings button enabled.");
        }
        catch (Exception exception)
        {
            Log.Info(
                "Train Network Monitor: standalone settings UI unavailable: "
                + exception);
        }
    }

    private void onSimUpdate()
    {
        updateNotification();
    }

    private void updateNotification()
    {
        if (m_trainsManager == null
            || m_notificationsManager == null
            || m_simLoopEvents == null)
        {
            return;
        }

        int activeTrains = 0;
        List<SustainedTrainWait> stuckTrains = new List<SustainedTrainWait>();
        int stuckAfterCycles = Math.Min(
            12,
            Math.Max(1, JsonConfig.GetInt("stuck_after_cycles")));
        Duration stuckAfter = Duration.OneMonth * stuckAfterCycles;
        SimStep currentStep = m_simLoopEvents.CurrentStep;
        m_waitingTrainIdsThisUpdate.Clear();

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
            if (!isWaitingForTrack(train.StateForUi))
            {
                continue;
            }

            TrainId trainId = train.TrainId;
            m_waitingTrainIdsThisUpdate.Add(trainId);

            SimStep waitStartStep;
            if (!m_trainWaitStartSteps.TryGetValue(trainId, out waitStartStep))
            {
                waitStartStep = currentStep;
                m_trainWaitStartSteps.Add(trainId, waitStartStep);
            }

            Duration waitDuration = currentStep - waitStartStep;
            if (waitDuration >= stuckAfter)
            {
                stuckTrains.Add(new SustainedTrainWait(train, waitDuration));
            }
        }

        removeCompletedTrainWaits();

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

    private void syncTrainNotifications(
        List<SustainedTrainWait> stuckTrains,
        bool isRedAlert)
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
            stuckTrainIds.Add(stuckTrains[i].Train.TrainId);
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
            right.Duration.Ticks.CompareTo(left.Duration.Ticks));

        bool shouldPlayAlertAudio = !m_isRedAlertActive;
        for (int i = 0; i < stuckTrains.Count; i++)
        {
            Train train = stuckTrains[i].Train;
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

    private void removeCompletedTrainWaits()
    {
        m_waitTrackingIdsToRemove.Clear();
        foreach (KeyValuePair<TrainId, SimStep> pair in m_trainWaitStartSteps)
        {
            if (!m_waitingTrainIdsThisUpdate.Contains(pair.Key))
            {
                m_waitTrackingIdsToRemove.Add(pair.Key);
            }
        }

        for (int i = 0; i < m_waitTrackingIdsToRemove.Count; i++)
        {
            m_trainWaitStartSteps.Remove(m_waitTrackingIdsToRemove[i]);
        }
    }

    private void clearTrainWaitTracking()
    {
        m_trainWaitStartSteps.Clear();
        m_waitingTrainIdsThisUpdate.Clear();
        m_waitTrackingIdsToRemove.Clear();
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

    private struct SustainedTrainWait
    {
        public readonly Train Train;
        public readonly Duration Duration;

        public SustainedTrainWait(Train train, Duration duration)
        {
            Train = train;
            Duration = duration;
        }
    }
}

internal sealed class TrainNetworkSettingsController
    : WindowController<TrainNetworkSettingsWindow>, IToolbarItemController
{
    private const string SettingsIconPath =
        "Assets/Unity/UserInterface/General/Configure.svg";

    private readonly ModJsonConfig m_jsonConfig;

    public TrainNetworkSettingsController(
        ControllerContext context,
        ToolbarHud toolbarHud,
        ModJsonConfig jsonConfig)
        : base(context, null)
    {
        m_jsonConfig = jsonConfig;
        toolbarHud.AddMainMenuButton(
            new LocStrFormatted("Train Network Monitor settings"),
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

    protected override TrainNetworkSettingsWindow CreateWindow()
    {
        return new TrainNetworkSettingsWindow(m_jsonConfig);
    }
}

internal sealed class TrainNetworkSettingsWindow : Window
{
    public TrainNetworkSettingsWindow(ModJsonConfig jsonConfig)
        : base(new LocStrFormatted("Train Network Monitor"), false)
    {
        WindowSize(560.px(), 240.px());
        CloseOnClickOutside();
        AddBodySingle(new TrainNetworkSettingsPanel(jsonConfig));
    }
}

internal sealed class TrainNetworkSettingsPanel : Column
{
    private const string StuckAfterKey = "stuck_after_cycles";
    private const string PauseOnAlertKey = "pause_on_red_alert";
    private const int DefaultStuckAfterMonths = 1;

    private static readonly Px InnerGap = 2.pt();
    private static readonly Px ModifiedBorder = 1.pt();

    private readonly ModJsonConfig m_jsonConfig;

    public TrainNetworkSettingsPanel(ModJsonConfig jsonConfig)
        : base(8.pt())
    {
        m_jsonConfig = jsonConfig;
        this.AlignItemsStretch().PaddingBottom(10.pt());
        Add(createStuckAfterControl());
        Add(createPauseControl());
    }

    private UiComponent createStuckAfterControl()
    {
        Label errorLabel = new Label()
            .Color(Theme.DangerColor)
            .FontSize(12)
            .Hide();
        TextField field = new TextField()
            .Text(m_jsonConfig.GetInt(StuckAfterKey).ToString())
            .PositiveIntegersOnly();
        Column row = new Column(InnerGap);
        row.AlignItemsStretch().PaddingLeft(2.pt());
        row.Add(createHeader(
            "Alert after waiting",
            "How long a train may wait for a free track: 1–12 in-game months (12 months = 1 year)."));
        row.Add(new Row(1.pt()) { field });
        row.Add(errorLabel);

        updateModifiedBorder(
            row,
            m_jsonConfig.GetInt(StuckAfterKey) != DefaultStuckAfterMonths);
        field.OnEditEnd(delegate(string text)
        {
            int value;
            string error;
            if (!Int32.TryParse(text, out value))
            {
                errorLabel.Value(new LocStrFormatted("A whole number is required.")).Show();
            }
            else if (!m_jsonConfig.TrySetValue(StuckAfterKey, value, out error))
            {
                errorLabel.Value(new LocStrFormatted(
                    error.Replace(" for '" + StuckAfterKey + "'", ""))).Show();
            }
            else
            {
                errorLabel.Hide();
            }

            updateModifiedBorder(
                row,
                m_jsonConfig.GetInt(StuckAfterKey) != DefaultStuckAfterMonths);
        });
        return row;
    }

    private UiComponent createPauseControl()
    {
        Toggle toggle = new Toggle()
            .JustifyItemsStart()
            .Value(m_jsonConfig.GetBool(PauseOnAlertKey));
        Column row = new Column(InnerGap);
        row.AlignItemsStretch().PaddingLeft(2.pt());
        row.Add(createHeader(
            "Pause on red alert",
            "Pause once when this mod's train traffic red alert begins. Other alerts are unaffected, and the game never resumes automatically."));
        row.Add(new Row(1.pt()) { toggle });

        updateModifiedBorder(row, m_jsonConfig.GetBool(PauseOnAlertKey));
        toggle.OnValueChanged(delegate(bool value)
        {
            string error;
            m_jsonConfig.TrySetValue(PauseOnAlertKey, value, out error);
            updateModifiedBorder(row, m_jsonConfig.GetBool(PauseOnAlertKey));
        });
        return row;
    }

    private static UiComponent createHeader(string title, string description)
    {
        return new Column(1.pt())
        {
            new Label(new LocStrFormatted(title)).FontBold(),
            new Label(new LocStrFormatted(description))
                .Color(Theme.InactiveColor)
                .FontSize(12)
        };
    }

    private static void updateModifiedBorder(Column row, bool isModified)
    {
        row.BorderLeft(
            ModifiedBorder,
            isModified ? Theme.ImportantColor : ColorRgba.Empty);
    }
}
