using System;
using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;
using Mafi;
using Mafi.Core.Buildings.ResearchLab;
using Mafi.Core.Factory.NuclearReactors;
using Mafi.Base.Prototypes.Machines.PowerGenerators;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.Prototypes;
using Mafi.Core.World.Contracts;

internal sealed class FactoryDefinitionSnapshot
{
    public readonly List<FactoryRecipeDefinitionSnapshot> Recipes = new List<FactoryRecipeDefinitionSnapshot>();
    public readonly List<EstablishedContractSnapshot> Contracts = new List<EstablishedContractSnapshot>();
    public readonly List<KeyValuePair<string, double>> LabSpacePoints = new List<KeyValuePair<string, double>>();
    public int PopulationResearchNumerator, PopulationResearchRounding, PopulationResearchDenominator;
    public double PumpCapacityPerCycle, RainwaterPerDay;
}
internal sealed class FactoryRecipeDefinitionSnapshot
{
    public string BuildingId;
    public AreaRecipeSnapshot Recipe;
    public int StorageCapacity;
    public double ElectricityOutputMw;
    public readonly List<StationProductSnapshot> ExtraInputs = new List<StationProductSnapshot>();
    public readonly List<StationProductSnapshot> ExtraOutputs = new List<StationProductSnapshot>();
}

internal sealed partial class GameSnapshotCollector
{
    private FactoryDefinitionSnapshot m_factoryDefinitions;
    private FactoryDefinitionSnapshot getFactoryDefinitions()
    {
        if (m_factoryDefinitions != null) return m_factoryDefinitions;
        var result = new FactoryDefinitionSnapshot();
        double generatorEfficiency = 0;
        foreach (ElectricityGeneratorFromMechPowerProto generator in m_protosDb.All<ElectricityGeneratorFromMechPowerProto>())
            if (generator.Id.ToString() == "PowerGeneratorT2") generatorEfficiency = (double)generator.OutputElectricity.Value / generator.InputMechPower.Value;
        if (generatorEfficiency <= 0) throw new InvalidOperationException("Generator conversion is unavailable.");
        foreach (Proto proto in m_protosDb.All<Proto>())
        {
            if (proto.IsPhantom) continue;
            var harvester = proto as Mafi.Core.Buildings.RainwaterHarvesters.RainwaterHarvesterProto;
            if (harvester != null && proto.Id.ToString() == "RainwaterHarvester") result.RainwaterPerDay = harvester.WaterCollectedPerDay.Value.ToDouble();
            var machine = proto as MachineProto;
            var withRecipes = proto as IProtoWithUiRecipes;
            var lab = proto as ResearchLabProto;
            if (lab != null) result.LabSpacePoints.Add(new KeyValuePair<string, double>(proto.Id.ToString(), lab.SciencePerMinute.ToDouble()));
            if (machine != null)
            {
                foreach (var recipe in machine.Recipes)
                    result.Recipes.Add(new FactoryRecipeDefinitionSnapshot { BuildingId = proto.Id.ToString(), Recipe = new MachineRecipeDefinition(machine, recipe).CreateSnapshot(false) });
            }
            else if (proto is NuclearReactorProto && ((NuclearReactorProto)proto).Enrichment.HasValue)
            {
                var reactor = (NuclearReactorProto)proto;
                var enrichment = reactor.Enrichment.Value;
                foreach (var fuel in reactor.FuelPairs) for (int stepIndex = 0; stepIndex < enrichment.EnrichmentSteps.Length; stepIndex++)
                {
                    var step = enrichment.EnrichmentSteps[stepIndex];
                    var recipe = new NuclearReactor.Recipe(reactor, fuel, Percent.Hundred, step.SteamReductionDiv, step.FuelMultiplier);
                    var definition = makeFactoryRecipe(proto, recipe, fuel.FuelInProto.Id.ToString() + ":enrichment:" + stepIndex);
                    var fuelPerMinute = recipe.FuelPerMinute;
                    double processed = (enrichment.ProcessedPerLevel * fuelPerMinute.Value * step.BreedingRatio).Value.ToDouble();
                    if (processed > 0) {
                        definition.ExtraInputs.Add(new StationProductSnapshot { ProductId = enrichment.InputProduct.Id.ToString(), Quantity = processed * recipe.Duration.Seconds.ToDouble() / 60 });
                        definition.ExtraOutputs.Add(new StationProductSnapshot { ProductId = enrichment.OutputProduct.Id.ToString(), Quantity = processed * recipe.Duration.Seconds.ToDouble() / 60 });
                    }
                    result.Recipes.Add(definition);
                }
            }
            else if (withRecipes != null)
            {
                int index = 0;
                foreach (IRecipeForUi recipe in withRecipes.Recipes) result.Recipes.Add(makeFactoryRecipe(proto, recipe, recipe.Id.ToString() + ":" + index++));
            }
            else if (proto is IRecipeForUi)
            {
                var definition = makeFactoryRecipe(proto, (IRecipeForUi)proto, proto.Id.ToString());
                var turbine = proto as MechPowerGeneratorFromProductProto;
                if (turbine != null) definition.ElectricityOutputMw = turbine.MechPowerOutput.Value * generatorEfficiency / 1000;
                result.Recipes.Add(definition);
            }
        }
        foreach (ContractProto contract in m_protosDb.All<ContractProto>())
            if (!contract.IsPhantom) result.Contracts.Add(getEstablishedContractSnapshot(contract));
        result.Recipes.Sort(delegate(FactoryRecipeDefinitionSnapshot a, FactoryRecipeDefinitionSnapshot b) { int building = String.CompareOrdinal(a.BuildingId, b.BuildingId); return building != 0 ? building : String.CompareOrdinal(a.Recipe.Id, b.Recipe.Id); });
        result.Contracts.Sort(delegate(EstablishedContractSnapshot a, EstablishedContractSnapshot b) { return String.CompareOrdinal(a.GameId, b.GameId); });
        result.LabSpacePoints.Sort(delegate(KeyValuePair<string, double> a, KeyValuePair<string, double> b) { return String.CompareOrdinal(a.Key, b.Key); });
        readPopulationResearchFormula(result);
        foreach (var entry in result.Recipes) {
            if (entry.BuildingId != "LandWaterPump" || entry.Recipe.Id != "LandWaterPumping") continue;
            foreach (var output in entry.Recipe.Outputs) if (output.ProductId == "Product_Water") result.PumpCapacityPerCycle = output.Quantity * 60 / entry.Recipe.DurationSeconds;
        }
        if (result.PumpCapacityPerCycle <= 0 || result.RainwaterPerDay <= 0) throw new InvalidOperationException("Native water definitions are unavailable.");
        m_factoryDefinitions = result;
        return result;
    }

