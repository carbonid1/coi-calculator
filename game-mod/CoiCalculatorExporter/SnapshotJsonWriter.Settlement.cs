using System.Collections.Generic;

internal static partial class SnapshotJsonWriter
{
    private static void appendStrings(SnapshotJsonStream json, string key, List<string> values)
    {
        json.Name(key).BeginArray();
        for (int i = 0; i < values.Count; i++)
        {
            json.Value(values[i]);
        }
        json.EndArray();
    }

    private static void appendSettlementState(SnapshotJsonStream json, SettlementStateSnapshot state)
    {
        json.Name("settlement").BeginObject();
        json.Field("population", state.Population);
        json.Name("settlements").BeginArray();
        for (int i = 0; i < state.Settlements.Count; i++)
        {
            SettlementSnapshot item = state.Settlements[i];
            json.BeginObject();
            json.Name("housing").BeginArray();
            for (int h = 0; h < item.HousingEntityIds.Count; h++)
            {
                int id = item.HousingEntityIds[h];
                json.BeginObject();
                json.Field("entityId", id);
                json.Field("population", item.HousingPopulation[id]);
                json.Field("capacity", item.HousingCapacity[id]);
                json.EndObject();
            }
            json.EndArray();
            json.Field("population", item.Population);
            json.Field("capacity", item.Capacity);
            appendStrings(json, "foodProductIds", item.FoodProductIds);
            appendStrings(json, "serviceIds", item.ServiceIds);
            json.EndObject();
        }
        json.EndArray();
        json.Name("unity");
        if (state.Unity == null) json.Value((string)null);
        else
        {
            json.BeginArray();
            for (int i = 0; i < state.Unity.Count; i++)
            {
                SettlementUnitySnapshot item = state.Unity[i];
                json.BeginObject();
                json.Field("id", item.Id);
                json.Field("name", item.Name);
                appendDecimal(json, "amount", item.Amount);
                json.EndObject();
            }
            json.EndArray();
        }
        json.EndObject();
    }

    private static void appendWeatherConfig(SnapshotJsonStream json, WeatherConfigSnapshot weather)
    {
        json.Name("weather").BeginObject();
        json.Field("gameSeed", weather.Seed);
        json.Field("difficulty", weather.Difficulty);
        json.Name("weatherRngInitialState").BeginObject();
        json.Field("state0", weather.State0);
        json.Field("state1", weather.State1);
        json.Field("warmupSteps", 100);
        json.EndObject().EndObject();
    }
}
