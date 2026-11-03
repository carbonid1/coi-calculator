using System;
using System.Collections.Generic;

using Mafi.Core.Products;

internal sealed class RecyclingSnapshot
{
    public double EfficiencyPercent;
    public readonly List<RecyclingProductSnapshot> Products = new List<RecyclingProductSnapshot>();
}

internal sealed class RecyclingProductSnapshot
{
    public string ProductId;
    public string Name;
    public readonly List<RecyclingSourceSnapshot> Sources = new List<RecyclingSourceSnapshot>();
}

internal sealed class RecyclingSourceSnapshot
{
    public string ProductId;
    public string Name;
    public double Quantity;
}

internal sealed partial class GameSnapshotCollector
{
    private RecyclingSnapshot getRecyclingSnapshot()
    {
        RecyclingSnapshot result = new RecyclingSnapshot();
        result.EfficiencyPercent = m_productsManager.RecyclingRatio.ToFix64().ToDouble() * 100;
        foreach (ProductStats stats in m_productsManager.ProductStats)
        {
            if (stats.GlobalQuantity.Value <= 0) continue;
            RecyclingProductSnapshot product = new RecyclingProductSnapshot {
                ProductId = stats.Product.Id.ToString(), Name = getProtoName(stats.Product)
            };
            foreach (var source in stats.SourceProducts)
            {
                if (!source.Key.IsRecyclable || source.Value.Value.ToDouble() <= 0) continue;
                product.Sources.Add(new RecyclingSourceSnapshot {
                    ProductId = source.Key.Id.ToString(), Name = getProtoName(source.Key),
                    Quantity = source.Value.Value.ToDouble() / stats.GlobalQuantity.Value
                });
            }
            product.Sources.Sort(delegate(RecyclingSourceSnapshot a, RecyclingSourceSnapshot b) {
                return String.CompareOrdinal(a.ProductId, b.ProductId);
            });
            result.Products.Add(product);
        }
        result.Products.Sort(delegate(RecyclingProductSnapshot a, RecyclingProductSnapshot b) {
            return String.CompareOrdinal(a.ProductId, b.ProductId);
        });
        return result;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendRecycling(SnapshotJsonStream json, RecyclingSnapshot recycling)
    {
        json.Name("recycling").BeginObject();
        json.Field("efficiencyPercent", recycling.EfficiencyPercent);
        json.Field("scrapPerRecyclable", RecyclablesAccumulator.SCRAP_PER_RECYCLABLE);
        json.Name("products").BeginArray();
        for (int i = 0; i < recycling.Products.Count; i++)
        {
            RecyclingProductSnapshot product = recycling.Products[i];
            json.BeginObject();
            json.Field("productId", product.ProductId);
            json.Field("name", product.Name);
            appendRecyclingSources(json, "sources", product.Sources);
            json.EndObject();
        }
        json.EndArray().EndObject();
    }

    private static void appendRecyclingSources(SnapshotJsonStream json, string name, List<RecyclingSourceSnapshot> sources)
    {
        json.Name(name).BeginArray();
        for (int i = 0; i < sources.Count; i++)
        {
            RecyclingSourceSnapshot source = sources[i];
            json.BeginObject();
            json.Field("productId", source.ProductId);
            json.Field("name", source.Name);
            json.Field("quantity", source.Quantity);
            json.EndObject();
        }
        json.EndArray();
    }
}
