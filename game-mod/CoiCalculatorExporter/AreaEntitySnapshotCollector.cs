using System;
using System.Collections.Generic;

using Mafi.Collections;
using Mafi.Core.Buildings.Offices;
using Mafi.Core.Buildings.OreSorting;
using Mafi.Core.Buildings.Waste;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Factory;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.Products;
using Mafi.Core.Trains;

internal sealed partial class GameSnapshotCollector
{
    private static OreSorterConfigurationSnapshot getOreSorterConfiguration(IEntity entity)
    {
        OreSortingPlant sorter = entity as OreSortingPlant;
        if (sorter == null)
        {
            return null;
        }

        double throughputPerCycle = sorter.SortedPerDuration.Value
            * 60.0
            / sorter.Prototype.Duration.Seconds.ToDouble();
        List<OreSorterProductSnapshot> products = new List<OreSorterProductSnapshot>();
        foreach (ProductProto product in sorter.AllowedProducts)
        {
            string name = product.Strings.Name.TranslatedString;
            products.Add(new OreSorterProductSnapshot(
                product.Id.ToString(),
                String.IsNullOrWhiteSpace(name) ? product.Id.ToString() : name,
                sorter.ProductsData[product].CanBeWasted));
        }
        products.Sort(delegate(OreSorterProductSnapshot left, OreSorterProductSnapshot right)
        {
            return String.CompareOrdinal(left.ProductId, right.ProductId);
        });

        return new OreSorterConfigurationSnapshot(
            throughputPerCycle,
            sorter.Prototype.ConversionLoss.ToIntPercentRounded(),
            products);
    }

