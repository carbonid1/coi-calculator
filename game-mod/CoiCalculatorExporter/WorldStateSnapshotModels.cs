using System.Collections.Generic;

internal sealed class WorldMineSnapshot
{
    public int EntityId;
    public string PrototypeId;
    public string Name;
    public ContractProductSnapshot Product;
    public bool Repaired;
    public bool Running;
    public string State;
    public int Level;
    public int MaxLevel;
    public int ProductionStep;
    public double OutputPerCycle;
    public double CapacityPerCycle;
    public int Workers;
    public int WorkersNeeded;
    public double UnityPerCycle;
    public double MaximumUnityPerCycle;
    public int BufferQuantity;
    public int BufferCapacity;
    public int? DepositQuantity;
}

internal sealed class StorageSnapshot
{
    public int EntityId;
    public ContractProductSnapshot Product;
    public int Quantity;
    public int Capacity;
    public bool TrainLinked;
    public bool HasAssignedInputs;
}

internal sealed class CargoModuleOperationSnapshot
{
    public int EntityId;
    public string State;
    public bool Operational;
    public int WorkersNeeded;
    public int ShoreQuantity;
    public int ShoreCapacity;
    public int ShoreFreeCapacity;
    public int OnboardQuantity;
    public int OnboardFreeCapacity;
    public double TransferPerCycle;
    public double ElectricityKw;
}

internal sealed class AvailableCargoSnapshot
{
    public ContractProductSnapshot Product;
    public int Quantity;
    public int Capacity;
}

internal sealed class CargoShipOperationSnapshot
{
    public string State;
    public bool Docked;
    public bool InTransit;
    public int WorkersNeeded;
    public int FuelQuantity;
    public bool CanUseUnityForFuel;
    public double? UnityPerTrip;
    public bool DepartureRequested;
    public List<AvailableCargoSnapshot> AvailableCargo;
}

internal sealed class CargoOperationSnapshot
{
    public bool DockBlocked;
    public List<CargoModuleOperationSnapshot> Modules;
    public CargoShipOperationSnapshot Ship;
}

internal sealed class WorldStateSnapshot
{
    public int UnassignedWorkers;
    public readonly List<WorldMineSnapshot> Mines = new List<WorldMineSnapshot>();
    public readonly List<ContractRouteSnapshot> Routes = new List<ContractRouteSnapshot>();
    public readonly List<int> UnassignedShipIds = new List<int>();
}
