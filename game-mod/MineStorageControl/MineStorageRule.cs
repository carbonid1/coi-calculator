using System;
using System.Collections.Generic;
using System.Globalization;

internal enum MineStorageAction { None, Pause, Resume }

internal sealed class MineStorageInventory
{
    public string ProductId;
    public long Quantity;
    public long Capacity;
}

internal sealed class MineStorageReading
{
    public long Quantity;
    public long Capacity;
    public string Error;
    public bool IsValid { get { return Error == null && Capacity > 0 && Quantity >= 0; } }
}

internal sealed class MineStorageSensor
{
    public string ProductId;
    // New rules select one container. Arrays preserve existing v1 aggregate rules.
    public int[] StorageIds;

    public MineStorageSensor Copy()
    {
        return new MineStorageSensor { ProductId = ProductId,
            StorageIds = StorageIds == null ? null : (int[])StorageIds.Clone() };
    }

    public bool IsValid()
    {
        if (String.IsNullOrEmpty(ProductId) || StorageIds == null || StorageIds.Length == 0)
            return false;
        HashSet<int> ids = new HashSet<int>();
        foreach (int id in StorageIds) if (id <= 0 || !ids.Add(id)) return false;
        return true;
    }

    public bool SameStorageAs(MineStorageSensor other)
    {
        return other != null && new HashSet<int>(StorageIds).SetEquals(other.StorageIds);
    }

    public MineStorageReading Read(Func<int, MineStorageInventory> resolve)
    {
        MineStorageReading reading = new MineStorageReading();
        if (!IsValid()) { reading.Error = "Select storage"; return reading; }
        long quantity = 0, capacity = 0;
        foreach (int id in StorageIds)
        {
            MineStorageInventory member = resolve(id);
            if (member == null) { reading.Error = "Storage unavailable"; return reading; }
            if (member.ProductId != ProductId)
            { reading.Error = "Storage product changed"; return reading; }
            if (member.Capacity <= 0 || member.Quantity < 0)
            { reading.Error = "Storage capacity unavailable"; return reading; }
            try
            {
                quantity = checked(quantity + member.Quantity);
                capacity = checked(capacity + member.Capacity);
            }
            catch (OverflowException)
            { reading.Error = "Storage capacity unavailable"; return reading; }
        }
        reading.Quantity = quantity;
        reading.Capacity = capacity;
        return reading;
    }
}

internal sealed class MineStorageRule
{
    public int TowerId;
    public MineStorageSensor PauseStorage;
    public MineStorageSensor ResumeStorage;
    public int PausePercent = 90;
    public int ResumePercent = 10;
    public bool Enabled = true;
    public bool OwnsPause;

    public MineStorageRule Copy()
    {
        MineStorageRule copy = (MineStorageRule)MemberwiseClone();
        copy.PauseStorage = PauseStorage == null ? null : PauseStorage.Copy();
        copy.ResumeStorage = ResumeStorage == null ? null : ResumeStorage.Copy();
        return copy;
    }

    public bool IsValid()
    {
        return TowerId > 0 && PauseStorage != null && PauseStorage.IsValid()
            && ResumeStorage != null && ResumeStorage.IsValid()
            && PausePercent >= 0 && PausePercent <= 100
            && ResumePercent >= 0 && ResumePercent <= 100
            && (!PauseStorage.SameStorageAs(ResumeStorage) || ResumePercent < PausePercent);
    }

    public MineStorageAction Evaluate(MineStorageReading pause, MineStorageReading resume,
        bool towerPaused)
    {
        if (!Enabled || !IsValid() || pause == null || resume == null
            || !pause.IsValid || !resume.IsValid) return MineStorageAction.None;
        bool full = (decimal)pause.Quantity * 100 >= (decimal)pause.Capacity * PausePercent;
        if (OwnsPause)
        {
            if (!towerPaused)
            {
                ManualOverride();
                return MineStorageAction.None;
            }
            // A full pause container wins when the two conditions are both true.
            if (!full && (decimal)resume.Quantity * 100 <= (decimal)resume.Capacity * ResumePercent)
                return MineStorageAction.Resume;
        }
        else if (!towerPaused && full) return MineStorageAction.Pause;
        return MineStorageAction.None;
    }

    public void ManualOverride() { Enabled = false; OwnsPause = false; }
}

internal static class MineStorageRuleCodec
{
    public static string Encode(IEnumerable<MineStorageRule> rules)
    {
        List<string> lines = new List<string>();
        lines.Add("2");
        foreach (MineStorageRule rule in rules)
            lines.Add(String.Join("|", new string[] {
                number(rule.TowerId), number(rule.PausePercent), number(rule.ResumePercent),
                rule.Enabled ? "1" : "0", rule.OwnsPause ? "1" : "0",
                Uri.EscapeDataString(rule.PauseStorage.ProductId), ids(rule.PauseStorage),
                Uri.EscapeDataString(rule.ResumeStorage.ProductId), ids(rule.ResumeStorage) }));
        return String.Join("\n", lines.ToArray());
    }

    public static List<MineStorageRule> Decode(string text)
    {
        List<MineStorageRule> rules = new List<MineStorageRule>();
        if (String.IsNullOrEmpty(text)) return rules;
        string[] lines = text.Split('\n');
        bool legacy = lines[0] == "1";
        if (!legacy && lines[0] != "2") throw new FormatException("Unsupported mine rule version.");
        HashSet<int> towers = new HashSet<int>();
        for (int i = 1; i < lines.Length; i++)
        {
            string[] f = lines[i].Split('|');
            if (f.Length != (legacy ? 7 : 9)) throw new FormatException("Invalid mine rule.");
            MineStorageRule rule = new MineStorageRule { TowerId = parse(f[0]) };
            if (legacy)
            {
                rule.PausePercent = parse(f[2]); rule.ResumePercent = parse(f[3]);
                rule.Enabled = flag(f[4]); rule.OwnsPause = flag(f[5]);
                rule.PauseStorage = sensor(f[1], f[6]);
                rule.ResumeStorage = rule.PauseStorage.Copy();
            }
            else
            {
                rule.PausePercent = parse(f[1]); rule.ResumePercent = parse(f[2]);
                rule.Enabled = flag(f[3]); rule.OwnsPause = flag(f[4]);
                rule.PauseStorage = sensor(f[5], f[6]); rule.ResumeStorage = sensor(f[7], f[8]);
            }
            if (!rule.IsValid() || !towers.Add(rule.TowerId) || (!rule.Enabled && rule.OwnsPause))
                throw new FormatException("Invalid mine rule members or thresholds.");
            rules.Add(rule);
        }
        return rules;
    }

    private static MineStorageSensor sensor(string product, string ids)
    {
        return new MineStorageSensor { ProductId = Uri.UnescapeDataString(product),
            StorageIds = Array.ConvertAll(ids.Split(','), parse) };
    }
    private static string ids(MineStorageSensor sensor)
    { return String.Join(",", Array.ConvertAll(sensor.StorageIds, number)); }
    private static string number(int value) { return value.ToString(CultureInfo.InvariantCulture); }
    private static int parse(string value) { return Int32.Parse(value, CultureInfo.InvariantCulture); }
    private static bool flag(string value)
    {
        if (value != "0" && value != "1") throw new FormatException("Invalid mine rule flag.");
        return value == "1";
    }
}
