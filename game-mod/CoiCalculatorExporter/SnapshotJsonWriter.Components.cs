using System.Collections.Generic;
using System.Globalization;

internal static partial class SnapshotJsonWriter
{
    // Keep schema 44's six-decimal precision for calculated values.
    // Recycling source ratios use SnapshotJsonStream's full double precision instead.
    private static double snapshotDecimal(double value)
    {
        return double.Parse(
            value.ToString("0.######", CultureInfo.InvariantCulture),
            CultureInfo.InvariantCulture);
    }

    private static void appendDecimal(SnapshotJsonStream json, string name, double value)
    {
        json.Field(name, snapshotDecimal(value));
    }

    private static void appendNullableDecimal(SnapshotJsonStream json, string name, double? value)
    {
        json.Name(name);
        if (value.HasValue)
        {
            json.Value(snapshotDecimal(value.Value));
        }
        else
        {
            json.Value((string)null);
        }
    }

    private static void appendNullableNumber(SnapshotJsonStream json, string name, int? value)
    {
        json.Name(name);
        if (value.HasValue)
        {
            json.Value(value.Value);
        }
        else
        {
            json.Value((string)null);
        }
    }

    private static void appendAreaRecipeProducts(
        SnapshotJsonStream json,
        string key,
        List<AreaRecipeProductSnapshot> products)
    {
        json.Name(key).BeginArray();
        for (int i = 0; i < products.Count; i++)
        {
            AreaRecipeProductSnapshot product = products[i];
            json.BeginObject();
            json.Field("productId", product.ProductId);
            json.Field("name", product.Name);
            json.Field("quantity", product.Quantity);
            json.EndObject();
        }
        json.EndArray();
    }

    private static void appendTrainStationConfiguration(
        SnapshotJsonStream json,
        TrainStationConfigurationSnapshot station)
    {
        if (station == null)
        {
            json.Value((string)null);
            return;
        }

        json.BeginObject();
        json.Field("isForLoading", station.IsForLoading);
        json.Name("selectedProduct");
        if (station.SelectedProduct == null)
        {
            json.Value((string)null);
        }
        else
        {
            json.BeginObject();
            json.Field("productId", station.SelectedProduct.ProductId);
            json.Field("name", station.SelectedProduct.Name);
            json.EndObject();
        }
        json.EndObject();
    }

    private static void appendForestryConfiguration(
        SnapshotJsonStream json,
        ForestryConfigurationSnapshot forestry)
    {
        if (forestry == null)
        {
            json.Value((string)null);
            return;
        }

        json.BeginObject();
        json.Field("treeCount", forestry.TreeCount);
        json.Field("cuttingEnabled", forestry.CuttingEnabled);
        json.Field("targetHarvestPercent", forestry.TargetHarvestPercent);
        appendDecimal(json, "harvestsPerCycle", forestry.HarvestsPerCycle);
        appendNullableDecimal(json, "harvestDurationMonths", forestry.HarvestDurationMonths);
        json.Name("outputs").BeginArray();
        for (int i = 0; i < forestry.Outputs.Count; i++)
        {
            ForestryProductSnapshot product = forestry.Outputs[i];
            json.BeginObject();
            json.Field("productId", product.ProductId);
            json.Field("name", product.Name);
            appendDecimal(json, "quantityPerCycle", product.QuantityPerCycle);
            json.EndObject();
        }
        json.EndArray().EndObject();
    }

    private static void appendOfficeConfiguration(
        SnapshotJsonStream json,
        OfficeConfigurationSnapshot office)
    {
        if (office == null)
        {
            json.Value((string)null);
            return;
        }

        json.BeginObject();
        json.Field("computingBoostStep", office.ComputingBoostStep);
        json.EndObject();
    }

    private static void appendOreSorterConfiguration(
        SnapshotJsonStream json,
        OreSorterConfigurationSnapshot sorter)
    {
        if (sorter == null)
        {
            json.Value((string)null);
            return;
        }

        json.BeginObject();
        appendDecimal(json, "throughputPerCycle", sorter.ThroughputPerCycle);
        json.Field("conversionLossPercent", sorter.ConversionLossPercent);
        json.Name("products").BeginArray();
        for (int i = 0; i < sorter.Products.Count; i++)
        {
            OreSorterProductSnapshot product = sorter.Products[i];
            json.BeginObject();
            json.Field("productId", product.ProductId);
            json.Field("name", product.Name);
            json.Field("canBeWasted", product.CanBeWasted);
            json.EndObject();
        }
        json.EndArray().EndObject();
    }

    private static void appendHistoryAverage(
        SnapshotJsonStream json,
        string name,
        HistoryAverage average)
    {
        json.Name(name).BeginObject();
        appendDecimal(json, "averagePerCycle", average.Value);
        json.Field("sampleMonths", average.SampleMonths);
        json.EndObject();
    }
}
