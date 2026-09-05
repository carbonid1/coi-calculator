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

internal sealed class WeatherConfigSnapshot
{
    public readonly string Seed;
    public readonly string Difficulty;
    public readonly string State0;
    public readonly string State1;

    public WeatherConfigSnapshot(string seed, string difficulty, string state0, string state1)
    {
        Seed = seed; Difficulty = difficulty; State0 = state0; State1 = state1;
    }
}
