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
using Mafi.Core.Products;
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
    private TrainNetworkDashboardController m_dashboardController;
    private TrainNetworksManager m_trainNetworksManager;
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
        m_trainNetworksManager = resolver.Resolve<TrainNetworksManager>();
        m_notificationsManager = resolver.Resolve<INotificationsManager>();
        m_notificationsManager.ClearAllNotificationsWithId(FleetJamNotificationId);
        m_notificationsManager.ClearAllNotificationsWithId(GroupedFleetJamNotificationId);
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);
        m_gameLoopEvents = resolver.Resolve<IGameLoopEvents>();
        m_gameLoopEvents.RegisterRendererInitState(this, () => initializeUi(resolver));

        clearTrainWaitTracking();
        updateNotification();
        Log.Info("Train Network Monitor: fleet traffic alerts enabled.");
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
        if (m_dashboardController != null)
        {
            try
            {
                m_dashboardController.Dispose();
            }
            catch
            {
            }

            m_dashboardController = null;
        }

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
        m_trainNetworksManager = null;
        m_trainsManager = null;
        m_isRedAlertActive = false;
        m_pauseHandledForCurrentAlert = false;
    }

    private void initializeUi(DependencyResolver resolver)
    {
        try
        {
            m_dashboardController = new TrainNetworkDashboardController(
                resolver.Resolve<ControllerContext>(),
                resolver.Resolve<ToolbarHud>(),
                m_trainNetworksManager,
                m_simLoopEvents);
            Log.Info("Train Network Monitor: live network dashboard enabled.");
        }
        catch (Exception exception)
        {
            Log.Info(
                "Train Network Monitor: live network dashboard unavailable: "
                + exception);
        }

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

internal sealed class TrainNetworkDashboardController
    : WindowController<TrainNetworkDashboardWindow>, IToolbarItemController
{
    private const string NetworkIconPath =
        "Assets/Unity/UserInterface/Trains/TrainNetwork.svg";
    // Train networks run their own dispatch pass every 11 simulation updates.
    // Matching that cadence keeps the dashboard current without redrawing it
    // on every simulation tick.
    private const int RefreshIntervalUpdates = 11;

    private readonly TrainNetworksManager m_trainNetworksManager;
    private ISimLoopEvents m_simLoopEvents;
    private int m_updatesUntilRefresh;

    public TrainNetworkDashboardController(
        ControllerContext context,
        ToolbarHud toolbarHud,
        TrainNetworksManager trainNetworksManager,
        ISimLoopEvents simLoopEvents)
        : base(context, null)
    {
        m_trainNetworksManager = trainNetworksManager;
        m_simLoopEvents = simLoopEvents;
        toolbarHud.AddMainMenuButton(
            new LocStrFormatted("Train Network Monitor"),
            this,
            NetworkIconPath,
            220f,
            null);
        m_simLoopEvents.UpdateEndForUi.AddNonSaveable(this, onUiUpdate);
    }

    public event Action<IToolbarItemController> VisibilityChanged
    {
        add { }
        remove { }
    }

    public bool IsVisible { get { return true; } }

    public bool DeactivateShortcutsIfNotVisible { get { return false; } }

    public void Dispose()
    {
        if (m_simLoopEvents != null)
        {
            try
            {
                m_simLoopEvents.UpdateEndForUi.RemoveNonSaveable(this, onUiUpdate);
            }
            catch
            {
            }

            m_simLoopEvents = null;
        }

        DeactivateSelf();
    }

    protected override TrainNetworkDashboardWindow CreateWindow()
    {
        return new TrainNetworkDashboardWindow(m_trainNetworksManager);
    }

    protected override void OnActivate()
    {
        base.OnActivate();
        m_updatesUntilRefresh = RefreshIntervalUpdates;
        if (HasWindow)
        {
            Window.Refresh();
        }
    }

    private void onUiUpdate()
    {
        if (!IsActive || !HasWindow)
        {
            return;
        }

        m_updatesUntilRefresh--;
        if (m_updatesUntilRefresh > 0)
        {
            return;
        }

        m_updatesUntilRefresh = RefreshIntervalUpdates;
        Window.Refresh();
    }
}

internal sealed class TrainNetworkDashboardWindow : Window
{
    private readonly TrainNetworksManager m_trainNetworksManager;
    private readonly Column m_networksColumn;
    private readonly List<TrainNetworkDashboardNetworkRow> m_networkRows =
        new List<TrainNetworkDashboardNetworkRow>();

    public TrainNetworkDashboardWindow(TrainNetworksManager trainNetworksManager)
        : base(new LocStrFormatted("Train Network Monitor"), false)
    {
        m_trainNetworksManager = trainNetworksManager;
        WindowSize(560.px(), 720.px());
        MakeMovableAndEnablePositionSaving();
        EnablePinning();

        m_networksColumn = new Column(6.pt());
        m_networksColumn.AlignItemsStretch().Padding(6.pt());
        ScrollColumn scroll = new ScrollColumn();
        scroll.Add(m_networksColumn);
        scroll.AlignItemsStretch().FlexGrow(1);
        AddBodySingle(scroll);
    }

    public void Refresh()
    {
        List<TrainNetworkDashboardSnapshot> snapshots =
            TrainNetworkDashboardSnapshotBuilder.Build(m_trainNetworksManager);

        if (!hasSameStructure(snapshots))
        {
            rebuild(snapshots);
        }

        for (int i = 0; i < snapshots.Count; i++)
        {
            m_networkRows[i].Value(snapshots[i]);
        }
    }

    private bool hasSameStructure(List<TrainNetworkDashboardSnapshot> snapshots)
    {
        if (snapshots.Count != m_networkRows.Count)
        {
            return false;
        }

        for (int i = 0; i < snapshots.Count; i++)
        {
            if (!m_networkRows[i].MatchesStructure(snapshots[i]))
            {
                return false;
            }
        }

        return true;
    }

    private void rebuild(List<TrainNetworkDashboardSnapshot> snapshots)
    {
        m_networksColumn.Clear();
        m_networkRows.Clear();
        for (int i = 0; i < snapshots.Count; i++)
        {
            TrainNetworkDashboardNetworkRow row =
                new TrainNetworkDashboardNetworkRow(snapshots[i]);
            m_networkRows.Add(row);
            m_networksColumn.Add(row);
        }
    }
}

internal sealed class TrainNetworkDashboardNetworkRow : Column
{
    private const string TrainIconPath =
        "Assets/Unity/UserInterface/Toolbar/TrainLines.svg";
    private const string WaitingBayIconPath =
        "Assets/Unity/UserInterface/Trains/TrainDestination.svg";

    private readonly int m_networkId;
    private readonly UiComponent m_colorSwatch;
    private readonly Label m_nameLabel;
    private readonly TrainNetworkDashboardOccupancy m_trainOccupancy;
    private readonly TrainNetworkDashboardMetricRow m_waitingBayRow;
    private readonly List<TrainNetworkDashboardMetricRow> m_typeRows =
        new List<TrainNetworkDashboardMetricRow>();
    private readonly List<TrainNetworkDashboardWagonKind> m_typeKinds =
        new List<TrainNetworkDashboardWagonKind>();

    public TrainNetworkDashboardNetworkRow(TrainNetworkDashboardSnapshot snapshot)
        : base(4.pt())
    {
        m_networkId = snapshot.NetworkId;
        this.AlignItemsStretch()
            .Padding(8.pt())
            .Background(Theme.BackgroundPanelLike)
            .Border(1.pt(), Theme.BorderColor, 2);

        m_colorSwatch = new UiComponent()
            .Width(5.px())
            .Height(24.px())
            .NoShrink();
        m_nameLabel = new Label(snapshot.Name).FontBold().FlexGrow(1);
        Icon trainIcon = new Icon(TrainIconPath)
            .Width(26.px())
            .Height(22.px())
            .NoShrink();
        m_trainOccupancy = new TrainNetworkDashboardOccupancy();
        m_trainOccupancy.Tooltip(new LocStrFormatted("Occupied / total trains"));

        Row header = new Row(6.pt());
        header.AlignItemsCenter();
        header.Add(m_colorSwatch);
        header.Add(m_nameLabel);
        header.Add(trainIcon);
        header.Add(m_trainOccupancy);
        Add(header);

        m_waitingBayRow = new TrainNetworkDashboardMetricRow(
            WaitingBayIconPath,
            new LocStrFormatted(Tr.TrainNetwork_WaitingBays.ToString()),
            true,
            new LocStrFormatted("Busy / total waiting bays"));
        Add(m_waitingBayRow);

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            TrainNetworkDashboardTypeSnapshot typeSnapshot = snapshot.TypeRows[i];
            TrainNetworkDashboardMetricRow typeRow =
                TrainNetworkDashboardMetricRow.ForWagonType(typeSnapshot);
            m_typeKinds.Add(typeSnapshot.Kind);
            m_typeRows.Add(typeRow);
            Add(typeRow);
        }

        Value(snapshot);
    }

    public bool MatchesStructure(TrainNetworkDashboardSnapshot snapshot)
    {
        if (snapshot.NetworkId != m_networkId
            || snapshot.TypeRows.Count != m_typeKinds.Count)
        {
            return false;
        }

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            if (snapshot.TypeRows[i].Kind != m_typeKinds[i])
            {
                return false;
            }
        }

        return true;
    }

    public void Value(TrainNetworkDashboardSnapshot snapshot)
    {
        m_colorSwatch.Background(snapshot.Color);
        m_nameLabel.Value(snapshot.Name);
        m_trainOccupancy.Value(snapshot.OccupiedTrains, snapshot.TotalTrains);
        m_waitingBayRow.Value(snapshot.BusyWaitingBays, snapshot.TotalWaitingBays);

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            TrainNetworkDashboardTypeSnapshot typeSnapshot = snapshot.TypeRows[i];
            m_typeRows[i].Value(typeSnapshot.Occupied, typeSnapshot.Total);
        }
    }
}

