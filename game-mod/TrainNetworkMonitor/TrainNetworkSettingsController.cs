using System;

using CoI.AutoHelpers.Settings;
using Mafi;
using Mafi.Core.Mods;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.InputControl;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiStatic.Toolbar;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Library;

internal sealed class TrainNetworkSettingsController
    : WindowController<TrainNetworkSettingsWindow>, IToolbarItemController
{
    private const string SettingsIconPath =
        "Assets/Unity/UserInterface/General/Configure.svg";

    private readonly ModJsonConfig m_jsonConfig;
    private readonly Action<bool> m_onDashboardEnabledChanged;

    public TrainNetworkSettingsController(
        ControllerContext context,
        ToolbarHud toolbarHud,
        ModJsonConfig jsonConfig,
        Action<bool> onDashboardEnabledChanged)
        : base(context, null)
    {
        m_jsonConfig = jsonConfig;
        m_onDashboardEnabledChanged = onDashboardEnabledChanged;
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
        return new TrainNetworkSettingsWindow(
            m_jsonConfig,
            m_onDashboardEnabledChanged);
    }
}

internal sealed class TrainNetworkSettingsWindow : Window
{
    public TrainNetworkSettingsWindow(
        ModJsonConfig jsonConfig,
        Action<bool> onDashboardEnabledChanged)
        : base(new LocStrFormatted("Train Network Monitor"), false)
    {
        WindowWidth(560.px());
        WindowMaxHeight(Percent.FromPercentVal(85));
        CloseOnClickOutside();
        AddBodySingle(new TrainNetworkSettingsPanel(
            jsonConfig,
            onDashboardEnabledChanged));
    }
}
