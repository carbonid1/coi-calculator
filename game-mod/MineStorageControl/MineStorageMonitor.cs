using System;
using System.Collections.Generic;
using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Mine;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Mods;

internal sealed class MineStorageChoice
{
    public int Id;
    public string Title;
    public string ProductId;
    public bool IsUnique;
    public override string ToString() { return Title; }
}

internal sealed class MineStorageRuleView
{
    public MineStorageRule Rule;
    public string TowerTitle;
    public string PauseTitle;
    public string ResumeTitle;
    public string Status;
    public MineStorageReading PauseReading;
    public MineStorageReading ResumeReading;
}

internal sealed class MineStorageView
{
    public MineStorageChoice[] Towers = new MineStorageChoice[0];
    public MineStorageChoice[] Storages = new MineStorageChoice[0];
    public MineStorageRuleView[] Rules = new MineStorageRuleView[0];
    public string Error;
}

internal sealed class MineStorageMonitor : IDisposable
{
    private readonly EntitiesManager m_entities;
    private readonly ModJsonConfig m_config;
    private readonly List<MineStorageRule> m_rules;
    private readonly Queue<Action> m_pending = new Queue<Action>();
    private readonly bool m_loadFailed;
    private volatile MineStorageView m_view = new MineStorageView();
    private bool m_applyingPause;
    private bool m_refreshChoices = true;
    private string m_error;
    public MineStorageView View { get { return m_view; } }

    public MineStorageMonitor(EntitiesManager entities, ModJsonConfig config)
    {
        m_entities = entities;
        m_config = config;
        try { m_rules = MineStorageRuleCodec.Decode(config.GetString("rules", "")); }
        catch (Exception exception)
        {
            m_rules = new List<MineStorageRule>();
            m_loadFailed = true;
            m_error = "Saved rules could not be loaded.";
            Log.Error("Mine Storage Control: invalid saved rules: " + exception);
        }
        entities.EntityPauseStateChanged.AddNonSaveable(this, onPauseChanged);
    }

    public void QueueRefresh()
    {
        enqueue(delegate { m_refreshChoices = true; if (!m_loadFailed) m_error = null; });
    }
    public void QueueSaveRule(MineStorageRule rule, Action<bool> completed)
    {
        MineStorageRule copy = rule.Copy();
        enqueue(delegate {
            MineStorageChoice[] towers = collectChoices(true), storages = collectChoices(false);
            if (m_loadFailed || !copy.IsValid())
                m_error = m_loadFailed ? "Saved rules could not be loaded." : "Check the storages and thresholds.";
            else if (!selectable(towers, copy.TowerId, null)
                || !selectableSensor(storages, copy.PauseStorage)
                || !selectableSensor(storages, copy.ResumeStorage))
                m_error = "Give the tower and both storages unique names, then refresh.";
            else if (!copy.PauseStorage.Read(readStorage).IsValid
                || !copy.ResumeStorage.Read(readStorage).IsValid)
                m_error = "Storage changed. Refresh and select it again.";
            else
            {
                MineStorageRule previous = m_rules.Find(r => r.TowerId == copy.TowerId);
                // The list toggle and manual overrides may change while the editor is open.
                if (previous != null) copy.Enabled = previous.Enabled;
                copy.OwnsPause = previous != null && previous.OwnsPause && copy.Enabled;
                if (previous != null) m_rules.Remove(previous);
                m_rules.Add(copy);
                m_rules.Sort((a, b) => a.TowerId.CompareTo(b.TowerId));
                m_error = null;
                Save();
                completed(true);
                m_refreshChoices = true;
                return;
            }
            m_refreshChoices = true;
            completed(false);
        });
    }
    private static bool selectable(MineStorageChoice[] choices, int id, string product)
    {
        return Array.Exists(choices, c => c.Id == id && c.IsUnique
            && (product == null || product == c.ProductId));
    }
    private static bool selectableSensor(MineStorageChoice[] choices, MineStorageSensor sensor)
    {
        return sensor.StorageIds.Length == 1 && selectable(choices, sensor.StorageIds[0], sensor.ProductId);
    }
    public void QueueRemove(int towerId)
    {
        enqueue(delegate { m_rules.RemoveAll(r => r.TowerId == towerId); Save(); });
    }
    public void QueueEnabled(int towerId, bool enabled)
    {
        enqueue(delegate {
            MineStorageRule rule = m_rules.Find(r => r.TowerId == towerId);
            if (rule == null) return;
            rule.Enabled = enabled;
            if (!enabled) rule.OwnsPause = false;
            Save();
        });
    }

    private void enqueue(Action action) { lock (m_pending) m_pending.Enqueue(action); }

