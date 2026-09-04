using System.Collections.Generic;

internal sealed class ChickenFarmEntitySnapshot
{
    public readonly int EntityId;
    public readonly bool Running;
    public readonly bool Slaughtering;
    public readonly int Chickens;
    public readonly List<LogisticsZoneSnapshot> Zones;

    public ChickenFarmEntitySnapshot(
        int entityId,
        bool running,
        bool slaughtering,
        int chickens,
        List<LogisticsZoneSnapshot> zones)
    {
        EntityId = entityId;
        Running = running;
        Slaughtering = slaughtering;
        Chickens = chickens;
        Zones = zones;
    }
}

internal sealed class CropFarmEntitySnapshot
{
    public readonly int EntityId;
    public readonly string PrototypeId;
    public readonly bool Running;
    public readonly string[] Schedule;
    public readonly int FertilityTargetPercent;
    public readonly string FertilizerProductId;
    public readonly List<LogisticsZoneSnapshot> Zones;

    public CropFarmEntitySnapshot(
        int entityId,
        string prototypeId,
        bool running,
        string[] schedule,
        int fertilityTargetPercent,
        string fertilizerProductId,
        List<LogisticsZoneSnapshot> zones)
    {
        EntityId = entityId;
        PrototypeId = prototypeId;
        Running = running;
        Schedule = schedule;
        FertilityTargetPercent = fertilityTargetPercent;
        FertilizerProductId = fertilizerProductId;
        Zones = zones;
    }
}

internal sealed class ProductionSnapshot
{
    public readonly List<LogisticsZoneSnapshot> LogisticsZones;
    public readonly List<ChickenFarmEntitySnapshot> ChickenFarmEntities;
    public readonly List<CropFarmEntitySnapshot> CropFarmEntities;
    public readonly List<MachineInventorySnapshot> Machines;
    public readonly List<ProductionEntitySnapshot> ProductionEntities;
    public readonly List<AreaEntitySnapshot> AreaEntities;
    public readonly List<MineTowerSnapshot> MineTowers;

    public ProductionSnapshot(
        List<LogisticsZoneSnapshot> logisticsZones,
        List<ChickenFarmEntitySnapshot> chickenFarmEntities,
        List<CropFarmEntitySnapshot> cropFarmEntities,
        List<MachineInventorySnapshot> machines,
        List<ProductionEntitySnapshot> productionEntities,
        List<AreaEntitySnapshot> areaEntities,
        List<MineTowerSnapshot> mineTowers)
    {
        LogisticsZones = logisticsZones;
        ChickenFarmEntities = chickenFarmEntities;
        CropFarmEntities = cropFarmEntities;
        Machines = machines;
        ProductionEntities = productionEntities;
        AreaEntities = areaEntities;
        MineTowers = mineTowers;
    }
}

internal sealed class MineTowerSnapshot
{
    public readonly int EntityId;
    public readonly List<int> AssignedOreSorterEntityIds;

    public MineTowerSnapshot(int entityId, List<int> assignedOreSorterEntityIds)
    {
        EntityId = entityId;
        AssignedOreSorterEntityIds = assignedOreSorterEntityIds;
    }
}

internal sealed class MachineInventorySnapshot
{
    public readonly int EntityId;
    public readonly string PrototypeId;
    public readonly bool Running;
    public readonly string CustomTitle;
    public readonly int TileX;
    public readonly int TileY;
    public readonly List<LogisticsZoneSnapshot> Zones;
    public readonly GroundwaterAquiferSnapshot Aquifer;

    public MachineInventorySnapshot(
        int entityId,
        string prototypeId,
        bool running,
        string customTitle,
        int tileX,
        int tileY,
        List<LogisticsZoneSnapshot> zones,
        GroundwaterAquiferSnapshot aquifer)
    {
        EntityId = entityId;
        PrototypeId = prototypeId;
        Running = running;
        CustomTitle = customTitle;
        TileX = tileX;
        TileY = tileY;
        Zones = zones;
        Aquifer = aquifer;
    }
}

