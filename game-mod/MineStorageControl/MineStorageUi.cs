using System;
using System.Collections.Generic;
using CoI.AutoHelpers.Settings;
using Mafi;
using Mafi.Core.Simulation;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.InputControl;
using Mafi.Unity.Ui.Hud;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;
using Mafi.Unity.UiToolkit.Themes;

internal sealed class MineStorageUi : IDisposable
{
    private readonly MineStorageMonitor m_monitor;
    private readonly ISimLoopEvents m_events;
    private MineStoragePanel m_panel;
    private int m_updates;

    public MineStorageUi(ISimLoopEvents events, MineStorageMonitor monitor)
    {
        m_monitor = monitor;
        m_events = events;
        events.UpdateEndForUi.AddNonSaveable(this, update);
    }
    public void Initialize(DependencyResolver resolver)
    {
        ModSettings.EnsureInitialized(resolver.Resolve<HudController>(),
            resolver.Resolve<UiRoot>(), resolver.Resolve<IRootEscapeManager>());
        const string icon = "Assets/Unity/UserInterface/General/Configure.svg";
        ModSettings.RegisterTab(new ModSettingsTab("MineStorageControl",
            new LocStrFormatted("Mine Storage Control"), new LocStrFormatted("Rules"), 400,
            delegate {
                m_monitor.QueueRefresh();
                m_panel = new MineStoragePanel(m_monitor);
                return m_panel;
            }, icon, icon));
        Log.Info("Mine Storage Control: registered in cooperative Mod Settings hub.");
    }
    private void update()
    {
        if (m_panel != null && m_panel.IsAttached && ++m_updates % 11 == 0) m_panel.Refresh();
    }
    public void Dispose() { m_events.UpdateEndForUi.RemoveNonSaveable(this, update); }
}

internal sealed class MineStoragePanel : Column
{
    private readonly MineStorageMonitor m_monitor;
    private readonly Dropdown<MineStorageChoice> m_tower;
    private readonly Dropdown<MineStorageChoice> m_pauseStorage;
    private readonly Dropdown<MineStorageChoice> m_resumeStorage;
    private readonly TextField m_pause;
    private readonly TextField m_resume;
    private readonly Column m_rules;
    private readonly Column m_editor;
    private readonly Label m_editorTitle;
    private readonly Label m_hint;
    private readonly Label m_error;
    private readonly ButtonText m_new;
    private readonly ButtonText m_save;
    private readonly List<Label> m_statusLabels = new List<Label>();
    private readonly List<Label> m_pauseLabels = new List<Label>();
    private readonly List<Label> m_resumeLabels = new List<Label>();
    private MineStorageChoice[] m_towerOptions;
    private MineStorageChoice[] m_storageOptions;
    private string m_structure;
    private int m_editTower;
    private bool m_editEnabled = true;
    private bool m_saving;
    private volatile int m_saveResult;

    public MineStoragePanel(MineStorageMonitor monitor) : base(8.pt())
    {
        m_monitor = monitor;
        this.AlignItemsStretch().FlexGrow(1);
        Column body = new Column(10.pt()).AlignItemsStretch().Padding(6.pt());
        m_rules = new Column(12.pt()).AlignItemsStretch();
        body.Add(m_rules);
        m_new = button("New rule", beginNew);
        body.Add(new Row(6.pt()) { m_new });
        m_editor = new Column(6.pt()).AlignItemsStretch();
        m_editorTitle = new Label().FontBold().FlexGrow(1);
        m_editor.Add(new Row(6.pt()) { m_editorTitle,
            button("Refresh", delegate { m_monitor.QueueRefresh(); }) });
        m_tower = choiceDropdown("Mine control tower");
        m_tower.SetOptionEnabledPredicate(c => c.IsUnique && (c.Id == m_editTower
            || !Array.Exists(m_monitor.View.Rules, r => r.Rule.TowerId == c.Id)),
            c => new LocStrFormatted(c.IsUnique ? "This tower already has a rule." : "Give this building a unique name."));
        m_editor.Add(m_tower);
        m_pauseStorage = choiceDropdown("Pause storage");
        m_resumeStorage = choiceDropdown("Resume storage");
        m_pause = thresholdField("90");
        m_resume = thresholdField("10");
        m_editor.Add(conditionEditor("Pause", m_pauseStorage, "≥", m_pause));
        m_editor.Add(conditionEditor("Resume", m_resumeStorage, "≤", m_resume));
        m_save = button("Save rule", saveRule);
        m_editor.Add(new Row(6.pt()) { m_save, button("Cancel", cancelEditor) });
        m_hint = label("Name the tower and storages in game, then refresh.")
            .Color(Theme.InactiveColor).Hide();
        m_editor.Add(m_hint);
        body.Add(m_editor);
        m_error = new Label().Color(Theme.DangerColor).Hide();
        body.Add(m_error);
        ScrollColumn scroll = new ScrollColumn().AlignItemsStretch().FlexGrow(1);
        scroll.Add(body);
        Add(scroll);
        if (monitor.View.Rules.Length == 0) beginNew(); else m_editor.Hide();
        Refresh();
    }

