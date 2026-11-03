using System;
using System.Collections.Generic;

using Mafi.Core;
using Mafi.Core.Buildings.SpaceProgram;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.SpaceProgram;

internal sealed class RocketDefinitionSnapshot
{
    public int CargoCapacity;
    public int CrewCapacity;
    public double CapacityBonusPercent;
    public double BuildCycles;
    public double CrewRotationCycles;
    public readonly List<AreaRecipeProductSnapshot> BuildInputs = new List<AreaRecipeProductSnapshot>();
    public readonly List<AreaRecipeProductSnapshot> LaunchInputs = new List<AreaRecipeProductSnapshot>();
    public readonly List<AreaRecipeProductSnapshot> CompositePanelInputs = new List<AreaRecipeProductSnapshot>();
    public int CompositePanelOutput;
}

internal sealed partial class GameSnapshotCollector
{
    private RocketDefinitionSnapshot getRocketIiDefinition()
    {
        RocketProto rocket = null;
        RocketLaunchPadProto pad = null;
        RecipeProto panels = null;
        foreach (RocketProto proto in m_protosDb.All<RocketProto>())
            if (proto.Id.ToString() == "CargoRocketT2") rocket = proto;
        foreach (RocketLaunchPadProto proto in m_protosDb.All<RocketLaunchPadProto>())
            if (proto.Id.ToString() == "RocketLaunchPad") pad = proto;
        foreach (RecipeProto proto in m_protosDb.All<RecipeProto>())
            if (proto.Id.ToString() == "CompositePanelAssembly") panels = proto;
        if (rocket == null || pad == null || panels == null)
            throw new InvalidOperationException("Rocket II logistics prototypes were not found.");

        // Capacities already include the save's research. Do not reimplement
        // the game's capacity rounding or reuse them across snapshot captures.
        RocketDefinitionSnapshot definition = new RocketDefinitionSnapshot {
            CargoCapacity = rocket.CargoCapacity.Value,
            CrewCapacity = rocket.CrewCapacity,
            CapacityBonusPercent = m_propertiesDb.GetProperty(IdsCore.PropertyIds.RocketsCapacityMultiplier)
                .Value.ToFix64Percent().ToDouble() - 100,
            BuildCycles = rocket.DurationToBuild.Months.ToDouble(),
            CrewRotationCycles = SpaceStationProto.CREW_ROTATION_DURATION.Months.ToDouble(),
        };
        foreach (ProductQuantity cost in rocket.Costs.BaseConstructionCost.Products)
            definition.BuildInputs.Add(rocketProduct(cost));
        definition.LaunchInputs.Add(rocketProduct(pad.WaterPerLaunch));
        definition.LaunchInputs.Add(rocketProduct(rocket.LaunchFuel));
        definition.LaunchInputs.Add(rocketProduct(rocket.LaunchFuelSecondary));
        foreach (RecipeInput input in panels.AllUserVisibleInputs)
            definition.CompositePanelInputs.Add(new AreaRecipeProductSnapshot(
                input.Product.Id.ToString(), getProtoName(input.Product), input.Quantity.Value));
        foreach (RecipeOutput output in panels.AllUserVisibleOutputs)
            if (output.Product.Id.ToString() == "Product_CompositePanel") definition.CompositePanelOutput += output.Quantity.Value;
        if (definition.CompositePanelOutput <= 0)
            throw new InvalidOperationException("Composite panel recipe has no panel output.");
        return definition;
    }

    private static AreaRecipeProductSnapshot rocketProduct(ProductQuantity product)
    {
        return new AreaRecipeProductSnapshot(product.Product.Id.ToString(), getProtoName(product.Product), product.Quantity.Value);
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendRocketIiDefinition(SnapshotJsonStream json, RocketDefinitionSnapshot definition)
    {
        json.Name("rocketIiDefinition").BeginObject();
        json.Field("cargoCapacity", definition.CargoCapacity);
        json.Field("crewCapacity", definition.CrewCapacity);
        json.Field("capacityBonusPercent", definition.CapacityBonusPercent);
        json.Field("buildCycles", definition.BuildCycles);
        json.Field("crewRotationCycles", definition.CrewRotationCycles);
        appendRocketProducts(json, "buildInputs", definition.BuildInputs);
        appendRocketProducts(json, "launchInputs", definition.LaunchInputs);
        appendRocketProducts(json, "compositePanelInputs", definition.CompositePanelInputs);
        json.Field("compositePanelOutput", definition.CompositePanelOutput);
        json.EndObject();
    }

    private static void appendRocketProducts(SnapshotJsonStream json, string name, List<AreaRecipeProductSnapshot> products)
    {
        json.Name(name).BeginArray();
        foreach (AreaRecipeProductSnapshot product in products)
        {
            json.BeginObject();
            json.Field("productId", product.ProductId);
            json.Field("name", product.Name);
            json.Field("quantity", product.Quantity);
            json.EndObject();
        }
        json.EndArray();
    }
}