internal sealed class GroundwaterAquiferSnapshot
{
    public readonly string Id;
    public readonly int PositionX;
    public readonly int PositionY;
    public readonly int Quantity;
    public readonly int Capacity;
    public readonly int ConfiguredCapacity;

    public GroundwaterAquiferSnapshot(
        string id,
        int positionX,
        int positionY,
        int quantity,
        int capacity,
        int configuredCapacity)
    {
        Id = id;
        PositionX = positionX;
        PositionY = positionY;
        Quantity = quantity;
        Capacity = capacity;
        ConfiguredCapacity = configuredCapacity;
    }
}

internal sealed class ProductionEntitySnapshot
{
    public readonly int EntityId;
    public readonly string PrototypeId;
    public readonly bool Running;
    public readonly List<string> RecipeIds;
    public readonly List<LogisticsZoneSnapshot> Zones;
    public readonly NuclearReactorConfigurationSnapshot NuclearReactor;
    public readonly int? DataCenterRacks;
    public readonly TrainStationConfigurationSnapshot TrainStation;

    public ProductionEntitySnapshot(
        int entityId,
        string prototypeId,
        bool running,
        List<string> recipeIds,
        List<LogisticsZoneSnapshot> zones,
        NuclearReactorConfigurationSnapshot nuclearReactor,
        int? dataCenterRacks,
        TrainStationConfigurationSnapshot trainStation)
    {
        EntityId = entityId;
        PrototypeId = prototypeId;
        Running = running;
        RecipeIds = recipeIds;
        Zones = zones;
        NuclearReactor = nuclearReactor;
        DataCenterRacks = dataCenterRacks;
        TrainStation = trainStation;
    }
}

internal sealed class AreaEntitySnapshot
{
    public readonly int EntityId;
    public readonly string PrototypeId;
    public readonly string PrototypeName;
    public readonly string ConstructionState;
    public readonly bool Constructed;
    public readonly bool Running;
    public readonly int TileX;
    public readonly int TileY;
    public readonly List<LogisticsZoneSnapshot> Zones;
    public readonly List<AreaRecipeSnapshot> Recipes;
    public readonly int AvailableRecipeCount;
    public readonly OreSorterConfigurationSnapshot OreSorter;
    public readonly TrainStationConfigurationSnapshot TrainStation;
    public readonly ForestryConfigurationSnapshot Forestry;
    public readonly OfficeConfigurationSnapshot Office;

    public AreaEntitySnapshot(
        int entityId,
        string prototypeId,
        string prototypeName,
        string constructionState,
        bool constructed,
        bool running,
        int tileX,
        int tileY,
        List<LogisticsZoneSnapshot> zones,
        List<AreaRecipeSnapshot> recipes,
        int availableRecipeCount,
        OreSorterConfigurationSnapshot oreSorter,
        TrainStationConfigurationSnapshot trainStation,
        ForestryConfigurationSnapshot forestry,
        OfficeConfigurationSnapshot office)
    {
        EntityId = entityId;
        PrototypeId = prototypeId;
        PrototypeName = prototypeName;
        ConstructionState = constructionState;
        Constructed = constructed;
        Running = running;
        TileX = tileX;
        TileY = tileY;
        Zones = zones;
        Recipes = recipes;
        AvailableRecipeCount = availableRecipeCount;
        OreSorter = oreSorter;
        TrainStation = trainStation;
        Forestry = forestry;
        Office = office;
    }
}

internal sealed class OfficeConfigurationSnapshot
{
    public readonly int ComputingBoostStep;

    public OfficeConfigurationSnapshot(int computingBoostStep)
    {
        ComputingBoostStep = computingBoostStep;
    }
}

internal sealed class ForestryConfigurationSnapshot
{
    public readonly int TreeCount;
    public readonly bool CuttingEnabled;
    public readonly int TargetHarvestPercent;
    public readonly double HarvestsPerCycle;
    public readonly double? HarvestDurationMonths;
    public readonly List<ForestryProductSnapshot> Outputs;

