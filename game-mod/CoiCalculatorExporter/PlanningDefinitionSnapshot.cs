using System;
using System.Collections.Generic;
using Mafi;
using Mafi.Base.Prototypes.Buildings;
using Mafi.Base.Prototypes.Machines;
using Mafi.Core.Buildings.Settlements;
using Mafi.Core.Population;
using Mafi.Core.Products;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Research;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Datacenters;

internal sealed class PlanningDefinitionSnapshot
{
    public readonly List<ResearchDefinitionSnapshot> Research = new List<ResearchDefinitionSnapshot>();
    public readonly List<EdictDefinitionSnapshot> Edicts = new List<EdictDefinitionSnapshot>();
    public readonly List<SolarDefinitionSnapshot> Solar = new List<SolarDefinitionSnapshot>();
    public readonly List<HousingDefinitionSnapshot> Housing = new List<HousingDefinitionSnapshot>();
    public readonly List<double> StatueReductions = new List<double>();
    public readonly SettlementDefinitionSnapshot Settlement = new SettlementDefinitionSnapshot();
    public FactoryDefinitionSnapshot Factory;
    public double UnityBaseCapacity;
    public int RackCapacity;
    public double ComputingPerRack, CoolantInPerRack, CoolantOutPerRack;
    public string CoolantInProductId, CoolantOutProductId;
    public AreaRecipeSnapshot ChillerRecipe;
    public string StatueFuelProductId;
    public double StatueFuelPerCycle;
}

internal sealed class SettlementDefinitionSnapshot
{
    public double WaterPerPop, WasteWaterPerPop, ElectricityKwPerPop, GoodsPerPop, MedicalPerHundredPops, BaseWastePerPop;
    public readonly List<SettlementFoodDefinitionSnapshot> Foods = new List<SettlementFoodDefinitionSnapshot>();
    public readonly List<KeyValuePair<string, double>> BiomassPerProduct = new List<KeyValuePair<string, double>>();
}
internal sealed class SettlementFoodDefinitionSnapshot
{
    public string ProductId, CategoryId;
    public double PerHundredPops;
}

internal sealed class ResearchDefinitionSnapshot
{
    public string Id;
    public string Description;
    public int SpaceResearchLevel;
    public readonly List<long> Costs = new List<long>();
    public readonly List<KeyValuePair<string, double>> Effects = new List<KeyValuePair<string, double>>();
}

internal sealed class EdictDefinitionSnapshot
{
    public string Id;
    public int Level;
    public string Description;
    public double UnityCost;
    public readonly List<KeyValuePair<string, double>> Effects = new List<KeyValuePair<string, double>>();
}

internal sealed class SolarDefinitionSnapshot
{
    public string PrototypeId;
    public int ProductionKw;
    public int OutputKw;
}

internal sealed class HousingDefinitionSnapshot
{
    public string PrototypeId;
    public int Capacity;
    public double UnityStorage;
    public readonly List<KeyValuePair<string, double>> Needs = new List<KeyValuePair<string, double>>();
    public readonly List<HousingUnitySnapshot> UnityTiers = new List<HousingUnitySnapshot>();
}

internal sealed class HousingUnitySnapshot
{
    public double Percent;
    public readonly List<string> Needs = new List<string>();
}

