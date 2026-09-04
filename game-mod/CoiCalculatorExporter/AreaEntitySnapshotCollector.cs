using System;
using System.Collections.Generic;

using Mafi.Core.Buildings.Offices;
using Mafi.Core.Buildings.OreSorting;
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
            recipes.Add(new AreaRecipeSnapshot(
                recipeId,
                String.IsNullOrWhiteSpace(recipeName) ? recipeId : recipeName,
                Math.Max(0.001, recipeForUi.Duration.Seconds.ToDouble()),
                assigned,
                inputs,
                outputs));
        }

        recipes.Sort(delegate(AreaRecipeSnapshot left, AreaRecipeSnapshot right)
        {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        return recipes;
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
