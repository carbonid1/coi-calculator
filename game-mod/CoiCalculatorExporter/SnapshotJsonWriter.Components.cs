using System.Collections.Generic;
using System.Globalization;
using System.Text;

internal static partial class SnapshotJsonWriter
{
    private static void appendNumber(
        StringBuilder json,
        string name,
        int value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        json.Append(value.ToString(CultureInfo.InvariantCulture));
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendDecimal(
        StringBuilder json,
        string name,
        double value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        json.Append(value.ToString("0.######", CultureInfo.InvariantCulture));
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableDecimal(
        StringBuilder json,
        string name,
        double? value,
        bool trailingComma)
    {
        json.Append('"');
        json.Append(name);
        json.Append("\":");
        if (value.HasValue)
        {
            json.Append(value.Value.ToString("0.######", CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableNumber(
        StringBuilder json,
        string name,
        int? value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        if (value.HasValue)
        {
            json.Append(value.Value.ToString(CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendAreaRecipeProducts(
        StringBuilder json,
        string key,
        List<AreaRecipeProductSnapshot> products,
        bool appendComma)
    {
        json.Append('"');
        json.Append(key);
        json.Append("\":[");
        for (int i = 0; i < products.Count; i++)
        {
            AreaRecipeProductSnapshot product = products[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            appendNumber(json, "quantity", product.Quantity, false);
            json.Append('}');
            if (i < products.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append(']');
        if (appendComma)
        {
            json.Append(',');
        }
    }

    private static void appendTrainStationConfiguration(
        StringBuilder json,
        TrainStationConfigurationSnapshot station)
    {
        if (station == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        json.Append("\"isForLoading\":");
        json.Append(station.IsForLoading ? "true" : "false");
        json.Append(",\"selectedProduct\":");
        if (station.SelectedProduct == null)
        {
            json.Append("null");
        }
        else
        {
            json.Append('{');
            appendString(json, "productId", station.SelectedProduct.ProductId, true);
            appendString(json, "name", station.SelectedProduct.Name, false);
            json.Append('}');
        }
        json.Append('}');
    }

    private static void appendForestryConfiguration(
        StringBuilder json,
        ForestryConfigurationSnapshot forestry)
    {
        if (forestry == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendNumber(json, "treeCount", forestry.TreeCount, true);
        json.Append("\"cuttingEnabled\":");
        json.Append(forestry.CuttingEnabled ? "true" : "false");
        json.Append(',');
        appendNumber(json, "targetHarvestPercent", forestry.TargetHarvestPercent, true);
        appendDecimal(json, "harvestsPerCycle", forestry.HarvestsPerCycle, true);
        json.Append("\"harvestDurationMonths\":");
        if (forestry.HarvestDurationMonths.HasValue)
        {
            json.Append(forestry.HarvestDurationMonths.Value.ToString(
                "0.######",
                CultureInfo.InvariantCulture));
        }
        else
        {
            json.Append("null");
        }
        json.Append(",\"outputs\":[");
        for (int i = 0; i < forestry.Outputs.Count; i++)
        {
            ForestryProductSnapshot product = forestry.Outputs[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            appendDecimal(json, "quantityPerCycle", product.QuantityPerCycle, false);
            json.Append('}');
            if (i < forestry.Outputs.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendOfficeConfiguration(
        StringBuilder json,
        OfficeConfigurationSnapshot office)
    {
        if (office == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendNumber(json, "computingBoostStep", office.ComputingBoostStep, false);
        json.Append('}');
    }

    private static void appendOreSorterConfiguration(
        StringBuilder json,
        OreSorterConfigurationSnapshot sorter)
    {
        if (sorter == null)
        {
            json.Append("null");
            return;
        }

        json.Append('{');
        appendDecimal(json, "throughputPerCycle", sorter.ThroughputPerCycle, true);
        appendNumber(json, "conversionLossPercent", sorter.ConversionLossPercent, true);
        json.Append("\"products\":[");
        for (int i = 0; i < sorter.Products.Count; i++)
        {
            OreSorterProductSnapshot product = sorter.Products[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            json.Append("\"canBeWasted\":");
            json.Append(product.CanBeWasted ? "true" : "false");
            json.Append('}');
            if (i < sorter.Products.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendHistoryAverage(
        StringBuilder json,
        string name,
        HistoryAverage average,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":{");
        appendDecimal(json, "averagePerCycle", average.Value, true);
        appendNumber(json, "sampleMonths", average.SampleMonths, false);
        json.Append('}');
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendString(
        StringBuilder json,
        string name,
        string value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":\"");
        appendEscapedString(json, value);
        json.Append('\"');
        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableString(
        StringBuilder json,
        string name,
        string value,
        bool trailingComma)
    {
        json.Append('\"');
        json.Append(name);
        json.Append("\":");
        if (value == null)
        {
            json.Append("null");
        }
        else
        {
            json.Append('\"');
            appendEscapedString(json, value);
            json.Append('\"');
        }

        if (trailingComma)
        {
            json.Append(',');
        }
    }

    private static void appendEscapedString(StringBuilder json, string value)
    {
        for (int i = 0; i < value.Length; i++)
        {
            char character = value[i];
            switch (character)
            {
                case '\"': json.Append("\\\""); break;
                case '\\': json.Append("\\\\"); break;
                case '\b': json.Append("\\b"); break;
                case '\f': json.Append("\\f"); break;
                case '\n': json.Append("\\n"); break;
                case '\r': json.Append("\\r"); break;
                case '\t': json.Append("\\t"); break;
                default:
                    if (character < ' ')
                    {
                        json.Append("\\u");
                        json.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        json.Append(character);
                    }
                    break;
            }
        }
    }
}