internal sealed class TrainNetworkDashboardMetricRow : Row
{
    private const string MixedIconPath =
        "Assets/Unity/UserInterface/Trains/WagonEmpty.svg";
    private const string GenericTrainIconPath =
        "Assets/Unity/UserInterface/Toolbar/TrainLines.svg";

    private readonly TrainNetworkDashboardOccupancy m_occupancy;

    public TrainNetworkDashboardMetricRow(
        string iconPath,
        LocStrFormatted label,
        bool showLabel,
        LocStrFormatted tooltip)
        : this(new Icon(iconPath), label, showLabel, tooltip)
    {
    }

    private TrainNetworkDashboardMetricRow(
        Icon icon,
        LocStrFormatted label,
        bool showLabel,
        LocStrFormatted tooltip)
        : base(6.pt())
    {
        this.AlignItemsCenter().PaddingLeft(14.pt());
        icon.Width(30.px()).Height(22.px()).NoShrink().NoTint();
        Add(icon);

        if (showLabel)
        {
            Add(new Label(label).FontSize(13).Width(110.px()).NoShrink());
        }
        else
        {
            Add(new UiComponent().Width(110.px()).NoShrink());
        }

        m_occupancy = new TrainNetworkDashboardOccupancy();
        m_occupancy.Tooltip(tooltip);
        Add(m_occupancy);
    }

