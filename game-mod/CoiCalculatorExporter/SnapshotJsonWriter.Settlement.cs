using System.Collections.Generic;
using System.Text;

internal static partial class SnapshotJsonWriter
{
    private static void appendStrings(StringBuilder json, string key, List<string> values)
    {
        json.Append('"').Append(key).Append("\":[");
        for (int i = 0; i < values.Count; i++)
        {
            if (i > 0) json.Append(',');
            json.Append('"');
            appendEscapedString(json, values[i]);
            json.Append('"');
        }
        json.Append(']');
    }

    private static void appendSettlementState(StringBuilder json, SettlementStateSnapshot state)
    {
        json.Append("\"settlement\":{");
        appendNumber(json, "population", state.Population, true);
        json.Append("\"settlements\":[");
        for (int i = 0; i < state.Settlements.Count; i++)
        {
            if (i > 0) json.Append(',');
            SettlementSnapshot item = state.Settlements[i];
            json.Append("{\"housing\":[");
            for (int h = 0; h < item.HousingEntityIds.Count; h++)
            {
                if (h > 0) json.Append(',');
                int id = item.HousingEntityIds[h];
                json.Append('{');
                appendNumber(json, "entityId", id, true);
                appendNumber(json, "population", item.HousingPopulation[id], true);
                appendNumber(json, "capacity", item.HousingCapacity[id], false);
                json.Append('}');
            }
            json.Append("],");
            appendNumber(json, "population", item.Population, true);
            appendNumber(json, "capacity", item.Capacity, true);
            appendStrings(json, "foodProductIds", item.FoodProductIds);
            json.Append(',');
            appendStrings(json, "serviceIds", item.ServiceIds);
            json.Append('}');
        }
        json.Append("],\"unity\":");
        if (state.Unity == null) json.Append("null");
        else
        {
            json.Append('[');
            for (int i = 0; i < state.Unity.Count; i++)
            {
                if (i > 0) json.Append(',');
                SettlementUnitySnapshot item = state.Unity[i];
                json.Append('{');
                appendString(json, "id", item.Id, true);
                appendString(json, "name", item.Name, true);
                appendDecimal(json, "amount", item.Amount, false);
                json.Append('}');
            }
            json.Append(']');
        }
        json.Append("},");
    }

    private static void appendWeatherConfig(StringBuilder json, WeatherConfigSnapshot weather)
    {
        json.Append("\"weather\":{");
        appendString(json, "gameSeed", weather.Seed, true);
        appendString(json, "difficulty", weather.Difficulty, true);
        json.Append("\"weatherRngInitialState\":{");
        appendString(json, "state0", weather.State0, true);
        appendString(json, "state1", weather.State1, true);
        appendNumber(json, "warmupSteps", 100, false);
        json.Append("}},");
    }
}
