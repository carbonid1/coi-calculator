using System;
using System.Collections.Generic;

internal static class MineStorageRuleTests
{
    private static int checks;
    private static void expect(bool condition, string message)
    { checks++; if (!condition) throw new Exception(message); }
    private static MineStorageSensor sensor(int id, string product)
    { return new MineStorageSensor { ProductId = product, StorageIds = new int[] { id } }; }
    private static MineStorageRule rule()
    { return new MineStorageRule { TowerId = 12, PauseStorage = sensor(4, "IronOre"), ResumeStorage = sensor(5, "IronOre") }; }
    private static MineStorageReading reading(long quantity, long capacity)
    { return new MineStorageReading { Quantity = quantity, Capacity = capacity }; }
    private static MineStorageRule reload(MineStorageRule r)
    { return MineStorageRuleCodec.Decode(MineStorageRuleCodec.Encode(new MineStorageRule[] { r }))[0]; }
    private static void rejected(string encoded)
    {
        bool rejected = false;
        try { MineStorageRuleCodec.Decode(encoded); }
        catch (FormatException) { rejected = true; }
        expect(rejected, "Reject invalid saved rule: " + encoded);
    }

    public static void Main()
    {
        independentContainers();
        unavailableAndManualControl();
        persistenceAndMigration();
        Console.WriteLine("Passed " + checks + " mine storage regression checks.");
    }

    private static void independentContainers()
    {
        MineStorageRule r = rule();
        MineStorageReading a = reading(53999, 60000), b = reading(0, 12000);
        expect(r.Evaluate(a, b, false) == MineStorageAction.None, "Do not pause below the upper boundary");
        a.Quantity = 54000;
        expect(r.Evaluate(a, b, false) == MineStorageAction.Pause, "Pause at A's upper boundary even when B is empty");
        r.OwnsPause = true;
        expect(r.Evaluate(a, b, true) == MineStorageAction.None, "Pause takes priority while A is still full");
        a.Quantity = 53999; b.Quantity = 1201;
        expect(r.Evaluate(a, b, true) == MineStorageAction.None, "Wait for B, not A, to reach the lower boundary");
        r = reload(r);
        expect(r.OwnsPause && r.PauseStorage.StorageIds[0] == 4 && r.ResumeStorage.StorageIds[0] == 5,
            "Save/load preserves independent sensors and pause ownership");
        expect(r.Evaluate(a, b, true) == MineStorageAction.None, "Reloaded waiting rule stays paused");
        b.Quantity = 1200;
        expect(r.Evaluate(a, b, true) == MineStorageAction.Resume, "Resume exactly at B's lower boundary");
        MineStorageRule second = rule(); second.TowerId = 13;
        expect(!second.OwnsPause && second.Evaluate(a, b, true) == MineStorageAction.None,
            "A second tower sharing the containers cannot inherit pause ownership");
        r.OwnsPause = false;
        expect(r.Evaluate(a, b, false) == MineStorageAction.None, "Resumed tower stays running until A fills again");
        r.ResumeStorage = r.PauseStorage.Copy(); r.ResumePercent = 90;
        expect(!r.IsValid(), "Same container requires separated thresholds");
        r.ResumePercent = 10; a.Quantity = 6000; r.OwnsPause = true;
        expect(r.IsValid() && r.Evaluate(a, a, true) == MineStorageAction.Resume, "Same container supports normal hysteresis");
        r = rule(); r.PausePercent = 20; r.ResumePercent = 80;
        expect(r.IsValid(), "Independent sensors allow independent threshold ranges");
        r.PausePercent = 100; r.ResumePercent = 0;
        expect(r.Evaluate(reading(Int64.MaxValue, Int64.MaxValue), reading(0, 1), false)
            == MineStorageAction.Pause, "100% and large inventories do not overflow comparisons");
        r.OwnsPause = true;
        expect(r.Evaluate(reading(0, 1), reading(0, 1), true) == MineStorageAction.Resume, "Support exactly empty resume threshold");
    }