    public ForestryConfigurationSnapshot(
        int treeCount,
        bool cuttingEnabled,
        int targetHarvestPercent,
        double harvestsPerCycle,
        double? harvestDurationMonths,
        List<ForestryProductSnapshot> outputs)
    {
        TreeCount = treeCount;
        CuttingEnabled = cuttingEnabled;
        TargetHarvestPercent = targetHarvestPercent;
        HarvestsPerCycle = harvestsPerCycle;
        HarvestDurationMonths = harvestDurationMonths;
        Outputs = outputs;
    }
}

internal sealed class ForestryProductSnapshot
{
    public readonly string ProductId;
    public readonly string Name;
    public readonly double QuantityPerCycle;

    public ForestryProductSnapshot(
        string productId,
        string name,
        double quantityPerCycle)
    {
        ProductId = productId;
        Name = name;
        QuantityPerCycle = quantityPerCycle;
    }
}

internal sealed class ForestryProductAccumulator
{
    public readonly string ProductId;
    public readonly string Name;
    public double QuantityPerTreePerCycleWeighted;

    public ForestryProductAccumulator(string productId, string name)
    {
        ProductId = productId;
        Name = name;
    }
}

internal sealed class OreSorterConfigurationSnapshot
{
    public readonly double ThroughputPerCycle;
    public readonly int ConversionLossPercent;
    public readonly List<OreSorterProductSnapshot> Products;

    public OreSorterConfigurationSnapshot(
        double throughputPerCycle,
        int conversionLossPercent,
        List<OreSorterProductSnapshot> products)
    {
        ThroughputPerCycle = throughputPerCycle;
        ConversionLossPercent = conversionLossPercent;
        Products = products;
    }
}

internal sealed class OreSorterProductSnapshot
{
    public readonly string ProductId;
    public readonly string Name;
    public readonly bool CanBeWasted;

    public OreSorterProductSnapshot(
        string productId,
        string name,
        bool canBeWasted)
    {
        ProductId = productId;
        Name = name;
        CanBeWasted = canBeWasted;
    }
}

internal sealed class TrainStationConfigurationSnapshot
{
    public readonly bool IsForLoading;
    public readonly TrainStationProductSnapshot SelectedProduct;

    public TrainStationConfigurationSnapshot(
        bool isForLoading,
        TrainStationProductSnapshot selectedProduct)
    {
        IsForLoading = isForLoading;
        SelectedProduct = selectedProduct;
    }
}

internal sealed class TrainStationProductSnapshot
{
    public readonly string ProductId;
    public readonly string Name;

    public TrainStationProductSnapshot(string productId, string name)
    {
        ProductId = productId;
        Name = name;
    }
}

internal sealed class AreaRecipeSnapshot
{
    public readonly string Id;
    public readonly string Name;
    public readonly double DurationSeconds;
    public readonly bool Assigned;
    public readonly List<AreaRecipeProductSnapshot> Inputs;
    public readonly List<AreaRecipeProductSnapshot> Outputs;

    public AreaRecipeSnapshot(
        string id,
        string name,
        double durationSeconds,
        bool assigned,
        List<AreaRecipeProductSnapshot> inputs,
        List<AreaRecipeProductSnapshot> outputs)
    {
        Id = id;
        Name = name;
        DurationSeconds = durationSeconds;
        Assigned = assigned;
        Inputs = inputs;
        Outputs = outputs;
    }
}

internal sealed class AreaRecipeProductSnapshot
{
    public readonly string ProductId;
    public readonly string Name;
    public readonly int Quantity;

    public AreaRecipeProductSnapshot(string productId, string name, int quantity)
    {
        ProductId = productId;
        Name = name;
        Quantity = quantity;
    }
}

internal sealed class NuclearReactorConfigurationSnapshot
{
    public readonly int EnrichmentStep;
    public readonly int TargetPowerPercent;

    public NuclearReactorConfigurationSnapshot(
        int enrichmentStep,
        int targetPowerPercent)
    {
        EnrichmentStep = enrichmentStep;
        TargetPowerPercent = targetPowerPercent;
    }
}

internal sealed class LogisticsZoneSnapshot
{
    public readonly int Id;
    public readonly string Name;

    public LogisticsZoneSnapshot(int id, string name)
    {
        Id = id;
        Name = name;
    }
}
