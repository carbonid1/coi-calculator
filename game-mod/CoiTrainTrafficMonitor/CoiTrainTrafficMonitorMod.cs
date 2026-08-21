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
using Mafi.Localization;
using Mafi.Unity.InputControl;
using Mafi.Unity.InputControl.GameMenu.Settings;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiStatic.Toolbar;
using Mafi.Unity.UiToolkit.Library;

public sealed class CoiTrainTrafficMonitorMod : IMod, IDisposable
{
    private static readonly GeneralNotificationProto.ID FleetJamNotificationId =
        new GeneralNotificationProto.ID("CoiTrainTrafficMonitor_FleetJam");

    private NotificationProto m_fleetJamNotificationProto;
    private Notificator m_fleetJamNotificator;
    private bool m_fleetJamNotificatorInitialized;
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
        m_gameLoopEvents = null;
        m_trainsManager = null;
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
        if (m_trainsManager == null || !m_fleetJamNotificatorInitialized)
        {
            return;
        }

        int activeTrains = 0;
        int stuckTrains = 0;
        int stuckAfterCycles = Math.Min(
            120,
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
