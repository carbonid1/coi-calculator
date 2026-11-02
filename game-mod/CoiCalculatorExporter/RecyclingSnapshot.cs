using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

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
    private static void appendRecycling(StringBuilder json, RecyclingSnapshot recycling)
    {
        json.Append("\"recycling\":{");
        json.Append("\"efficiencyPercent\":").Append(recycling.EfficiencyPercent.ToString("R", CultureInfo.InvariantCulture)).Append(',');
        appendNumber(json, "scrapPerRecyclable", RecyclablesAccumulator.SCRAP_PER_RECYCLABLE, true);
        json.Append("\"products\":[");
        for (int i = 0; i < recycling.Products.Count; i++)
        {
            RecyclingProductSnapshot product = recycling.Products[i];
            json.Append('{');
            appendString(json, "productId", product.ProductId, true);
            appendString(json, "name", product.Name, true);
            appendRecyclingSources(json, "sources", product.Sources);
            json.Append('}');
            if (i + 1 < recycling.Products.Count) json.Append(',');
        }
        json.Append("]},");
    }

    private static void appendRecyclingSources(StringBuilder json, string name, List<RecyclingSourceSnapshot> sources)
    {
        json.Append('"').Append(name).Append("\":[");
        for (int i = 0; i < sources.Count; i++)
        {
            RecyclingSourceSnapshot source = sources[i];
            json.Append('{');
            appendString(json, "productId", source.ProductId, true);
            appendString(json, "name", source.Name, true);
            json.Append("\"quantity\":").Append(source.Quantity.ToString("R", CultureInfo.InvariantCulture));
            json.Append('}');
            if (i + 1 < sources.Count) json.Append(',');
        }
        json.Append(']');
    }
}