    private static FactoryRecipeDefinitionSnapshot makeFactoryRecipe(Proto proto, IRecipeForUi recipe, string id)
    {
        var inputs = new List<AreaRecipeProductSnapshot>();
        var outputs = new List<AreaRecipeProductSnapshot>();
        bool recycles = false;
        foreach (var input in recipe.AllUserVisibleInputs) inputs.Add(new AreaRecipeProductSnapshot(input.Product.Id.ToString(), getProtoName(input.Product), input.Quantity.Value));
        foreach (var output in recipe.AllUserVisibleOutputs) {
            outputs.Add(new AreaRecipeProductSnapshot(output.Product.Id.ToString(), getProtoName(output.Product), output.Quantity.Value));
            if (output.Product.Id.ToString().StartsWith("Product_Recyclables", StringComparison.Ordinal)) recycles = true;
        }
        var storage = proto as StorageBaseProto;
        return new FactoryRecipeDefinitionSnapshot { BuildingId = proto.Id.ToString(), StorageCapacity = storage == null ? 0 : storage.Capacity.Value,
            Recipe = new AreaRecipeSnapshot(id, id, Math.Max(0.001, recipe.Duration.Seconds.ToDouble()), false, inputs, outputs) { RecyclesInputs = recycles } };
    }

    // Read the installed function's integer coefficients. A changed operation
    // sequence is rejected rather than silently applying a different formula.
    private static void readPopulationResearchFormula(FactoryDefinitionSnapshot result)
    {
        MethodInfo method = typeof(Mafi.Core.Buildings.Settlements.SettlementsManager).GetMethod("updateResearchBonus", BindingFlags.Instance | BindingFlags.NonPublic);
        byte[] il = method == null ? null : method.GetMethodBody().GetILAsByteArray();
        if (il == null || il.Length < 20 || il[0] != OpCodes.Ldarg_0.Value || il[1] != OpCodes.Ldarg_0.Value || il[2] != OpCodes.Call.Value
            || method.Module.ResolveMethod(BitConverter.ToInt32(il, 3)).Name != "GetTotalPopulationWithoutHomeless")
            throw new InvalidOperationException("Population research formula changed.");
        int offset = 7;
        result.PopulationResearchNumerator = readResearchInt(il, ref offset);
        if (il[offset++] != OpCodes.Mul.Value) throw new InvalidOperationException("Population research multiplication changed.");
        result.PopulationResearchRounding = readResearchInt(il, ref offset);
        if (il[offset++] != OpCodes.Add.Value) throw new InvalidOperationException("Population research rounding changed.");
        result.PopulationResearchDenominator = readResearchInt(il, ref offset);
        if (il[offset++] != OpCodes.Div.Value || result.PopulationResearchNumerator < 0 || result.PopulationResearchRounding < 0 || result.PopulationResearchDenominator <= 0)
            throw new InvalidOperationException("Population research division changed.");
    }
    private static int readResearchInt(byte[] il, ref int offset)
    {
        byte op = il[offset++];
        if (op >= OpCodes.Ldc_I4_0.Value && op <= OpCodes.Ldc_I4_8.Value) return op - OpCodes.Ldc_I4_0.Value;
        if (op == OpCodes.Ldc_I4_S.Value) return (sbyte)il[offset++];
        if (op == OpCodes.Ldc_I4.Value) { int value = BitConverter.ToInt32(il, offset); offset += 4; return value; }
        throw new InvalidOperationException("Population research coefficient changed.");
    }
}
internal static partial class SnapshotJsonWriter
{
    private static void appendFactoryDefinitions(SnapshotJsonStream json, FactoryDefinitionSnapshot data)
    {
        json.Name("factory").BeginObject();
        json.Field("rainwaterPerDay", data.RainwaterPerDay);
        json.Name("recipes").BeginArray();
        foreach (var definition in data.Recipes)
        {
            json.BeginObject(); json.Field("buildingId", definition.BuildingId); json.Field("recipeId", definition.Recipe.Id);
            json.Field("durationSeconds", definition.Recipe.DurationSeconds); json.Field("electricityMultiplier", definition.Recipe.ElectricityMultiplier);
            json.Field("recyclesInputs", definition.Recipe.RecyclesInputs); json.Field("storageCapacity", definition.StorageCapacity); json.Field("electricityOutputMw", definition.ElectricityOutputMw);
            json.Name("inputs").BeginArray(); foreach (var input in definition.Recipe.Inputs) { json.BeginObject(); json.Field("productId", input.ProductId); json.Field("quantity", input.Quantity); json.EndObject(); } foreach (var input in definition.ExtraInputs) { json.BeginObject(); json.Field("productId", input.ProductId); json.Field("quantity", input.Quantity); json.EndObject(); } json.EndArray();
            json.Name("outputs").BeginArray(); foreach (var output in definition.Recipe.Outputs) { json.BeginObject(); json.Field("productId", output.ProductId); json.Field("quantity", output.Quantity); json.EndObject(); } foreach (var output in definition.ExtraOutputs) { json.BeginObject(); json.Field("productId", output.ProductId); json.Field("quantity", output.Quantity); json.EndObject(); } json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("contracts").BeginArray();
        foreach (var contract in data.Contracts) appendEstablishedContract(json, contract);
        json.EndArray();
        json.Name("labSpacePoints").BeginArray(); foreach (var lab in data.LabSpacePoints) { json.BeginObject(); json.Field("buildingId", lab.Key); json.Field("perCycle", lab.Value); json.EndObject(); } json.EndArray();
        json.Name("populationResearch").BeginObject(); json.Field("numerator", data.PopulationResearchNumerator); json.Field("rounding", data.PopulationResearchRounding); json.Field("denominator", data.PopulationResearchDenominator); json.EndObject();
        json.EndObject();
    }
}
