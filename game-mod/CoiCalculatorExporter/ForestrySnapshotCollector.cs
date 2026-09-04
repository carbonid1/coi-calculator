using System;
using System.Collections.Generic;
using System.Globalization;

using Mafi;
using Mafi.Core.Buildings.Forestry;
using Mafi.Core.Products;
using Mafi.Core.Prototypes;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Designation;
using Mafi.Core.Terrain.Trees;

internal sealed partial class GameSnapshotCollector
{
    private ForestryConfigurationSnapshot getForestryConfiguration(ForestryTower tower)
    {
        if (tower == null)
        {
            return null;
        }

        int treeCount = countManagedForestryTrees(tower);
        int targetHarvestPercent = (int)Math.Round(
            tower.TargetHarvestPercent.ToFloat() * 100.0);
        bool cuttingEnabled = tower.TargetHarvestPercent < ForestryTower.NO_CUT_AT;
        List<ForestryProductSnapshot> outputs = new List<ForestryProductSnapshot>();

        if (!cuttingEnabled || treeCount <= 0)
        {
            return new ForestryConfigurationSnapshot(
                treeCount,
                cuttingEnabled,
                targetHarvestPercent,
                0,
                null,
                outputs);
        }

        double targetGrowth = Math.Max(0.01, tower.TargetHarvestPercent.ToFloat());
        double totalWeight = 0;
        double harvestsPerTreePerCycleWeighted = 0;
        Dictionary<string, ForestryProductAccumulator> outputByProduct =
            new Dictionary<string, ForestryProductAccumulator>(StringComparer.Ordinal);

        for (int i = 0; i < tower.TreeTypes.Count; i++)
        {
            KeyValuePair<TreePlantingGroupProto, int> configuredGroup = tower.TreeTypes[i];
            if (configuredGroup.Value <= 0 || configuredGroup.Key.Trees.Length == 0)
            {
                continue;
            }

            double treeWeight = (double)configuredGroup.Value / configuredGroup.Key.Trees.Length;
            foreach (TreeProto treeProto in configuredGroup.Key.Trees)
            {
                accumulateForestryYield(
                    treeProto,
                    treeWeight,
                    targetGrowth,
                    tower.TargetHarvestPercent,
                    outputByProduct,
                    ref harvestsPerTreePerCycleWeighted);
                totalWeight += treeWeight;
            }
        }

        if (totalWeight <= 0 && m_treesManager != null)
        {
            foreach (TreeId treeId in tower.Trees)
            {
                if (!isManagedForestryTree(tower, treeId))
                {
                    continue;
                }

                TreeData treeData;
                if (!m_treesManager.Trees.TryGetValue(treeId, out treeData))
                {
                    continue;
                }

                accumulateForestryYield(
                    treeData.Proto,
                    1,
                    targetGrowth,
                    tower.TargetHarvestPercent,
                    outputByProduct,
                    ref harvestsPerTreePerCycleWeighted);
                totalWeight += 1;
            }
        }

        if (totalWeight <= 0)
        {
            return new ForestryConfigurationSnapshot(
                treeCount,
                cuttingEnabled,
                targetHarvestPercent,
                0,
                null,
                outputs);
        }

        double harvestsPerTreePerCycle = harvestsPerTreePerCycleWeighted / totalWeight;
        double harvestsPerCycle = treeCount * harvestsPerTreePerCycle;
        foreach (ForestryProductAccumulator accumulator in outputByProduct.Values)
        {
            outputs.Add(new ForestryProductSnapshot(
                accumulator.ProductId,
                accumulator.Name,
                treeCount * accumulator.QuantityPerTreePerCycleWeighted / totalWeight));
        }
        outputs.Sort(delegate(ForestryProductSnapshot left, ForestryProductSnapshot right)
        {
            return String.CompareOrdinal(left.ProductId, right.ProductId);
        });

        return new ForestryConfigurationSnapshot(
            treeCount,
            cuttingEnabled,
            targetHarvestPercent,
            harvestsPerCycle,
            harvestsPerTreePerCycle > 0 ? (double?)(1 / harvestsPerTreePerCycle) : null,
            outputs);
    }

    private static void accumulateForestryYield(
        TreeProto treeProto,
        double weight,
        double targetGrowth,
        Percent harvestPercent,
        Dictionary<string, ForestryProductAccumulator> outputByProduct,
        ref double harvestsPerTreePerCycleWeighted)
    {
        double durationMonths = Math.Max(
            0.01,
            treeProto.GetTreeMaxAge().Years.ToFloat() * 12.0 * targetGrowth);
        double harvestRate = 1 / durationMonths;
        ProductProto product = treeProto.ProductWhenHarvested.Product;
        string productId = product.Id.ToString();
        ForestryProductAccumulator accumulator;
        if (!outputByProduct.TryGetValue(productId, out accumulator))
        {
            accumulator = new ForestryProductAccumulator(productId, getProtoName(product));
            outputByProduct.Add(productId, accumulator);
        }

        harvestsPerTreePerCycleWeighted += weight * harvestRate;
        accumulator.QuantityPerTreePerCycleWeighted +=
            weight * harvestRate * treeProto.GetHarvestedQuantity(harvestPercent).Value;
    }

    private int countManagedForestryTrees(ForestryTower tower)
    {
        int count = 0;
        foreach (TreeId treeId in tower.Trees)
        {
            if (isManagedForestryTree(tower, treeId)
                && (m_treesManager == null || m_treesManager.Trees.ContainsKey(treeId)))
            {
                count++;
            }
        }
        return count;
    }

    private static bool isManagedForestryTree(ForestryTower tower, TreeId treeId)
    {
        foreach (TerrainDesignation designation in tower.ManagedDesignations)
        {
            if (designation.IsForestry && designation.Area.ContainsTile(treeId.Position))
            {
                return true;
            }
        }
        return false;
    }

    private static string getProtoName(Proto proto)
    {
        string name = proto.Strings.Name.TranslatedString;
        return String.IsNullOrWhiteSpace(name) ? proto.Id.ToString() : name;
    }
}
