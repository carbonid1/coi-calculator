using System;

using Mafi.Core.GameLoop;
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
    private readonly Button m_toolbarButton;
    private ISimLoopEvents m_simLoopEvents;
    private bool m_isEnabled;
    private bool m_isUpdateSubscribed;
    private int m_updatesUntilRefresh;

    public TrainNetworkDashboardController(
        ControllerContext context,
        ToolbarHud toolbarHud,
        TrainNetworksManager trainNetworksManager,
        ISimLoopEvents simLoopEvents,
        bool isEnabled)
        : base(context, null)
    {
        m_trainNetworksManager = trainNetworksManager;
        m_simLoopEvents = simLoopEvents;
        m_toolbarButton = toolbarHud.AddMainMenuButton(
            new LocStrFormatted("Train Network Monitor"),
            this,
            NetworkIconPath,
            220f,
            null);
        m_toolbarButton.Hide();
        SetEnabled(isEnabled);
    }

    public event Action<IToolbarItemController> VisibilityChanged
    {
        add { }
        remove { }
    }

    public bool IsVisible { get { return true; } }

    public bool DeactivateShortcutsIfNotVisible { get { return false; } }

    public bool IsEnabled { get { return m_isEnabled; } }

    public void SetEnabled(bool enabled)
    {
        if (enabled == m_isEnabled)
        {
            return;
        }

        m_isEnabled = enabled;
        if (enabled)
        {
            m_toolbarButton.Show();
            subscribeToUpdates();
            return;
        }

        DeactivateSelf();
        m_toolbarButton.Hide();
        unsubscribeFromUpdates();
    }

    public void Dispose()
    {
        SetEnabled(false);
        unsubscribeFromUpdates();
        m_simLoopEvents = null;
    }

    protected override TrainNetworkDashboardWindow CreateWindow()
    {
        return new TrainNetworkDashboardWindow(m_trainNetworksManager);
    }

    protected override void OnActivate()
    {
        if (!m_isEnabled)
        {
            return;
        }

        base.OnActivate();
        m_updatesUntilRefresh = RefreshIntervalUpdates;
        if (HasWindow)
        {
            Window.Refresh();
        }
    }

    private void onUiUpdate()
    {
        if (!m_isEnabled || !IsActive || !HasWindow)
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

    private void subscribeToUpdates()
    {
        if (m_isUpdateSubscribed || m_simLoopEvents == null)
        {
            return;
        }

        m_simLoopEvents.UpdateEndForUi.AddNonSaveable(this, onUiUpdate);
        m_isUpdateSubscribed = true;
    }

    private void unsubscribeFromUpdates()
    {
        if (!m_isUpdateSubscribed || m_simLoopEvents == null)
        {
            return;
        }

        try
        {
            m_simLoopEvents.UpdateEndForUi.RemoveNonSaveable(this, onUiUpdate);
        }
        catch
        {
        }

        m_isUpdateSubscribed = false;
    }
}
