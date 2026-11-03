using System;
using System.Collections.Generic;

using Mafi.Core.Products;
using Mafi.Core.SpaceProgram;

internal sealed class StationProductSnapshot
{
    public string ProductId;
    public string Name;
    public double Quantity;
}

internal sealed class SpaceStationLevelSnapshot
{
    public int Level;
    public int Crew;
    public StationProductSnapshot Construction;
    public StationProductSnapshot Maintenance;
    public StationProductSnapshot CrewSupplies;
    public StationProductSnapshot ResearchSupplies;
    public double ResearchEfficiencyBonusPercent;
    public double SpaceResearchPointsPerCycle;
    public double UnityPerCycle;
}

internal sealed partial class GameSnapshotCollector
{
    private List<SpaceStationLevelSnapshot> getSpaceStationLevels()
    {
        // Four is the calculator's existing planning horizon, not a game tier
        // limit. Include higher tiers already reached by this save as well.
        int maximumLevel = Math.Max(4, m_orbitManager.HighestStationTierAchieved);
        SpaceStation station = m_orbitManager.SpaceStation.ValueOrNull;
        if (station != null) maximumLevel = Math.Max(maximumLevel, station.CurrentTier);
        List<SpaceStationLevelSnapshot> levels = new List<SpaceStationLevelSnapshot>();
        for (int level = 1; level <= maximumLevel; level++)
        {
            // The native method retains the save's advanced-parts progression
            // when a station is downgraded or rebuilt.
            StationTierData data = m_orbitManager.GetStationDataFor(level);
            levels.Add(new SpaceStationLevelSnapshot {
                Level = level,
                Crew = data.CrewCapacity,
                Construction = stationProduct(data.CostToBuild.Product, data.CostToBuild.Quantity.Value),
                Maintenance = stationProduct(data.CostToBuild.Product, data.MaintenancePerMonth.Value.ToDouble()),
                CrewSupplies = stationProduct(data.CrewSupplies,
                    data.CrewSuppliesPerMemberPerMonth.Value.ToDouble() * data.CrewCapacity),
                ResearchSupplies = stationProduct(data.ResearchSupplies, data.ResearchSuppliesConsumedPerMonth.Value.ToDouble()),
                ResearchEfficiencyBonusPercent = data.ResearchEfficiencyBonus.ToFix64Percent().ToDouble(),
                SpaceResearchPointsPerCycle = data.ResearchPointsGeneratedPerMonth.ToDouble(),
                UnityPerCycle = data.UnityBonus.Value.ToDouble(),
            });
        }
        return levels;
    }

    private static StationProductSnapshot stationProduct(ProductProto product, double quantity)
    {
        return new StationProductSnapshot {
            ProductId = product.Id.ToString(), Name = getProtoName(product), Quantity = quantity,
        };
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendSpaceStationLevels(SnapshotJsonStream json, List<SpaceStationLevelSnapshot> levels)
    {
        json.Name("spaceStationLevels").BeginArray();
        foreach (SpaceStationLevelSnapshot level in levels)
        {
            json.BeginObject();
            json.Field("level", level.Level);
            json.Field("crew", level.Crew);
            appendStationProduct(json, "construction", level.Construction);
            appendStationProduct(json, "maintenance", level.Maintenance);
            appendStationProduct(json, "crewSupplies", level.CrewSupplies);
            appendStationProduct(json, "researchSupplies", level.ResearchSupplies);
            json.Field("researchEfficiencyBonusPercent", level.ResearchEfficiencyBonusPercent);
            json.Field("spaceResearchPointsPerCycle", level.SpaceResearchPointsPerCycle);
            json.Field("unityPerCycle", level.UnityPerCycle);
            json.EndObject();
        }
        json.EndArray();
    }

    private static void appendStationProduct(SnapshotJsonStream json, string name, StationProductSnapshot product)
    {
        json.Name(name).BeginObject();
        json.Field("productId", product.ProductId);
        json.Field("name", product.Name);
        json.Field("quantity", product.Quantity);
        json.EndObject();
    }
}
