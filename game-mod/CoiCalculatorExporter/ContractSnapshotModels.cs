using System.Collections.Generic;

internal sealed class ContractStateSnapshot
{
    public readonly List<EstablishedContractSnapshot> Established;
    public readonly List<ContractRouteSnapshot> Routes;

    public ContractStateSnapshot(
        List<EstablishedContractSnapshot> established,
        List<ContractRouteSnapshot> routes)
    {
        Established = established;
        Routes = routes;
    }
}

internal sealed class EstablishedContractSnapshot
{
    public readonly string GameId;
    public readonly ContractProductSnapshot ExportedProduct;
    public readonly int ExportedQuantity;
    public readonly ContractProductSnapshot ImportedProduct;
    public readonly int ImportedQuantity;
    public readonly double UnityPerCycle;
    public readonly double UnityPer100Imported;
    public readonly double UnityToEstablish;
    public readonly int MinimumReputation;

    public EstablishedContractSnapshot(
        string gameId,
        ContractProductSnapshot exportedProduct,
        int exportedQuantity,
        ContractProductSnapshot importedProduct,
        int importedQuantity,
        double unityPerCycle,
        double unityPer100Imported,
        double unityToEstablish,
        int minimumReputation)
    {
        GameId = gameId;
        ExportedProduct = exportedProduct;
        ExportedQuantity = exportedQuantity;
        ImportedProduct = importedProduct;
        ImportedQuantity = importedQuantity;
        UnityPerCycle = unityPerCycle;
        UnityPer100Imported = unityPer100Imported;
        UnityToEstablish = unityToEstablish;
        MinimumReputation = minimumReputation;
    }
}

internal sealed class ContractProductSnapshot
{
    public readonly string ProductId;
    public readonly string Name;

    public ContractProductSnapshot(string productId, string name)
    {
        ProductId = productId;
        Name = name;
    }
}

internal sealed class ContractRouteSnapshot
{
    public readonly int DepotEntityId;
    public readonly string DepotPrototypeId;
    public readonly string DepotPrototypeName;
    public readonly string DepotCustomTitle;
    public readonly bool Running;
    public readonly int SlotCount;
    public readonly string ContractGameId;
    public readonly List<LogisticsZoneSnapshot> Zones;
    public readonly List<ContractModuleSnapshot> Modules;
    public readonly ContractShipSnapshot Ship;

    public ContractRouteSnapshot(
        int depotEntityId,
        string depotPrototypeId,
        string depotPrototypeName,
        string depotCustomTitle,
        bool running,
        int slotCount,
        string contractGameId,
        List<LogisticsZoneSnapshot> zones,
        List<ContractModuleSnapshot> modules,
        ContractShipSnapshot ship)
    {
        DepotEntityId = depotEntityId;
        DepotPrototypeId = depotPrototypeId;
        DepotPrototypeName = depotPrototypeName;
        DepotCustomTitle = depotCustomTitle;
        Running = running;
        SlotCount = slotCount;
        ContractGameId = contractGameId;
        Zones = zones;
        Modules = modules;
        Ship = ship;
    }
}

internal sealed class ContractModuleSnapshot
{
    public readonly int EntityId;
    public readonly int Slot;
    public readonly string PrototypeId;
    public readonly string PrototypeName;
    public readonly bool Running;
    public readonly int Workers;
    public readonly ContractProductSnapshot SelectedProduct;
    public readonly string Direction;
    public readonly int OnboardCapacity;

    public ContractModuleSnapshot(
        int entityId,
        int slot,
        string prototypeId,
        string prototypeName,
        bool running,
        int workers,
        ContractProductSnapshot selectedProduct,
        string direction,
        int onboardCapacity)
    {
        EntityId = entityId;
        Slot = slot;
        PrototypeId = prototypeId;
        PrototypeName = prototypeName;
        Running = running;
        Workers = workers;
        SelectedProduct = selectedProduct;
        Direction = direction;
        OnboardCapacity = onboardCapacity;
    }
}

internal sealed class ContractShipSnapshot
{
    public readonly int EntityId;
    public readonly string PrototypeId;
    public readonly string PrototypeName;
    public readonly bool Running;
    public readonly int Workers;
    public readonly ContractProductSnapshot FuelProduct;
    public readonly bool SaveFuel;
    public readonly double? JourneyDurationSeconds;
    public readonly int? FuelPerTrip;

    public ContractShipSnapshot(
        int entityId,
        string prototypeId,
        string prototypeName,
        bool running,
        int workers,
        ContractProductSnapshot fuelProduct,
        bool saveFuel,
        double? journeyDurationSeconds,
        int? fuelPerTrip)
    {
        EntityId = entityId;
        PrototypeId = prototypeId;
        PrototypeName = prototypeName;
        Running = running;
        Workers = workers;
        FuelProduct = fuelProduct;
        SaveFuel = saveFuel;
        JourneyDurationSeconds = journeyDurationSeconds;
        FuelPerTrip = fuelPerTrip;
    }
}