internal sealed partial class GameSnapshotCollector
{
    private PlanningDefinitionSnapshot getPlanningDefinitions()
    {
        var result = new PlanningDefinitionSnapshot();
        result.Factory = getFactoryDefinitions();
        foreach (DataCenterProto center in m_protosDb.All<DataCenterProto>()) if (center.Id.ToString() == "DataCenter") {
            result.RackCapacity = center.RacksCapacity; result.CoolantInProductId = center.CoolantIn.Id.ToString(); result.CoolantOutProductId = center.CoolantOut.Id.ToString();
        }
        foreach (ServerRackProto rack in m_protosDb.All<ServerRackProto>()) if (rack.Id.ToString() == "BasicServerRack") {
            result.ComputingPerRack = rack.CreatedComputingPerTick.Value; result.CoolantInPerRack = rack.CoolantInPerMonth.Value.ToDouble(); result.CoolantOutPerRack = rack.CoolantOutPerMonth.Value.ToDouble();
        }
        foreach (MachineProto machine in m_protosDb.All<MachineProto>()) if (machine.Id.ToString() == "WaterChiller") {
            foreach (var recipe in machine.Recipes) { result.ChillerRecipe = new MachineRecipeDefinition(machine, recipe).CreateSnapshot(false); break; }
        }
        if (result.RackCapacity <= 0 || result.ComputingPerRack <= 0 || result.ChillerRecipe == null) throw new InvalidOperationException("Computing definitions are incomplete.");
        result.UnityBaseCapacity = UpointsManager.UNITY_BASE_CAP.Value.ToDouble();
        var settlementDefinition = result.Settlement;
        foreach (FoodProto food in m_protosDb.All<FoodProto>())
            if (!food.IsPhantom) settlementDefinition.Foods.Add(new SettlementFoodDefinitionSnapshot {
                ProductId = food.Product.Id.ToString(), CategoryId = food.FoodCategory.Id.ToString(),
                PerHundredPops = food.GetConsumedQuantityFromPopDays(3000, Percent.Hundred).Value.ToDouble(),
            });
        foreach (SettlementModuleProto service in m_protosDb.All<SettlementModuleProto>()) {
            if (service.Id.ToString() == "SettlementWaterModule") {
                settlementDefinition.WaterPerPop = service.GetConsumedPerPopPerMonth(1000, Percent.Hundred).Value.ToDouble() / 1000;
                settlementDefinition.WasteWaterPerPop = service.GetProducedPerPopPerMonth(1000, Percent.Hundred).Value.ToDouble() / 1000;
            }
            if (service.Id.ToString() == "SettlementHouseholdGoodsModule") settlementDefinition.GoodsPerPop = service.GetConsumedPerPopPerMonth(1000, Percent.Hundred).Value.ToDouble() / 1000;

        }
        foreach (SettlementTransformerProto transformer in m_protosDb.All<SettlementTransformerProto>())
            settlementDefinition.ElectricityKwPerPop = transformer.GetPowerRequired(1000, Percent.Hundred).ToDouble() / 1000;
        foreach (HospitalProto hospital in m_protosDb.All<HospitalProto>())
            if (hospital.Id.ToString() == "Hospital") settlementDefinition.MedicalPerHundredPops = hospital.GetSuppliesConsumedQuantityFromPopDays(3000, Percent.Hundred).Value.ToDouble();
        foreach (Settlement settlement in m_settlementsManager.Settlements) {
            settlementDefinition.BaseWastePerPop = settlement.BaseLandfillPerPopPerDay.Value.ToDouble() * 30;
            foreach (ProductStats stats in m_productsManager.ProductStats) {
                if (stats.GlobalQuantity.Value <= 0) continue;
                double biomass = 0;
                foreach (var source in stats.SourceProducts) {
                    string id = source.Key.Id.ToString();
                    if (id == "Product_Biomass") biomass += source.Value.Value.ToDouble() * settlement.BioWasteReductionMultiplier.ToFix64().ToDouble();
                    if (id == "Product_Wood") biomass += source.Value.Value.ToDouble() * settlement.WoodToBiomassMultiplier.ToDouble();
                }
                if (biomass > 0) settlementDefinition.BiomassPerProduct.Add(new KeyValuePair<string, double>(stats.Product.Id.ToString(), biomass / stats.GlobalQuantity.Value));
            }
            break; // These native coefficients are shared by all settlements.
        }
        settlementDefinition.Foods.Sort(delegate(SettlementFoodDefinitionSnapshot a, SettlementFoodDefinitionSnapshot b) { return String.CompareOrdinal(a.ProductId, b.ProductId); });
        settlementDefinition.BiomassPerProduct.Sort(delegate(KeyValuePair<string, double> a, KeyValuePair<string, double> b) { return String.CompareOrdinal(a.Key, b.Key); });
        foreach (ResearchNode node in m_researchManager.AllNodes)
        {
            int index;
            if (!SnapshotTracking.TrackedResearchIndices.TryGetValue(node.Proto.Id.ToString(), out index)) continue;
            var entry = new ResearchDefinitionSnapshot {
                Id = SnapshotTracking.TrackedResearch[index].Key,
                Description = node.Proto.GetDescForTimesResearched(1).ToString(),
                SpaceResearchLevel = node.Proto.SpacePointsRequiredFromLevel,
            };
            entry.Costs.Add(0);
            // ResearchNode.updateCurrentCost invokes CostFn with TimesResearched,
            // so the next level uses a zero-based index and the save's base cost.
            for (int level = 0; level < node.Proto.MaxResearchCount; level++)
                entry.Costs.Add(node.Proto.CostFn(node.BaseScienceCost, level));
            foreach (var effect in node.Proto.PropertiesPerIncrement)
                entry.Effects.Add(new KeyValuePair<string, double>(effect.Key.ToString(), effect.Value.ToFix64Percent().ToDouble()));
            result.Research.Add(entry);
        }
        foreach (Edict edict in m_edictsManager.AllEdicts)
        {
            TrackedEdictTier tier;
            if (!SnapshotTracking.TrackedEdictTiers.TryGetValue(edict.Prototype.Id.ToString(), out tier)) continue;
            EdictProto proto = edict.Prototype;
            var entry = new EdictDefinitionSnapshot {
                Id = SnapshotTracking.TrackedEdicts[tier.EdictIndex].Key, Level = tier.Level,
                Description = proto.Strings.DescShort.TranslatedString,
                UnityCost = proto.MonthlyUpointsCost.Value.ToDouble(),
            };
            var properties = proto as EdictWithPropertiesProto;
            if (properties != null) foreach (var effect in properties.PropertiesToApply)
                entry.Effects.Add(new KeyValuePair<string, double>(effect.Key.ToString(), effect.Value.ToFix64Percent().ToDouble()));
            var food = proto as FoodConsumptionEdictProto;
            if (food != null) entry.Effects.Add(new KeyValuePair<string, double>("FoodConsumptionMultiplier", food.ConsumptionDiff.ToFix64Percent().ToDouble()));
            var growth = proto as PopsBoostEdictProto;
            if (growth != null) entry.Effects.Add(new KeyValuePair<string, double>("PopulationGrowth", growth.PopsGrowthBoost.ToFix64Percent().ToDouble()));
            var eviction = proto as PopsEvictionEdictProto;
            if (eviction != null) entry.Effects.Add(new KeyValuePair<string, double>("PopulationEviction", eviction.MonthlyPopsEvictionRate.ToFix64Percent().ToDouble()));
            var quarantine = proto as PopsQuarantineEdictProto;
            if (quarantine != null) {
                entry.Effects.Add(new KeyValuePair<string, double>("DiseaseReduction", quarantine.DiseaseReduction.ToFix64Percent().ToDouble()));
                entry.Effects.Add(new KeyValuePair<string, double>("WorkersWithheld", quarantine.WorkersToWithhold.ToFix64Percent().ToDouble()));
            }
            result.Edicts.Add(entry);
        }
        foreach (SolarElectricityGeneratorProto proto in m_protosDb.All<SolarElectricityGeneratorProto>())
            if (!proto.IsPhantom) result.Solar.Add(new SolarDefinitionSnapshot {
                PrototypeId = proto.Id.ToString(), ProductionKw = proto.ElectricityProduced.Value, OutputKw = proto.OutputElectricity.Value,
            });
        foreach (SettlementHousingModuleProto proto in m_protosDb.All<SettlementHousingModuleProto>())
        {
            if (proto.IsPhantom) continue;
            var house = new HousingDefinitionSnapshot { PrototypeId = proto.Id.ToString(), Capacity = proto.Capacity, UnityStorage = proto.UpointsCapacity.Value.ToDouble() };
            foreach (var need in proto.NeedsIncreases)
                house.Needs.Add(new KeyValuePair<string, double>(need.Key.Id.ToString(), need.Value.ToFix64Percent().ToDouble()));
            foreach (var tier in proto.UnityIncreases)
            {
                var unity = new HousingUnitySnapshot { Percent = tier.Value.ToFix64Percent().ToDouble() };
                foreach (var need in tier.Key) unity.Needs.Add(getProtoName(need));
                house.UnityTiers.Add(unity);
            }
            result.Housing.Add(house);
        }
        foreach (StatueProto proto in m_protosDb.All<StatueProto>())
        {
            if (proto.Id.ToString() != "StatueOfMaintenanceGolden") continue;
            result.StatueFuelProductId = proto.InputProduct.Value.Id.ToString();
            result.StatueFuelPerCycle = 1 / proto.DurationPerOneQuantity.Months.ToDouble();
            // Use the game's fixed-point geometric sum, including its saturation.
            for (int count = 0; count <= 256; count++) {
                double reduction = Math.Abs(MafiMath.GeometricSum(StatueOfMaintenanceManager.MAINTENANCE_BONUS_BASE, Percent.Fifty, count).ToFix64Percent().ToDouble());
                result.StatueReductions.Add(reduction);
            }
            // Quantization can create a temporary plateau before saturation.
            // Trim only the final plateau after evaluating the full native curve.
            while (result.StatueReductions.Count > 2 && result.StatueReductions[result.StatueReductions.Count - 1]
                == result.StatueReductions[result.StatueReductions.Count - 2]) result.StatueReductions.RemoveAt(result.StatueReductions.Count - 1);
        }
        result.Research.Sort(delegate(ResearchDefinitionSnapshot a, ResearchDefinitionSnapshot b) { return String.CompareOrdinal(a.Id, b.Id); });
        result.Edicts.Sort(delegate(EdictDefinitionSnapshot a, EdictDefinitionSnapshot b) { int byId = String.CompareOrdinal(a.Id, b.Id); return byId != 0 ? byId : a.Level.CompareTo(b.Level); });
        result.Solar.Sort(delegate(SolarDefinitionSnapshot a, SolarDefinitionSnapshot b) { return String.CompareOrdinal(a.PrototypeId, b.PrototypeId); });
        result.Housing.Sort(delegate(HousingDefinitionSnapshot a, HousingDefinitionSnapshot b) { return String.CompareOrdinal(a.PrototypeId, b.PrototypeId); });
        if (result.Research.Count != SnapshotTracking.TrackedResearch.Length || result.Edicts.Count != SnapshotTracking.TrackedEdictTiers.Count
            || result.Solar.Count == 0 || result.Housing.Count == 0 || result.StatueReductions.Count < 2)
            throw new InvalidOperationException("Planning definitions are incomplete.");
        return result;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendPlanningEffects(SnapshotJsonStream json, string field, List<KeyValuePair<string, double>> effects)
    {
        json.Name(field).BeginArray();
        foreach (var effect in effects) { json.BeginObject(); json.Field("id", effect.Key); json.Field("percent", effect.Value); json.EndObject(); }
        json.EndArray();
    }

    private static void appendPlanningDefinitions(SnapshotJsonStream json, PlanningDefinitionSnapshot definition)
    {
        json.Name("planningDefinitions").BeginObject();
        appendFactoryDefinitions(json, definition.Factory);
        json.Name("computing").BeginObject(); json.Field("rackCapacity", definition.RackCapacity); json.Field("computingPerRack", definition.ComputingPerRack);
        json.Field("coolantInProductId", definition.CoolantInProductId); json.Field("coolantOutProductId", definition.CoolantOutProductId);
        json.Field("coolantInPerRack", definition.CoolantInPerRack); json.Field("coolantOutPerRack", definition.CoolantOutPerRack);
        json.Name("chillerInputs").BeginArray(); foreach (var input in definition.ChillerRecipe.Inputs) { json.BeginObject(); json.Field("productId", input.ProductId); json.Field("quantity", input.Quantity * 60 / definition.ChillerRecipe.DurationSeconds); json.EndObject(); } json.EndArray();
        json.Name("chillerOutputs").BeginArray(); foreach (var output in definition.ChillerRecipe.Outputs) { json.BeginObject(); json.Field("productId", output.ProductId); json.Field("quantity", output.Quantity * 60 / definition.ChillerRecipe.DurationSeconds); json.EndObject(); } json.EndArray().EndObject();
        json.Field("unityBaseCapacity", definition.UnityBaseCapacity);
        var settlement = definition.Settlement;
        json.Name("settlement").BeginObject();
        json.Field("waterPerPop", settlement.WaterPerPop); json.Field("wasteWaterPerPop", settlement.WasteWaterPerPop);
        json.Field("electricityKwPerPop", settlement.ElectricityKwPerPop); json.Field("goodsPerPop", settlement.GoodsPerPop);
        json.Field("medicalPerHundredPops", settlement.MedicalPerHundredPops); json.Field("baseWastePerPop", settlement.BaseWastePerPop);
        json.Name("foods").BeginArray();
        foreach (var food in settlement.Foods) { json.BeginObject(); json.Field("productId", food.ProductId); json.Field("categoryId", food.CategoryId); json.Field("perHundredPops", food.PerHundredPops); json.EndObject(); }
        json.EndArray(); json.Name("biomassPerProduct").BeginArray();
        foreach (var product in settlement.BiomassPerProduct) { json.BeginObject(); json.Field("productId", product.Key); json.Field("quantity", product.Value); json.EndObject(); }
        json.EndArray().EndObject();
        json.Name("research").BeginArray();
        foreach (var research in definition.Research) {
            json.BeginObject(); json.Field("id", research.Id); json.Field("description", research.Description); json.Field("spaceResearchLevel", research.SpaceResearchLevel);
            json.Name("costs").BeginArray(); foreach (long cost in research.Costs) json.Value(cost); json.EndArray();
            appendPlanningEffects(json, "effects", research.Effects); json.EndObject();
        }
        json.EndArray();
        json.Name("edicts").BeginArray();
        foreach (var edict in definition.Edicts) {
            json.BeginObject(); json.Field("id", edict.Id); json.Field("level", edict.Level); json.Field("description", edict.Description); json.Field("unityCost", edict.UnityCost);
            appendPlanningEffects(json, "effects", edict.Effects); json.EndObject();
        }
        json.EndArray();
        json.Name("solar").BeginArray();
        foreach (var solar in definition.Solar) { json.BeginObject(); json.Field("prototypeId", solar.PrototypeId); json.Field("productionKw", solar.ProductionKw); json.Field("outputKw", solar.OutputKw); json.EndObject(); }
        json.EndArray();
        json.Name("housing").BeginArray();
        foreach (var house in definition.Housing) {
            json.BeginObject(); json.Field("prototypeId", house.PrototypeId); json.Field("capacity", house.Capacity); json.Field("unityStorage", house.UnityStorage);
            appendPlanningEffects(json, "needs", house.Needs);
            json.Name("unityTiers").BeginArray();
            foreach (var tier in house.UnityTiers) { json.BeginObject(); json.Field("percent", tier.Percent); json.Name("needs").BeginArray(); foreach (string need in tier.Needs) json.Value(need); json.EndArray().EndObject(); }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("statue").BeginObject(); json.Field("fuelProductId", definition.StatueFuelProductId); json.Field("fuelPerCycle", definition.StatueFuelPerCycle);
        json.Name("reductionsByCount").BeginArray(); foreach (double reduction in definition.StatueReductions) json.Value(reduction); json.EndArray().EndObject();
        json.EndObject();
    }
}
