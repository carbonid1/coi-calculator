
internal static partial class SnapshotJsonWriter
{
    private static void appendWorldMineSnapshot(SnapshotJsonStream json, WorldMineSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        json.Field("entityId", value.EntityId);
        json.Field("prototypeId", value.PrototypeId);
        json.Field("name", value.Name);
        appendContractProduct(json, "product", value.Product);
        json.Field("repaired", value.Repaired);
        json.Field("running", value.Running);
        json.Field("state", value.State);
        json.Field("level", value.Level);
        json.Field("maxLevel", value.MaxLevel);
        json.Field("productionStep", value.ProductionStep);
        appendDecimal(json, "outputPerCycle", value.OutputPerCycle);
        appendDecimal(json, "capacityPerCycle", value.CapacityPerCycle);
        json.Field("workers", value.Workers);
        json.Field("workersNeeded", value.WorkersNeeded);
        appendDecimal(json, "unityPerCycle", value.UnityPerCycle);
        appendDecimal(json, "maximumUnityPerCycle", value.MaximumUnityPerCycle);
        json.Field("bufferQuantity", value.BufferQuantity);
        json.Field("bufferCapacity", value.BufferCapacity);
        appendNullableNumber(json, "depositQuantity", value.DepositQuantity);
        json.EndObject();
    }

    private static void appendStorageSnapshot(SnapshotJsonStream json, StorageSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        json.Field("entityId", value.EntityId);
        appendContractProduct(json, "product", value.Product);
        json.Field("quantity", value.Quantity);
        json.Field("capacity", value.Capacity);
        json.Field("trainLinked", value.TrainLinked);
        json.Field("hasAssignedInputs", value.HasAssignedInputs);
        json.EndObject();
    }

    private static void appendCargoModuleOperationSnapshot(SnapshotJsonStream json, CargoModuleOperationSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        json.Field("entityId", value.EntityId);
        json.Field("state", value.State);
        json.Field("operational", value.Operational);
        json.Field("workersNeeded", value.WorkersNeeded);
        json.Field("shoreQuantity", value.ShoreQuantity);
        json.Field("shoreCapacity", value.ShoreCapacity);
        json.Field("shoreFreeCapacity", value.ShoreFreeCapacity);
        json.Field("onboardQuantity", value.OnboardQuantity);
        json.Field("onboardFreeCapacity", value.OnboardFreeCapacity);
        appendDecimal(json, "transferPerCycle", value.TransferPerCycle);
        appendDecimal(json, "electricityKw", value.ElectricityKw);
        json.EndObject();
    }

    private static void appendAvailableCargoSnapshot(SnapshotJsonStream json, AvailableCargoSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        appendContractProduct(json, "product", value.Product);
        json.Field("quantity", value.Quantity);
        json.Field("capacity", value.Capacity);
        json.EndObject();
    }

    private static void appendCargoShipOperationSnapshot(SnapshotJsonStream json, CargoShipOperationSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        json.Field("state", value.State);
        json.Field("docked", value.Docked);
        json.Field("inTransit", value.InTransit);
        json.Field("workersNeeded", value.WorkersNeeded);
        json.Field("fuelQuantity", value.FuelQuantity);
        json.Field("canUseUnityForFuel", value.CanUseUnityForFuel);
        appendNullableDecimal(json, "unityPerTrip", value.UnityPerTrip);
        json.Field("departureRequested", value.DepartureRequested);
        json.Name("availableCargo").BeginArray();
        for (int i = 0; i < value.AvailableCargo.Count; i++)
        {
            appendAvailableCargoSnapshot(json, value.AvailableCargo[i]);
        }
        json.EndArray().EndObject();
    }

    private static void appendCargoOperationSnapshot(SnapshotJsonStream json, CargoOperationSnapshot value)
    {
        if (value == null) { json.Value((string)null); return; }
        json.BeginObject();
        json.Field("dockBlocked", value.DockBlocked);
        json.Name("connections");
        if (value.Connections == null) json.Value((string)null);
        else {
            json.BeginArray();
            foreach (var connection in value.Connections) {
                json.BeginObject();
                appendContractProduct(json, "product", connection.Product);
                json.Field("direction", connection.Direction);
                appendNullableDecimal(json, "capacityPerCycle", connection.CapacityPerCycle);
                json.Field("unmeasuredReason", connection.UnmeasuredReason);
                json.Name("storageEntityIds");
                if (connection.StorageEntityIds == null) json.Value((string)null);
                else {
                    json.BeginArray();
                    foreach (int storageId in connection.StorageEntityIds) json.Value(storageId);
                    json.EndArray();
                }
                json.EndObject();
            }
            json.EndArray();
        }
        json.Name("modules").BeginArray();
        for (int i = 0; i < value.Modules.Count; i++)
        {
            appendCargoModuleOperationSnapshot(json, value.Modules[i]);
        }
        json.EndArray();
        json.Name("ship");
        appendCargoShipOperationSnapshot(json, value.Ship);
        json.EndObject();
    }

    private static void appendWorldState(SnapshotJsonStream json, WorldStateSnapshot world)
    {
        json.Name("world").BeginObject();
        json.Name("mines").BeginArray();
        for (int i = 0; i < world.Mines.Count; i++)
        {
            appendWorldMineSnapshot(json, world.Mines[i]);
        }
        json.EndArray();
        json.Name("routes").BeginArray();
        for (int i = 0; i < world.Routes.Count; i++)
        {
            appendCargoRoute(json, world.Routes[i]);
        }
        json.EndArray();
        json.Name("unassignedShipIds").BeginArray();
        for (int i = 0; i < world.UnassignedShipIds.Count; i++)
        {
            json.Value(world.UnassignedShipIds[i]);
        }
        json.EndArray();
        json.Field("unassignedWorkers", world.UnassignedWorkers);
        json.EndObject();
    }
}