    public static TrainNetworkDashboardMetricRow ForWagonType(
        TrainNetworkDashboardTypeSnapshot snapshot)
    {
        LocStrFormatted label = labelFor(snapshot.Kind);
        bool showLabel = snapshot.Kind != TrainNetworkDashboardWagonKind.Generic;
        Icon icon;
        if (snapshot.IconProto != null
            && snapshot.Kind != TrainNetworkDashboardWagonKind.Mixed
            && snapshot.Kind != TrainNetworkDashboardWagonKind.Generic)
        {
            icon = new Icon(snapshot.IconProto, true, true);
        }
        else
        {
            string iconPath = snapshot.Kind == TrainNetworkDashboardWagonKind.Mixed
                ? MixedIconPath
                : GenericTrainIconPath;
            icon = new Icon(iconPath);
        }

        return new TrainNetworkDashboardMetricRow(
            icon,
            label,
            showLabel,
            new LocStrFormatted("Occupied / total trains"));
    }

    public void Value(int occupied, int total)
    {
        m_occupancy.Value(occupied, total);
    }

    private static LocStrFormatted labelFor(TrainNetworkDashboardWagonKind kind)
    {
        switch (kind)
        {
            case TrainNetworkDashboardWagonKind.Unit:
                return new LocStrFormatted(Tr.ProductType__Countable.ToString());
            case TrainNetworkDashboardWagonKind.Loose:
                return new LocStrFormatted(Tr.ProductType__Loose.ToString());
            case TrainNetworkDashboardWagonKind.Fluid:
                return new LocStrFormatted(Tr.ProductType__Fluid.ToString());
            case TrainNetworkDashboardWagonKind.Molten:
                return new LocStrFormatted(Tr.ProductType__Molten.ToString());
            case TrainNetworkDashboardWagonKind.Universal:
                return new LocStrFormatted(Tr.ProductType__Universal.ToString());
            case TrainNetworkDashboardWagonKind.Mixed:
                return new LocStrFormatted("Mixed");
            default:
                return new LocStrFormatted("");
        }
    }
}

