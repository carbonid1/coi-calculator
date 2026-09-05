using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Settlements;
using Mafi.Core.Entities;
using Mafi.Core.Game;
using Mafi.Core.Population;

internal sealed partial class GameSnapshotCollector
{
    private readonly SettlementsManager m_settlementsManager;
    private readonly UpointsManager m_upointsManager;
    private readonly WeatherConfigSnapshot m_weatherConfig;

    // Read only the settlement managers' already-maintained collections and totals.
    private SettlementStateSnapshot getSettlementState()
    {
        List<SettlementSnapshot> settlements = new List<SettlementSnapshot>();
        HashSet<string> unityCategories = new HashSet<string>(StringComparer.Ordinal);
        unityCategories.Add(IdsCore.UpointsCategories.Health.ToString());
        unityCategories.Add(IdsCore.UpointsCategories.SettlementQuality.ToString());
        unityCategories.Add(IdsCore.UpointsCategories.Homeless.ToString());
        unityCategories.Add(IdsCore.UpointsCategories.Starvation.ToString());

        foreach (Settlement settlement in m_settlementsManager.Settlements)
        {
            List<int> housingIds = new List<int>();
            Dictionary<int, int> housingPopulation = new Dictionary<int, int>();
            Dictionary<int, int> housingCapacity = new Dictionary<int, int>();
            foreach (SettlementHousingModule housing in settlement.HousingModules)
            {
                housingIds.Add(housing.Id.Value);
                housingPopulation.Add(housing.Id.Value, housing.Population);
                housingCapacity.Add(housing.Id.Value, housing.Capacity);
            }
            housingIds.Sort();

            List<string> foods = new List<string>();
            foreach (var food in settlement.FoodTypesMap)
            {
                if (food.Value.Capacity.Value > 0)
                {
                    foods.Add(food.Key.Id.ToString());
                }
            }
            foods.Sort(StringComparer.Ordinal);

            List<string> services = new List<string>();
            foreach (PopNeed need in settlement.AllNeeds)
            {
                unityCategories.Add(need.Proto.UpointsCategory.Id.ToString());
                bool hasActiveService = false;
                foreach (var module in need.ModulesProvidingTheNeed)
                {
                    IEntity entity = module as IEntity;
                    if (entity != null && !entity.IsPaused) hasActiveService = true;
                }
                if (need.IsHealthcareNeed)
                {
                    foreach (var hospital in settlement.AllHospitals)
                    {
                        if (!hospital.IsPaused) hasActiveService = true;
                    }
                }
                if (hasActiveService)
                {
                    services.Add(need.Proto.Id.ToString());
                }
            }
            services.Sort(StringComparer.Ordinal);
            settlements.Add(new SettlementSnapshot(
                housingIds, housingPopulation, housingCapacity,
                settlement.Population, settlement.TotalHousingCapacity, foods, services));
        }
        settlements.Sort(delegate(SettlementSnapshot left, SettlementSnapshot right)
        {
            return (left.HousingEntityIds.Count == 0 ? -1 : left.HousingEntityIds[0])
                .CompareTo(right.HousingEntityIds.Count == 0 ? -1 : right.HousingEntityIds[0]);
        });

        Dictionary<string, SettlementUnitySnapshot> unity =
            new Dictionary<string, SettlementUnitySnapshot>(StringComparer.Ordinal);
        foreach (UpointsStats.Entry entry in m_upointsManager.Stats.ThisMonthRecords)
        {
            string id = entry.Category.Id.ToString();
            if (!unityCategories.Contains(id) || entry.Category.IsOneTimeAction)
            {
                continue;
            }
            SettlementUnitySnapshot item;
            if (!unity.TryGetValue(id, out item))
            {
                item = new SettlementUnitySnapshot(id, entry.Category.Title.TranslatedString);
                unity.Add(id, item);
            }
            // Settlement records already include service coverage, food variety,
            // decorations, health, and the game's modifiers. Do not multiply again.
            item.Amount += entry.Exchanged.Value.ToDouble();
        }
        List<SettlementUnitySnapshot> unityEntries = new List<SettlementUnitySnapshot>(unity.Values);
        unityEntries.Sort(delegate(SettlementUnitySnapshot left, SettlementUnitySnapshot right)
        {
            return String.Compare(left.Id, right.Id, StringComparison.Ordinal);
        });
        int population = m_settlementsManager.GetTotalPopulation();
        return new SettlementStateSnapshot(population, settlements,
            unityEntries.Count > 0 || population == 0 ? unityEntries : null);
    }

    private static WeatherConfigSnapshot getWeatherConfig(DependencyResolver resolver)
    {
        string seed = resolver.Resolve<RandomSeedConfig>().MasterRandomSeed;
        string difficulty = resolver.Resolve<GameDifficultyConfig>().WeatherDifficulty.ToString();
        // Reproduce the initial seed without touching the simulation's RNG.
        byte[] hash;
        using (MD5 md5 = MD5.Create())
        {
            hash = md5.ComputeHash(Encoding.UTF8.GetBytes(seed + "WeatherDefaultWeatherProvider"));
        }
        return new WeatherConfigSnapshot(seed, difficulty,
            "0x" + BitConverter.ToUInt64(hash, 0).ToString("x16", CultureInfo.InvariantCulture),
            "0x" + BitConverter.ToUInt64(hash, 8).ToString("x16", CultureInfo.InvariantCulture));
    }
}
