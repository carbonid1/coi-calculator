using System;

using CoI.AutoHelpers.Settings;
using Mafi;
using Mafi.Core.Mods;
using Mafi.Core.Simulation;
using Mafi.Core.Trains;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.InputControl;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiToolkit;

internal sealed class TrainNetworkMonitorUi : IDisposable
{
    private const string SettingsIconPath =
        "Assets/Unity/UserInterface/General/Configure.svg";

    private readonly TrainNetworksManager m_trainNetworksManager;
    private readonly ISimLoopEvents m_simLoopEvents;
    private readonly ModJsonConfig m_jsonConfig;
    private TrainNetworkSettingsController m_settingsController;
    private TrainNetworkDashboardController m_dashboardController;

    public TrainNetworkMonitorUi(
        TrainNetworksManager trainNetworksManager,
        ISimLoopEvents simLoopEvents,
        ModJsonConfig jsonConfig)
    {
        m_trainNetworksManager = trainNetworksManager;
        m_simLoopEvents = simLoopEvents;
        m_jsonConfig = jsonConfig;
    }

    public void Initialize(DependencyResolver resolver)
    {
        try
        {
            m_dashboardController = new TrainNetworkDashboardController(
                resolver.Resolve<ControllerContext>(),
                resolver.Resolve<ToolbarHud>(),
                m_trainNetworksManager,
                m_simLoopEvents,
                m_jsonConfig.GetBool(TrainNetworkSettingsKeys.DashboardEnabled));
            Log.Info(
                "Train Network Monitor: live network dashboard controls initialized ("
                + (m_dashboardController.IsEnabled ? "enabled" : "disabled")
                + ").");
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
                () => new TrainNetworkSettingsPanel(
                    m_jsonConfig,
                    setDashboardEnabled),
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
                m_jsonConfig,
                setDashboardEnabled);
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
    }

    private void setDashboardEnabled(bool enabled)
    {
        if (m_dashboardController == null)
        {
            return;
        }

        m_dashboardController.SetEnabled(enabled);
        Log.Info(
            "Train Network Monitor: live network dashboard "
            + (enabled ? "enabled." : "disabled."));
    }
}