internal sealed class TrainNetworkDashboardOccupancy : Row
{
    private const int BarWidth = 112;

    private readonly Label m_valueLabel;
    private readonly UiComponent m_occupiedBar;
    private readonly UiComponent m_freeBar;
    private int m_lastOccupied = -1;
    private int m_lastTotal = -1;
    private int m_lastOccupiedWidth = -1;

    public TrainNetworkDashboardOccupancy()
        : base(6.pt())
    {
        this.AlignItemsCenter().NoShrink();
        m_valueLabel = new Label(new LocStrFormatted("0/0"))
            .FontSize(13)
            .TextAlign(TextAlignment.RightMiddle)
            .Width(46.px())
            .NoShrink();
        m_occupiedBar = new UiComponent()
            .Height(7.px())
            .Background(Theme.ImportantColor)
            .NoShrink();
        m_freeBar = new UiComponent()
            .Height(7.px())
            .Background(Theme.BackgroundDark)
            .NoShrink();
        Row bar = new Row(0.pt());
        bar.Width(BarWidth.px())
            .Height(9.px())
            .Border(1.pt(), Theme.BorderColor, 2)
            .NoShrink();
        bar.Add(m_occupiedBar);
        bar.Add(m_freeBar);
        Add(m_valueLabel);
        Add(bar);
        Value(0, 0);
    }

    public void Value(int occupied, int total)
    {
        total = Math.Max(0, total);
        occupied = Math.Max(0, Math.Min(occupied, total));
        if (occupied != m_lastOccupied || total != m_lastTotal)
        {
            m_lastOccupied = occupied;
            m_lastTotal = total;
            m_valueLabel.Value(new LocStrFormatted(occupied + "/" + total));
        }

        int occupiedWidth = total == 0
            ? 0
            : (int)Math.Round((double)occupied * BarWidth / total);
        occupiedWidth = Math.Max(0, Math.Min(BarWidth, occupiedWidth));
        if (occupiedWidth == m_lastOccupiedWidth)
        {
            return;
        }

        m_lastOccupiedWidth = occupiedWidth;
        m_occupiedBar.Width(occupiedWidth.px());
        m_freeBar.Width((BarWidth - occupiedWidth).px());
    }
}

internal static class TrainNetworkDashboardSnapshotBuilder
{
    private const int WagonKindCount = 7;

    public static List<TrainNetworkDashboardSnapshot> Build(
        TrainNetworksManager trainNetworksManager)
    {
        List<TrainNetworkDashboardSnapshot> snapshots =
            new List<TrainNetworkDashboardSnapshot>();
        foreach (KeyValuePair<TrainNetworkId, TrainNetwork> pair
            in trainNetworksManager.Networks)
        {
            TrainNetworkDashboardSnapshot snapshot = buildNetwork(pair.Value);
            if (snapshot.TotalTrains > 0)
            {
                snapshots.Add(snapshot);
            }
        }

        snapshots.Sort((left, right) => left.NetworkId.CompareTo(right.NetworkId));
        return snapshots;
    }