    private static List<AreaRecipeSnapshot> getAreaRecipes(
        IEntity entity,
        IStaticEntity staticEntity,
        out int availableRecipeCount)
    {
        List<AreaRecipeSnapshot> recipes = new List<AreaRecipeSnapshot>();
        availableRecipeCount = 0;
        WasteSortingPlant wasteSorter = entity as WasteSortingPlant;
        if (wasteSorter != null)
        {
            recipes = getWasteSorterRecipes(wasteSorter);
            availableRecipeCount = recipes.Count;
            return recipes;
        }
        MachineProto machine = staticEntity.Prototype as MachineProto;
        if (machine == null)
        {
            return recipes;
        }

        foreach (RecipeProto recipe in machine.Recipes)
        {
            availableRecipeCount++;
        }

        IEntityWithAssignedRecipes recipeEntity = entity as IEntityWithAssignedRecipes;
        HashSet<string> assignedRecipeIds = new HashSet<string>(StringComparer.Ordinal);
        if (recipeEntity != null)
        {
            foreach (RecipeProto assignedRecipe in recipeEntity.RecipesAssigned)
            {
                assignedRecipeIds.Add(assignedRecipe.Id.ToString());
            }
        }

        foreach (RecipeProto recipe in machine.Recipes)
        {
            string recipeId = recipe.Id.ToString();
            bool assigned = assignedRecipeIds.Contains(recipeId)
                || (recipeEntity == null && machine.UseAllRecipesAtStartOrAfterUnlock);
            if (!assigned && availableRecipeCount != 1)
            {
                continue;
            }

            IRecipeForUi recipeForUi = machine.GetRecipeForUi(recipe);
            List<AreaRecipeProductSnapshot> inputs =
                new List<AreaRecipeProductSnapshot>();
            List<AreaRecipeProductSnapshot> outputs =
                new List<AreaRecipeProductSnapshot>();

            foreach (RecipeInput input in recipeForUi.AllUserVisibleInputs)
            {
                inputs.Add(new AreaRecipeProductSnapshot(
                    input.Product.Id.ToString(),
                    getProtoName(input.Product),
                    input.Quantity.Value));
            }
            foreach (RecipeOutput output in recipeForUi.AllUserVisibleOutputs)
            {
                outputs.Add(new AreaRecipeProductSnapshot(
                    output.Product.Id.ToString(),
                    getProtoName(output.Product),
                    output.Quantity.Value));
            }

            string recipeName = recipe.Strings.Name.TranslatedString;
            AreaRecipeSnapshot snapshot = new AreaRecipeSnapshot(
                recipeId,
                String.IsNullOrWhiteSpace(recipeName) ? recipeId : recipeName,
                Math.Max(0.001, recipeForUi.Duration.Seconds.ToDouble()),
                assigned,
                inputs,
                outputs);
            snapshot.RecyclesInputs = recipe.RecyclablesOutput.HasValue;
            Machine machineEntity = entity as Machine;
            if (machineEntity != null)
            {
                foreach (RecipeInput input in recipeForUi.AllUserVisibleInputs)
                {
                    if (!input.Product.Id.ToString().StartsWith("Product_Recyclables", StringComparison.Ordinal)
                        || !input.Product.MixedCategory.HasValue) continue;
                    Lyst<Mafi.Core.ProductQuantity> contents = new Lyst<Mafi.Core.ProductQuantity>();
                    MixedMaterialCategory category = input.Product.MixedCategory.Value;
                    machineEntity.GetInputBufferBreakdown(category, contents);
                    snapshot.RecyclingInputSources = getObservedRecyclingSources(category, contents);
                    if (snapshot.RecyclingInputSources.Count > 0) break;
                    foreach (RecipeOutput output in recipeForUi.AllUserVisibleOutputs)
                    {
                        if (!output.Product.Id.ToString().StartsWith("Product_Recyclables", StringComparison.Ordinal)
                            || !output.Product.MixedCategory.HasValue) continue;
                        contents.Clear();
                        MixedMaterialCategory outputCategory = output.Product.MixedCategory.Value;
                        machineEntity.GetOutputBufferBreakdown(outputCategory, contents);
                        snapshot.RecyclingInputSources = getObservedRecyclingSources(outputCategory, contents);
                        double factor = getScrapPerRecyclable(category) / getScrapPerRecyclable(outputCategory);
                        foreach (RecyclingSourceSnapshot source in snapshot.RecyclingInputSources) source.Quantity *= factor;
                    }
                }
            }
            recipes.Add(snapshot);
        }

        recipes.Sort(delegate(AreaRecipeSnapshot left, AreaRecipeSnapshot right)
        {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        return recipes;
    }

    private static List<AreaRecipeSnapshot> getWasteSorterRecipes(WasteSortingPlant sorter)
    {
        List<AreaRecipeSnapshot> recipes = new List<AreaRecipeSnapshot>();
        foreach (var input in sorter.Prototype.SupportedInputs)
        {
            if (!input.Product.MixedCategory.HasValue) continue;
            MixedMaterialCategory category = input.Product.MixedCategory.Value;
            Lyst<Mafi.Core.ProductQuantity> contents = new Lyst<Mafi.Core.ProductQuantity>();
            sorter.GetInputBufferBreakdown(category, contents);
            Dictionary<ProductProto, double> quantities = new Dictionary<ProductProto, double>();
            foreach (var content in contents)
            {
                ProductProto member = content.Product.MixedMemberOrSelf;
                ProductProto source;
                if (category.TryGetSourceMember(member, out source)) member = source;
                double previous;
                quantities.TryGetValue(member, out previous);
                quantities[member] = previous + content.Quantity.Value;
            }
            // Empty inputs can still have an observed mix in completed-month output.
            if (quantities.Count == 0)
            {
                foreach (ProductProto member in category.MemberProducts)
                {
                    ProductProto source;
                    ProductProto product = category.TryGetSourceMember(member, out source) ? source : member;
                    double quantity = sorter.GetRecycledLastMonth(product).Value.ToDouble();
                    if (quantity > 0) quantities[product] = quantity;
                }
            }
            double total = 0;
            foreach (double quantity in quantities.Values) total += quantity;
            double scrapPerUnit = getScrapPerRecyclable(category);
            List<RecyclingSourceSnapshot> sources = new List<RecyclingSourceSnapshot>();
            List<AreaRecipeProductSnapshot> outputs = new List<AreaRecipeProductSnapshot>();
            foreach (var quantity in quantities)
            {
                if (total <= 0 || quantity.Value <= 0) continue;
                sources.Add(new RecyclingSourceSnapshot {
                    ProductId = quantity.Key.Id.ToString(), Name = getProtoName(quantity.Key),
                    Quantity = scrapPerUnit * quantity.Value / total
                });
                outputs.Add(new AreaRecipeProductSnapshot(
                    quantity.Key.Id.ToString(), getProtoName(quantity.Key), 0));
            }
            sources.Sort(delegate(RecyclingSourceSnapshot a, RecyclingSourceSnapshot b) {
                return String.CompareOrdinal(a.ProductId, b.ProductId);
            });
            outputs.Sort(delegate(AreaRecipeProductSnapshot a, AreaRecipeProductSnapshot b) {
                return String.CompareOrdinal(a.ProductId, b.ProductId);
            });
            string recipeId = input.Product.Id.ToString() == "Product_Recyclables"
                ? "waste-sorting-recyclables" : "waste-sorting-" + input.Product.Id;
            AreaRecipeSnapshot recipe = new AreaRecipeSnapshot(
                recipeId, getProtoName(input.Product), sorter.Prototype.Duration.Seconds.ToDouble(), true,
                new List<AreaRecipeProductSnapshot> { new AreaRecipeProductSnapshot(
                    input.Product.Id.ToString(), getProtoName(input.Product), input.Quantity.Value) }, outputs);
            recipe.RecyclingInputSources = sources;
            recipes.Add(recipe);
        }
        return recipes;
    }

    private static double getScrapPerRecyclable(MixedMaterialCategory category)
    {
        return RecyclablesAccumulator.SCRAP_PER_RECYCLABLE
            * (category.CompactedFromCategory != null ? category.CompactionRatio : 1);
    }

    private static List<RecyclingSourceSnapshot> getObservedRecyclingSources(
        MixedMaterialCategory category, Lyst<Mafi.Core.ProductQuantity> contents)
    {
        Dictionary<ProductProto, double> quantities = new Dictionary<ProductProto, double>();
        double total = 0;
        foreach (var content in contents)
        {
            if (content.Quantity.Value <= 0) continue;
            ProductProto member = content.Product.MixedMemberOrSelf;
            ProductProto source;
            if (category.TryGetSourceMember(member, out source)) member = source;
            double previous;
            quantities.TryGetValue(member, out previous);
            quantities[member] = previous + content.Quantity.Value;
            total += content.Quantity.Value;
        }
        List<RecyclingSourceSnapshot> sources = new List<RecyclingSourceSnapshot>();
        foreach (var quantity in quantities)
        {
            sources.Add(new RecyclingSourceSnapshot {
                ProductId = quantity.Key.Id.ToString(), Name = getProtoName(quantity.Key),
                Quantity = getScrapPerRecyclable(category) * quantity.Value / total
            });
        }
        sources.Sort(delegate(RecyclingSourceSnapshot a, RecyclingSourceSnapshot b) {
            return String.CompareOrdinal(a.ProductId, b.ProductId);
        });
        return sources;
    }

    private static OfficeConfigurationSnapshot getOfficeConfiguration(OfficeBuilding office)
    {
        return office == null
            ? null
            : new OfficeConfigurationSnapshot(office.ComputingBoostStep);
    }

    private static TrainStationConfigurationSnapshot getTrainStationConfiguration(
        IEntity entity)
    {
        ITrainStationModule stationModule = entity as ITrainStationModule;
        if (stationModule == null)
        {
            return null;
        }

        TrainStationProductSnapshot selectedProduct = null;
        if (stationModule.StoredProduct.HasValue)
        {
            var product = stationModule.StoredProduct.Value;
            selectedProduct = new TrainStationProductSnapshot(
                product.Id.ToString(),
                getProtoName(product));
        }

        return new TrainStationConfigurationSnapshot(
            stationModule.IsForLoading,
            selectedProduct);
    }
}