    private static void unavailableAndManualControl()
    {
        Dictionary<int, MineStorageInventory> storages = new Dictionary<int, MineStorageInventory>();
        storages[4] = new MineStorageInventory { ProductId = "IronOre", Quantity = 0, Capacity = 60000 };
        storages[5] = new MineStorageInventory { ProductId = "IronOre", Quantity = 0, Capacity = 12000 };
        Func<int, MineStorageInventory> resolve = id => storages.ContainsKey(id) ? storages[id] : null;
        MineStorageRule r = rule(); r.OwnsPause = true;
        foreach (int id in new int[] { 4, 5 })
        {
            MineStorageInventory inventory = storages[id]; storages.Remove(id);
            expect(r.Evaluate(r.PauseStorage.Read(resolve), r.ResumeStorage.Read(resolve), true) == MineStorageAction.None,
                "Missing either container suspends resume");
            storages[id] = inventory; inventory.ProductId = "CopperOre";
            expect(r.Evaluate(r.PauseStorage.Read(resolve), r.ResumeStorage.Read(resolve), true) == MineStorageAction.None,
                "Repurposing either container suspends resume");
            inventory.ProductId = "IronOre"; inventory.Capacity = 0;
            expect(r.Evaluate(r.PauseStorage.Read(resolve), r.ResumeStorage.Read(resolve), true) == MineStorageAction.None,
                "Invalid capacity on either container suspends resume");
            inventory.Capacity = id == 4 ? 60000 : 12000;
        }
        expect(r.Evaluate(r.PauseStorage.Read(resolve), r.ResumeStorage.Read(resolve), true) == MineStorageAction.Resume,
            "Restoring both sensors permits resume");
        r.OwnsPause = false;
        expect(r.Evaluate(reading(0, 1), reading(0, 1), true) == MineStorageAction.None, "Never resume a manually paused tower");
        r.OwnsPause = true;
        expect(r.Evaluate(reading(0, 1), reading(0, 1), false) == MineStorageAction.None && !r.Enabled && !r.OwnsPause,
            "Manual unpause disables automation and releases ownership");
        expect(r.Evaluate(reading(1, 1), reading(0, 1), false) == MineStorageAction.None, "Off cannot pause mining");
        MineStorageSensor legacy = new MineStorageSensor { ProductId = "IronOre", StorageIds = new int[] { 4, 5 } };
        storages[4].Quantity = 10000; storages[4].Capacity = 10000;
        storages[5].Quantity = 20000; storages[5].Capacity = 50000;
        MineStorageReading combined = legacy.Read(resolve);
        expect(combined.IsValid && combined.Quantity == 30000 && combined.Capacity == 60000,
            "Legacy uneven groups retain combined inventory");
        storages.Remove(5); combined = legacy.Read(resolve);
        expect(!combined.IsValid && combined.Capacity == 0 && combined.Quantity == 0,
            "Partial legacy group cannot report a misleading total");
        storages[4].Quantity = Int64.MaxValue; storages[4].Capacity = Int64.MaxValue;
        storages[5] = new MineStorageInventory { ProductId = "IronOre", Quantity = 1, Capacity = 1 };
        expect(!legacy.Read(resolve).IsValid, "Aggregate overflow suspends decisions");
    }

    private static void persistenceAndMigration()
    {
        MineStorageRule r = rule(); r.ResumeStorage.ProductId = "Mixed|Ore%"; r.OwnsPause = true;
        MineStorageRule copy = reload(r);
        expect(copy.ResumeStorage.ProductId == "Mixed|Ore%" && copy.OwnsPause,
            "Round trip independent products and ownership");
        copy = r.Copy();
        copy.PauseStorage.StorageIds[0] = 99;
        copy.ResumeStorage.StorageIds[0] = 98;
        expect(r.PauseStorage.StorageIds[0] == 4, "Copied sensors do not alias original arrays");
        expect(r.ResumeStorage.StorageIds[0] == 5, "Resume sensor copy is independent too");
        copy = MineStorageRuleCodec.Decode("1\n12|IronOre|90|10|1|1|4")[0];
        expect(copy.OwnsPause && copy.PauseStorage.SameStorageAs(copy.ResumeStorage), "Migrate old single-container rule");
        copy = MineStorageRuleCodec.Decode("1\n12|IronOre|90|10|1|1|4,5")[0];
        expect(copy.PauseStorage.StorageIds.Length == 2 && reload(copy).ResumeStorage.StorageIds.Length == 2,
            "Preserve existing groups through migration without silently choosing one member");
        rejected("1\n12|IronOre|90|10|1|1|4,4");
        rejected("2\n12|90|90|1|0|IronOre|4|IronOre|4");
        rejected("2\n12|90|10|0|1|IronOre|4|IronOre|5");
        rejected("2\n12|90|10|x|0|IronOre|4|IronOre|5");
        rejected("2\n12|90|10|1|0|IronOre|4|IronOre|0");
        rejected("2\n12|101|10|1|0|IronOre|4|IronOre|5");
        rejected("2\n12|90|-1|1|0|IronOre|4|IronOre|5");
        rejected(MineStorageRuleCodec.Encode(new MineStorageRule[] { rule(), rule() }));
        rejected("3");
    }
}
