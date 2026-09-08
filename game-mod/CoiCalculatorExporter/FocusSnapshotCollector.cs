using System;
using System.Collections.Generic;

internal sealed partial class GameSnapshotCollector
{
    private static readonly Dictionary<string, string> FocusKeys = new Dictionary<string, string>
    {
        { "Focus_TrucksCapacityInc", "trucksCapacity" },
        { "Focus_TrainsCapacityInc", "trainsCapacity" },
        { "Focus_ResearchEfficiencyInc", "researchEfficiency" },
        { "Focus_MaintenanceProductionInc", "maintenanceProduction" },
        { "Focus_CropYieldInc", "cropYield" },
        { "Focus_RecyclingInc", "recyclingEfficiency" },
        { "Focus_FoodConsumptionDec", "foodConsumption" },
        { "Focus_SettlementConsumptionDec", "settlementConsumption" },
        { "Focus_UnityInc", "unityProduction" },
        { "Focus_ContractsProfitInc", "contractsProfitability" },
        { "Focus_ContractsUnityDec", "contractsUnityCost" },
        { "Focus_WorldMinesEfficiency", "worldMinesEfficiency" }
    };

    private List<FocusStateSnapshot> getFocusStates()
    {
        var states = new List<FocusStateSnapshot>();
        foreach (var focus in m_officeBuildingsManager.AllFocuses)
        {
            string key;
            if (!FocusKeys.TryGetValue(focus.Prototype.Id.ToString(), out key)) continue;
            states.Add(new FocusStateSnapshot(key, focus.TargetStep, focus.CurrentActiveStep));
        }
        // Missing prototypes are not confirmed zero allocations.
        if (states.Count != FocusKeys.Count)
            throw new InvalidOperationException("Incomplete Focus allocation data.");
        return states;
    }
}
