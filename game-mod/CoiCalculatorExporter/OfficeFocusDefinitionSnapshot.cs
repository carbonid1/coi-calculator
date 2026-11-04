using System;
using System.Collections.Generic;
using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Offices;

internal sealed class OfficeFocusDefinitionSnapshot
{
    public double PointsMultiplierPercent;
    public readonly List<OfficeDefinitionSnapshot> Offices = new List<OfficeDefinitionSnapshot>();
    public readonly List<FocusDefinitionSnapshot> Focuses = new List<FocusDefinitionSnapshot>();
}

internal sealed class OfficeDefinitionSnapshot
{
    public string PrototypeId;
    public string SuppliesProductId;
    public double SuppliesPerCycle;
    public readonly List<OfficeBoostSnapshot> Boosts = new List<OfficeBoostSnapshot>();
}

internal sealed class OfficeBoostSnapshot
{
    public double FocusBonusPercent;
    public double ComputingTflops;
}

internal sealed class FocusDefinitionSnapshot
{
    public string Id;
    public readonly List<int> PointCosts = new List<int>();
    public readonly List<KeyValuePair<string, double>> Effects = new List<KeyValuePair<string, double>>();
}

internal sealed partial class GameSnapshotCollector
{
    private OfficeFocusDefinitionSnapshot getOfficeFocusDefinitions()
    {
        var definition = new OfficeFocusDefinitionSnapshot {
            PointsMultiplierPercent = m_propertiesDb.GetProperty(IdsCore.PropertyIds.FocusPointsMultiplier)
                .Value.ToFix64Percent().ToDouble(),
        };
        foreach (OfficeBuildingProto proto in m_protosDb.All<OfficeBuildingProto>())
        {
            if (proto.IsPhantom) continue;
            var office = new OfficeDefinitionSnapshot {
                PrototypeId = proto.Id.ToString(),
                SuppliesProductId = proto.ConsumedPerRecipe.Product.Id.ToString(),
                SuppliesPerCycle = proto.ConsumedPerRecipe.Quantity.Value / proto.DurationForRecipe.Months.ToDouble(),
            };
            for (int step = 0; step <= proto.MaxComputingBoostSteps; step++)
                office.Boosts.Add(new OfficeBoostSnapshot {
                    FocusBonusPercent = proto.GetBonusPointsPerBonusStep(step).ToFix64Percent().ToDouble(),
                    ComputingTflops = proto.GetComputingPerLevel(step).Value,
                });
            definition.Offices.Add(office);
        }
        definition.Offices.Sort(delegate(OfficeDefinitionSnapshot a, OfficeDefinitionSnapshot b) {
            return String.CompareOrdinal(a.PrototypeId, b.PrototypeId);
        });
        foreach (var focus in m_officeBuildingsManager.AllFocuses)
        {
            string key;
            if (!FocusKeys.TryGetValue(focus.Prototype.Id.ToString(), out key)) continue;
            var properties = focus.Prototype as OfficeFocusWithPropertiesProto;
            if (properties == null) throw new InvalidOperationException("Focus property definition is unavailable: " + key);
            var entry = new FocusDefinitionSnapshot { Id = key };
            for (int step = 0; step <= properties.MaxStep; step++) entry.PointCosts.Add(properties.GetPointsCost(step));
            foreach (var effect in properties.PropertiesPerStepToApply)
                entry.Effects.Add(new KeyValuePair<string, double>(effect.Key.ToString(), effect.Value.ToFix64Percent().ToDouble()));
            definition.Focuses.Add(entry);
        }
        definition.Focuses.Sort(delegate(FocusDefinitionSnapshot a, FocusDefinitionSnapshot b) {
            return String.CompareOrdinal(a.Id, b.Id);
        });
        if (definition.Focuses.Count != FocusKeys.Count || definition.Offices.Count == 0)
            throw new InvalidOperationException("Office and Focus definitions are incomplete.");
        return definition;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendOfficeFocusDefinitions(SnapshotJsonStream json, OfficeFocusDefinitionSnapshot definition)
    {
        json.Name("officeFocusDefinitions").BeginObject();
        json.Field("pointsMultiplierPercent", definition.PointsMultiplierPercent);
        json.Name("offices").BeginArray();
        foreach (var office in definition.Offices)
        {
            json.BeginObject();
            json.Field("prototypeId", office.PrototypeId);
            json.Field("suppliesProductId", office.SuppliesProductId);
            json.Field("suppliesPerCycle", office.SuppliesPerCycle);
            json.Name("boosts").BeginArray();
            foreach (var boost in office.Boosts)
            {
                json.BeginObject();
                json.Field("focusBonusPercent", boost.FocusBonusPercent);
                json.Field("computingTflops", boost.ComputingTflops);
                json.EndObject();
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("focuses").BeginArray();
        foreach (var focus in definition.Focuses)
        {
            json.BeginObject();
            json.Field("id", focus.Id);
            json.Name("pointCosts").BeginArray();
            foreach (int cost in focus.PointCosts) json.Value(cost);
            json.EndArray();
            json.Name("effects").BeginArray();
            foreach (var effect in focus.Effects)
            {
                json.BeginObject();
                json.Field("propertyId", effect.Key);
                json.Field("percentPerStep", effect.Value);
                json.EndObject();
            }
            json.EndArray().EndObject();
        }
        json.EndArray().EndObject();
    }
}