    public void Update()
    {
        lock (m_pending) while (m_pending.Count > 0) m_pending.Dequeue()();
        MineStorageView view = new MineStorageView { Error = m_error,
            Towers = m_view.Towers, Storages = m_view.Storages };
        if (m_refreshChoices)
        {
            view.Towers = collectChoices(true);
            view.Storages = collectChoices(false);
            m_refreshChoices = false;
        }
        List<MineStorageRuleView> rules = new List<MineStorageRuleView>();
        foreach (MineStorageRule rule in m_rules)
        {
            MineTower tower;
            MineStorageRuleView row = new MineStorageRuleView {
                TowerTitle = "Mine control tower unavailable",
                PauseTitle = sensorTitle(rule.PauseStorage), ResumeTitle = sensorTitle(rule.ResumeStorage),
                PauseReading = rule.PauseStorage.Read(readStorage),
                ResumeReading = rule.ResumeStorage.Read(readStorage) };
            if (!m_entities.TryGetEntity(new EntityId(rule.TowerId), out tower)
                || tower.IsDestroyed || !tower.IsConstructed)
                row.Status = "Tower unavailable";
            else
            {
                row.TowerTitle = tower.GetTitle();
                if (!rule.Enabled) row.Status = "Off";
                else if (!row.PauseReading.IsValid) row.Status = "Pause: " + row.PauseReading.Error;
                else if (!row.ResumeReading.IsValid) row.Status = "Resume: " + row.ResumeReading.Error;
                else
                {
                    bool wasEnabled = rule.Enabled;
                    MineStorageAction action = rule.Evaluate(row.PauseReading, row.ResumeReading, tower.IsPaused);
                    if (action != MineStorageAction.None)
                    {
                        m_applyingPause = true;
                        try
                        {
                            tower.SetPaused(action == MineStorageAction.Pause);
                            rule.OwnsPause = action == MineStorageAction.Pause;
                        }
                        finally { m_applyingPause = false; }
                        Save();
                    }
                    else if (wasEnabled != rule.Enabled) Save();
                    row.Status = !rule.Enabled ? "Off" : rule.OwnsPause ? "Waiting"
                        : tower.IsPaused ? "Manually paused" : "Running";
                }
            }
            row.Rule = rule.Copy();
            rules.Add(row);
        }
        view.Rules = rules.ToArray();
        m_view = view;
    }

    private string sensorTitle(MineStorageSensor sensor)
    {
        if (sensor.StorageIds.Length != 1) return sensor.StorageIds.Length + " storages";
        Storage storage;
        return m_entities.TryGetEntity(new EntityId(sensor.StorageIds[0]), out storage)
            && !storage.IsDestroyed ? storage.GetTitle() : "Storage unavailable";
    }

    private MineStorageInventory readStorage(int id)
    {
        Storage storage;
        if (!m_entities.TryGetEntity(new EntityId(id), out storage)
            || storage.IsDestroyed || !storage.IsConstructed) return null;
        return new MineStorageInventory {
            ProductId = storage.StoredProduct.HasValue ? storage.StoredProduct.Value.Id.ToString() : null,
            Quantity = storage.CurrentQuantity.Value, Capacity = storage.Capacity.Value };
    }

    private MineStorageChoice[] collectChoices(bool towers)
    {
        List<MineStorageChoice> choices = new List<MineStorageChoice>();
        Dictionary<string, int> counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (IEntity entity in m_entities.Entities)
        {
            MineTower tower = entity as MineTower;
            Storage storage = entity as Storage;
            if (towers ? tower == null || !tower.IsConstructed || tower.IsDestroyed
                : storage == null || !storage.IsConstructed || storage.IsDestroyed || !storage.StoredProduct.HasValue)
                continue;
            IObjectWithCustomTitle named = entity as IObjectWithCustomTitle;
            if (named == null || !named.CustomTitle.HasValue) continue;
            string name = named.CustomTitle.Value.Trim();
            if (name.Length == 0) continue;
            choices.Add(new MineStorageChoice { Id = entity.Id.Value, Title = name,
                ProductId = towers ? null : storage.StoredProduct.Value.Id.ToString() });
            int count;
            counts.TryGetValue(name, out count);
            counts[name] = count + 1;
        }
        foreach (MineStorageChoice choice in choices) choice.IsUnique = counts[choice.Title] == 1;
        choices.Sort((a, b) => String.Compare(a.Title, b.Title, StringComparison.CurrentCulture));
        return choices.ToArray();
    }

    private void onPauseChanged(IEntity entity, bool paused)
    {
        if (m_applyingPause) return;
        bool changed = false;
        foreach (MineStorageRule rule in m_rules)
            if (rule.Enabled && rule.TowerId == entity.Id.Value)
            { rule.ManualOverride(); changed = true; }
        if (changed) Save();
    }

    public void Save()
    {
        if (m_loadFailed) return;
        string error;
        if (!m_config.TrySetValue("rules", MineStorageRuleCodec.Encode(m_rules), out error))
            Log.Error("Mine Storage Control: saving rules failed: " + error);
    }

    public void Dispose() { m_entities.EntityPauseStateChanged.RemoveNonSaveable(this, onPauseChanged); }
}
