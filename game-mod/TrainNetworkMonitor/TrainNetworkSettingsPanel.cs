using System;

using CoI.AutoHelpers.Settings;
using Mafi;
using Mafi.Core.Mods;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;
using Mafi.Unity.UiToolkit.Themes;

internal sealed class TrainNetworkSettingsPanel : Column
{
    private static readonly Px InnerGap = 2.pt();
    private static readonly Px ModifiedBorder = 1.pt();

    private readonly ModJsonConfig m_jsonConfig;
    private readonly Action<bool> m_onDashboardEnabledChanged;

    public TrainNetworkSettingsPanel(
        ModJsonConfig jsonConfig,
        Action<bool> onDashboardEnabledChanged)
        : base(8.pt())
    {
        m_jsonConfig = jsonConfig;
        m_onDashboardEnabledChanged = onDashboardEnabledChanged;
        this.AlignItemsStretch().PaddingBottom(10.pt());
        Add(createDashboardControl());
        Add(createStuckAfterControl());
        Add(createPauseControl());
    }

    private UiComponent createDashboardControl()
    {
        Toggle toggle = new Toggle()
            .JustifyItemsStart()
            .Value(m_jsonConfig.GetBool(TrainNetworkSettingsKeys.DashboardEnabled));
        Column row = new Column(InnerGap);
        row.AlignItemsStretch().PaddingLeft(2.pt());
        row.Add(createHeader(
            "Capacity dashboard",
            "Shows live Train Network capacity. Off stops dashboard updates."));
        row.Add(new Row(1.pt()) { toggle });

        updateModifiedBorder(
            row,
            m_jsonConfig.GetBool(TrainNetworkSettingsKeys.DashboardEnabled));
        toggle.OnValueChanged(delegate(bool value)
        {
            string error;
            if (m_jsonConfig.TrySetValue(
                TrainNetworkSettingsKeys.DashboardEnabled,
                value,
                out error))
            {
                bool isEnabled = m_jsonConfig.GetBool(
                    TrainNetworkSettingsKeys.DashboardEnabled);
                m_onDashboardEnabledChanged(isEnabled);
                updateModifiedBorder(row, isEnabled);
            }
        });
        return row;
    }

    private UiComponent createStuckAfterControl()
    {
        Label errorLabel = new Label()
            .Color(Theme.DangerColor)
            .FontSize(12)
            .Hide();
        TextField field = new TextField()
            .Text(m_jsonConfig.GetInt(TrainNetworkSettingsKeys.StuckAfterCycles).ToString())
            .PositiveIntegersOnly();
        Column row = new Column(InnerGap);
        row.AlignItemsStretch().PaddingLeft(2.pt());
        row.Add(createHeader(
            "Jam alert delay",
            "Blocked time before a train counts toward the jam alert (1–12 months)."));
        row.Add(new Row(1.pt()) { field });
        row.Add(errorLabel);

        updateModifiedBorder(
            row,
            m_jsonConfig.GetInt(TrainNetworkSettingsKeys.StuckAfterCycles)
                != TrainNetworkSettingsKeys.DefaultStuckAfterCycles);
        field.OnEditEnd(delegate(string text)
        {
            int value;
            string error;
            if (!Int32.TryParse(text, out value))
            {
                errorLabel.Value(new LocStrFormatted("A whole number is required.")).Show();
            }
            else if (!m_jsonConfig.TrySetValue(
                TrainNetworkSettingsKeys.StuckAfterCycles,
                value,
                out error))
            {
                errorLabel.Value(new LocStrFormatted(
                    error.Replace(
                        " for '" + TrainNetworkSettingsKeys.StuckAfterCycles + "'",
                        ""))).Show();
            }
            else
            {
                errorLabel.Hide();
            }

            updateModifiedBorder(
                row,
                m_jsonConfig.GetInt(TrainNetworkSettingsKeys.StuckAfterCycles)
                    != TrainNetworkSettingsKeys.DefaultStuckAfterCycles);
        });
        return row;
    }

    private UiComponent createPauseControl()
    {
        Toggle toggle = new Toggle()
            .JustifyItemsStart()
            .Value(m_jsonConfig.GetBool(TrainNetworkSettingsKeys.PauseOnRedAlert));
        Column row = new Column(InnerGap);
        row.AlignItemsStretch().PaddingLeft(2.pt());
        row.Add(createHeader(
            "Pause on jam alert",
            "Pause once when a new jam alert starts."));
        row.Add(new Row(1.pt()) { toggle });

        updateModifiedBorder(
            row,
            m_jsonConfig.GetBool(TrainNetworkSettingsKeys.PauseOnRedAlert));
        toggle.OnValueChanged(delegate(bool value)
        {
            string error;
            m_jsonConfig.TrySetValue(TrainNetworkSettingsKeys.PauseOnRedAlert, value, out error);
            updateModifiedBorder(
                row,
                m_jsonConfig.GetBool(TrainNetworkSettingsKeys.PauseOnRedAlert));
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
