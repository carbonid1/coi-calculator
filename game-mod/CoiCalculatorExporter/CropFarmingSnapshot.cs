using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Products;

internal sealed class CropDefinitionSnapshot
{
    public string Id;
    public string Name;
    public string ProductId;
    public string ProductName;
    public double QuantityPerHarvest;
    public double WaterPerDay;
    public double FertilityPercentPerDay;
    public double GrowthMonths;
    public double? SurvivesWithoutWaterMonths;
    public bool RequiresGreenhouse;
}

internal sealed class FertilizerDefinitionSnapshot
{
    public string ProductId;
    public double FertilityPercentPerUnit;
    public double MaximumFertilityPercent;
}

internal sealed class CropFarmingSnapshot
{
    public readonly List<CropDefinitionSnapshot> Crops = new List<CropDefinitionSnapshot>();
    public readonly List<FertilizerDefinitionSnapshot> Fertilizers = new List<FertilizerDefinitionSnapshot>();
}

internal sealed partial class GameSnapshotCollector
{
    private sealed class FertilizerSource
    {
        public ProductProto Product;
        public FertilizerProductParam Parameters;
    }

    private List<FertilizerSource> getFertilizerSources()
    {
        List<FertilizerSource> sources = new List<FertilizerSource>();
        foreach (ProductProto product in m_protosDb.All<ProductProto>())
        {
            FertilizerProductParam parameters;
            if (!product.IsPhantom && product.TryGetParam<FertilizerProductParam>(out parameters))
                sources.Add(new FertilizerSource { Product = product, Parameters = parameters });
        }
        return sources;
    }

    private CropFarmingSnapshot getCropFarmingSnapshot(List<FertilizerSource> fertilizers)
    {
        CropFarmingSnapshot snapshot = new CropFarmingSnapshot();
        double daysPerMonth = Duration.OneMonth.Days.ToDouble();
        foreach (CropProto crop in m_protosDb.All<CropProto>())
        {
            if (crop.IsPhantom) continue;
            bool hasProduct = crop.ProductProduced.Quantity.IsPositive;
            snapshot.Crops.Add(new CropDefinitionSnapshot {
                Id = crop.Id.ToString(), Name = getProtoName(crop),
                ProductId = hasProduct ? crop.ProductProduced.Product.Id.ToString() : null,
                ProductName = hasProduct ? getProtoName(crop.ProductProduced.Product) : null,
                QuantityPerHarvest = crop.ProductProduced.Quantity.Value,
                WaterPerDay = crop.ConsumedWaterPerDay.Value.ToDouble(),
                // ToFix64Percent quantizes small percentages. Preserve the stored ratio.
                FertilityPercentPerDay = crop.ConsumedFertilityPerDay.ToDouble() * 100,
                GrowthMonths = crop.DaysToGrow / daysPerMonth,
                SurvivesWithoutWaterMonths = crop.DaysToSurviveWithNoWater.HasValue
                    ? (double?)(crop.DaysToSurviveWithNoWater.Value / daysPerMonth) : null,
                RequiresGreenhouse = crop.RequiresGreenhouse,
            });
        }
        foreach (FertilizerSource fertilizer in fertilizers)
            snapshot.Fertilizers.Add(new FertilizerDefinitionSnapshot {
                ProductId = fertilizer.Product.Id.ToString(),
                FertilityPercentPerUnit = fertilizer.Parameters.FertilityPerQuantity.ToDouble() * 100,
                MaximumFertilityPercent = fertilizer.Parameters.MaxFertility.ToDouble() * 100,
            });
        snapshot.Crops.Sort(delegate(CropDefinitionSnapshot left, CropDefinitionSnapshot right) {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        snapshot.Fertilizers.Sort(delegate(FertilizerDefinitionSnapshot left, FertilizerDefinitionSnapshot right) {
            return String.CompareOrdinal(left.ProductId, right.ProductId);
        });
        return snapshot;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendCropFarming(SnapshotJsonStream json, CropFarmingSnapshot data)
    {
        json.Name("cropFarming").BeginObject();
        json.Name("crops").BeginArray();
        foreach (CropDefinitionSnapshot crop in data.Crops)
        {
            json.BeginObject();
            json.Field("id", crop.Id);
            json.Field("name", crop.Name);
            json.Field("productId", crop.ProductId);
            json.Field("productName", crop.ProductName);
            json.Field("quantityPerHarvest", crop.QuantityPerHarvest);
            json.Field("waterPerDay", crop.WaterPerDay);
            json.Field("fertilityPercentPerDay", crop.FertilityPercentPerDay);
            json.Field("growthMonths", crop.GrowthMonths);
            if (crop.SurvivesWithoutWaterMonths.HasValue)
                json.Field("survivesWithoutWaterMonths", crop.SurvivesWithoutWaterMonths.Value);
            else json.Field("survivesWithoutWaterMonths", (string)null);
            json.Field("requiresGreenhouse", crop.RequiresGreenhouse);
            json.EndObject();
        }
        json.EndArray();
        json.Name("fertilizers").BeginArray();
        foreach (FertilizerDefinitionSnapshot fertilizer in data.Fertilizers)
        {
            json.BeginObject();
            json.Field("productId", fertilizer.ProductId);
            json.Field("fertilityPercentPerUnit", fertilizer.FertilityPercentPerUnit);
            json.Field("maximumFertilityPercent", fertilizer.MaximumFertilityPercent);
            json.EndObject();
        }
        json.EndArray();
        json.EndObject();
    }
}