    public void Refresh()
    {
        MineStorageView view = m_monitor.View;
        if (!Object.ReferenceEquals(m_towerOptions, view.Towers))
        {
            m_towerOptions = view.Towers;
            replaceOptions(m_tower, view.Towers);
            if (m_editTower > 0) select(m_tower, view.Towers, m_editTower);
        }
        if (!Object.ReferenceEquals(m_storageOptions, view.Storages))
        {
            m_storageOptions = view.Storages;
            replaceOptions(m_pauseStorage, view.Storages);
            replaceOptions(m_resumeStorage, view.Storages);
        }
        if (!Array.Exists(view.Towers, c => c.IsUnique) || !Array.Exists(view.Storages, c => c.IsUnique))
            m_hint.Show();
        else m_hint.Hide();
        string structure = MineStorageRuleCodec.Encode(Array.ConvertAll(view.Rules, r => r.Rule));
        foreach (MineStorageRuleView row in view.Rules)
            structure += "\n" + row.TowerTitle + "\n" + row.PauseTitle + "\n" + row.ResumeTitle;
        if (structure != m_structure)
        {
            m_structure = structure;
            m_rules.Clear();
            m_statusLabels.Clear(); m_pauseLabels.Clear(); m_resumeLabels.Clear();
            foreach (MineStorageRuleView row in view.Rules)
            {
                int towerId = row.Rule.TowerId;
                Toggle toggle = new Toggle().Value(row.Rule.Enabled);
                toggle.Tooltip(new LocStrFormatted("Off leaves the tower in its current pause state."));
                toggle.SetFocusable(true);
                toggle.OnValueChanged(value => m_monitor.QueueEnabled(towerId, value));
                Column group = new Column(3.pt()).AlignItemsStretch();
                Label status = label("").Color(Theme.InactiveColor);
                group.Add(new Row(6.pt()) { toggle,
                    label(row.TowerTitle).FontBold().FlexGrow(1), status,
                    button("Edit", delegate { editRule(towerId); }),
                    button("Remove", delegate { m_monitor.QueueRemove(towerId); }) });
                Label pauseFill = label("").Color(Theme.InactiveColor);
                Label resumeFill = label("").Color(Theme.InactiveColor);
                group.Add(conditionRow("Pause", row.PauseTitle, "≥", row.Rule.PausePercent, pauseFill));
                group.Add(conditionRow("Resume", row.ResumeTitle, "≤", row.Rule.ResumePercent, resumeFill));
                m_statusLabels.Add(status); m_pauseLabels.Add(pauseFill); m_resumeLabels.Add(resumeFill);
                m_rules.Add(group);
            }
        }
        for (int i = 0; i < view.Rules.Length; i++)
        {
            m_statusLabels[i].Value(new LocStrFormatted(view.Rules[i].Status));
            m_pauseLabels[i].Value(new LocStrFormatted(fill(view.Rules[i].PauseReading)));
            m_resumeLabels[i].Value(new LocStrFormatted(fill(view.Rules[i].ResumeReading)));
        }
        if (m_saving && m_saveResult != 0)
        {
            m_saving = false;
            m_save.RootElement.SetEnabled(true);
            if (m_saveResult > 0) cancelEditor();
        }
        if (view.Error != null) error(view.Error);
    }

    private void saveRule()
    {
        if (m_saving) return;
        MineStorageChoice tower = m_tower.SelectedValue;
        MineStorageChoice pause = m_pauseStorage.SelectedValue, resume = m_resumeStorage.SelectedValue;
        int high, low;
        if (tower == null || !tower.IsUnique) { error("Select a uniquely named Mine control tower."); return; }
        if (pause == null || resume == null || !pause.IsUnique || !resume.IsUnique)
        { error("Select both storages by their unique names."); return; }
        if (!Int32.TryParse(m_pause.GetText(), out high) || !Int32.TryParse(m_resume.GetText(), out low)
            || low < 0 || low > 100 || high < 0 || high > 100)
        { error("Use 0–100%."); return; }
        if (pause.Id == resume.Id && low >= high)
        { error("For the same storage, resume must be lower than pause."); return; }
        MineStorageRule rule = new MineStorageRule { TowerId = tower.Id,
            PauseStorage = sensor(pause), ResumeStorage = sensor(resume),
            PausePercent = high, ResumePercent = low, Enabled = m_editEnabled };
        m_error.Hide();
        m_saving = true; m_saveResult = 0;
        m_save.RootElement.SetEnabled(false);
        m_monitor.QueueSaveRule(rule, ok => m_saveResult = ok ? 1 : -1);
    }