    private static TrainNetworkDashboardSnapshot buildNetwork(TrainNetwork network)
    {
        int[] totals = new int[WagonKindCount];
        int[] occupied = new int[WagonKindCount];
        IProtoWithIcon[] iconProtos = new IProtoWithIcon[WagonKindCount];
        int totalTrains = 0;
        int occupiedTrains = 0;

        foreach (Train train in network.Trains)
        {
            if (train.IsDestroyed || train.IsDespawning)
            {
                continue;
            }

            bool isOccupied = network.GetTrainState(train)
                != TrainNetwork.NetworkStateForUi.WaitingForJob;
            TrainNetworkDashboardWagonKind kind = classify(train);
            int kindIndex = (int)kind;
            totalTrains++;
            totals[kindIndex]++;
            if (isOccupied)
            {
                occupiedTrains++;
                occupied[kindIndex]++;
            }

            if (iconProtos[kindIndex] == null
                && kind != TrainNetworkDashboardWagonKind.Mixed
                && kind != TrainNetworkDashboardWagonKind.Generic
                && train.CargoWagons.Length > 0)
            {
                iconProtos[kindIndex] = train.CargoWagons[0].Prototype;
            }
        }

        int busyWaitingBays = 0;
        foreach (ITrainStationRoot waitingBay in network.WaitingBays)
        {
            Option<TrainStationGroup> group = waitingBay.Group;
            if (group.HasValue && group.Value.GetTotalServicingTrainsCount() > 0)
            {
                busyWaitingBays++;
            }
        }

        List<TrainNetworkDashboardTypeSnapshot> typeRows =
            new List<TrainNetworkDashboardTypeSnapshot>();
        for (int i = 0; i < WagonKindCount; i++)
        {
            if (totals[i] > 0)
            {
                typeRows.Add(new TrainNetworkDashboardTypeSnapshot(
                    (TrainNetworkDashboardWagonKind)i,
                    occupied[i],
                    totals[i],
                    iconProtos[i]));
            }
        }

        return new TrainNetworkDashboardSnapshot(
            network.Id.Value,
            network.Name,
            network.Color.Primary,
            occupiedTrains,
            totalTrains,
            busyWaitingBays,
            network.WaitingBays.Count,
            typeRows);
    }

    private static TrainNetworkDashboardWagonKind classify(Train train)
    {
        if (train.CargoWagons.Length == 0)
        {
            return TrainNetworkDashboardWagonKind.Generic;
        }

        if (train.GetHasMixedWagonTypes())
        {
            return TrainNetworkDashboardWagonKind.Mixed;
        }

        ProductType productType = train.CargoWagons[0].Prototype.ProductType;
        if (productType.ExactlyMatches(CountableProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Unit;
        }

        if (productType.ExactlyMatches(LooseProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Loose;
        }

        if (productType.ExactlyMatches(FluidProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Fluid;
        }

        if (productType.ExactlyMatches(MoltenProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Molten;
        }

        if (productType.ExactlyMatches(ProductType.NON_MOLTEN))
        {
            return TrainNetworkDashboardWagonKind.Universal;
        }

        return TrainNetworkDashboardWagonKind.Generic;
    }
}

internal sealed class TrainNetworkDashboardSnapshot
{
    public readonly int NetworkId;
    public readonly LocStrFormatted Name;
    public readonly ColorRgba Color;
    public readonly int OccupiedTrains;
    public readonly int TotalTrains;
    public readonly int BusyWaitingBays;
    public readonly int TotalWaitingBays;
    public readonly List<TrainNetworkDashboardTypeSnapshot> TypeRows;

    public TrainNetworkDashboardSnapshot(
        int networkId,
        LocStrFormatted name,
        ColorRgba color,
        int occupiedTrains,
        int totalTrains,
        int busyWaitingBays,
        int totalWaitingBays,
        List<TrainNetworkDashboardTypeSnapshot> typeRows)
    {
        NetworkId = networkId;
        Name = name;
        Color = color;
        OccupiedTrains = occupiedTrains;
        TotalTrains = totalTrains;
        BusyWaitingBays = busyWaitingBays;
        TotalWaitingBays = totalWaitingBays;
        TypeRows = typeRows;
    }
}

internal sealed class TrainNetworkDashboardTypeSnapshot
{
    public readonly TrainNetworkDashboardWagonKind Kind;
    public readonly int Occupied;
    public readonly int Total;
    public readonly IProtoWithIcon IconProto;

    public TrainNetworkDashboardTypeSnapshot(
        TrainNetworkDashboardWagonKind kind,
        int occupied,
        int total,
        IProtoWithIcon iconProto)
    {
        Kind = kind;
        Occupied = occupied;
        Total = total;
        IconProto = iconProto;
    }
}

internal enum TrainNetworkDashboardWagonKind
{
    Unit = 0,
    Loose = 1,
    Fluid = 2,
    Molten = 3,
    Universal = 4,
    Mixed = 5,
    Generic = 6,
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
