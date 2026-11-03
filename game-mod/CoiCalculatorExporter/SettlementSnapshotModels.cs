using System.Collections.Generic;

internal sealed class SettlementSnapshot
{
    public readonly List<int> HousingEntityIds;
    public readonly Dictionary<int, int> HousingPopulation;
    public readonly Dictionary<int, int> HousingCapacity;
    public readonly int Population;
    public readonly int Capacity;
    public readonly List<string> FoodProductIds;
    public readonly List<string> ServiceIds;

    public SettlementSnapshot(List<int> housingIds, Dictionary<int, int> housingPopulation,
        Dictionary<int, int> housingCapacity, int population, int capacity,
        List<string> foods, List<string> services)
    {
        HousingEntityIds = housingIds;
        HousingPopulation = housingPopulation;
        HousingCapacity = housingCapacity;
        Population = population;
        Capacity = capacity;
        FoodProductIds = foods;
        ServiceIds = services;
    }
}

internal sealed class SettlementUnitySnapshot
{
    public readonly string Id;
    public readonly string Name;
    public double Amount;

    public SettlementUnitySnapshot(string id, string name) { Id = id; Name = name; }
}

internal sealed class SettlementStateSnapshot
{
    public readonly int Population;
    public readonly List<SettlementSnapshot> Settlements;
    public readonly List<SettlementUnitySnapshot> Unity;

    public SettlementStateSnapshot(int population, List<SettlementSnapshot> settlements,
        List<SettlementUnitySnapshot> unity)
    {
        Population = population;
        Settlements = settlements;
        Unity = unity;
    }
}