    private void editRule(int towerId)
    {
        if (m_saving) return;
        MineStorageRuleView row = Array.Find(m_monitor.View.Rules, r => r.Rule.TowerId == towerId);
        if (row == null) return;
        m_editTower = towerId; m_editEnabled = row.Rule.Enabled;
        select(m_tower, m_towerOptions, towerId);
        m_tower.RootElement.SetEnabled(false);
        selectSensor(m_pauseStorage, row.Rule.PauseStorage);
        selectSensor(m_resumeStorage, row.Rule.ResumeStorage);
        m_pause.Text(row.Rule.PausePercent.ToString());
        m_resume.Text(row.Rule.ResumePercent.ToString());
        m_editorTitle.Value(new LocStrFormatted("Edit rule"));
        m_error.Hide(); m_editor.Show(); m_new.Hide();
    }

    private void beginNew()
    {
        if (m_saving) return;
        m_editTower = 0; m_editEnabled = true;
        m_tower.RootElement.SetEnabled(true);
        m_tower.SetValueIndex(-1, false);
        m_pauseStorage.SetValueIndex(-1, false); m_resumeStorage.SetValueIndex(-1, false);
        m_pause.Text("90"); m_resume.Text("10");
        m_editorTitle.Value(new LocStrFormatted("New rule"));
        m_error.Hide(); m_editor.Show(); m_new.Hide();
    }
    private void cancelEditor()
    {
        if (m_saving) return;
        m_editTower = 0;
        m_editor.Hide(); m_error.Hide(); m_new.Show();
    }
    private void selectSensor(Dropdown<MineStorageChoice> dropdown, MineStorageSensor sensor)
    { select(dropdown, m_storageOptions, sensor.StorageIds.Length == 1 ? sensor.StorageIds[0] : -1); }
    private static MineStorageSensor sensor(MineStorageChoice choice)
    { return new MineStorageSensor { ProductId = choice.ProductId, StorageIds = new int[] { choice.Id } }; }
    private void error(string message) { m_error.Value(new LocStrFormatted(message)).Show(); }
    private static string fill(MineStorageReading reading)
    { return reading.IsValid ? ((decimal)reading.Quantity * 100 / reading.Capacity).ToString("0.#") + "%" : "—"; }
    private static Label label(string text) { return new Label(new LocStrFormatted(text)); }
    private static ButtonText button(string text, Action action)
    { return new ButtonText(new LocStrFormatted(text), action).Compact().FlexShrink(0); }
    private static Row conditionEditor(string action, UiComponent dropdown, string comparison, TextField field)
    {
        return new Row(6.pt()) { label(action).Width(64.px()).FlexShrink(0), dropdown,
            label(comparison).FlexShrink(0), field, label("%").FlexShrink(0) };
    }
    private static Row conditionRow(string action, string name, string comparison, int threshold, Label current)
    {
        return new Row(6.pt()) { label(action).Width(64.px()).FlexShrink(0), label(name).FlexGrow(1),
            label(comparison + " " + threshold + "%").Width(70.px()).FlexShrink(0), current.Width(60.px()).FlexShrink(0) };
    }
    private static TextField thresholdField(string text)
    {
        return new TextField().Text(text).PositiveIntegersOnly()
            .ForFieldSetMinWidth(60.px()).ForFieldSetMaxWidth(60.px())
            .Width(60.px()).FlexGrow(0).FlexShrink(0);
    }
    private static Dropdown<MineStorageChoice> choiceDropdown(string placeholder)
    {
        return new Dropdown<MineStorageChoice>((choice, index, selected) => label(choice.Title))
            .SetSearchStringLookup(choice => choice.Title)
            .SetOptionEnabledPredicate(choice => choice.IsUnique,
                choice => new LocStrFormatted("Give this building a unique name."))
            .SetNoValueSelectedComponent(label(placeholder)).FlexGrow(1);
    }
    private static void replaceOptions(Dropdown<MineStorageChoice> dropdown, MineStorageChoice[] choices)
    {
        MineStorageChoice previous = dropdown.SelectedValue;
        dropdown.SetOptions(choices);
        select(dropdown, choices, previous == null ? -1 : previous.Id);
    }
    private static void select(Dropdown<MineStorageChoice> dropdown, MineStorageChoice[] choices, int id)
    { dropdown.SetValueIndex(choices == null ? -1 : Array.FindIndex(choices, choice => choice.Id == id), false); }
}
