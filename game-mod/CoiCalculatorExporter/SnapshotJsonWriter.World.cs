using System.Text;

internal static partial class SnapshotJsonWriter
{
    private static void appendWorldMineSnapshot(StringBuilder json, WorldMineSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        appendNumber(json, "entityId", value.EntityId, true);
        appendString(json, "prototypeId", value.PrototypeId, true);
        appendString(json, "name", value.Name, true);
        appendContractProduct(json, "product", value.Product, true);
        json.Append("\"repaired\":");
        json.Append(value.Repaired ? "true" : "false");
        json.Append(',');
        json.Append("\"running\":");
        json.Append(value.Running ? "true" : "false");
        json.Append(',');
        appendString(json, "state", value.State, true);
        appendNumber(json, "level", value.Level, true);
        appendNumber(json, "maxLevel", value.MaxLevel, true);
        appendNumber(json, "productionStep", value.ProductionStep, true);
        appendDecimal(json, "outputPerCycle", value.OutputPerCycle, true);
        appendDecimal(json, "capacityPerCycle", value.CapacityPerCycle, true);
        appendNumber(json, "workers", value.Workers, true);
        appendNumber(json, "workersNeeded", value.WorkersNeeded, true);
        appendDecimal(json, "unityPerCycle", value.UnityPerCycle, true);
        appendDecimal(json, "maximumUnityPerCycle", value.MaximumUnityPerCycle, true);
        appendNumber(json, "bufferQuantity", value.BufferQuantity, true);
        appendNumber(json, "bufferCapacity", value.BufferCapacity, true);
        appendNullableNumber(json, "depositQuantity", value.DepositQuantity, false);
        json.Append('}');
    }

    private static void appendStorageSnapshot(StringBuilder json, StorageSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        appendNumber(json, "entityId", value.EntityId, true);
        appendContractProduct(json, "product", value.Product, true);
        appendNumber(json, "quantity", value.Quantity, true);
        appendNumber(json, "capacity", value.Capacity, true);
        json.Append("\"trainLinked\":");
        json.Append(value.TrainLinked ? "true" : "false");
        json.Append(',');
        json.Append("\"hasAssignedInputs\":");
        json.Append(value.HasAssignedInputs ? "true" : "false");
        json.Append('}');
    }

    private static void appendCargoModuleOperationSnapshot(StringBuilder json, CargoModuleOperationSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        appendNumber(json, "entityId", value.EntityId, true);
        appendString(json, "state", value.State, true);
        json.Append("\"operational\":");
        json.Append(value.Operational ? "true" : "false");
        json.Append(',');
        appendNumber(json, "workersNeeded", value.WorkersNeeded, true);
        appendNumber(json, "shoreQuantity", value.ShoreQuantity, true);
        appendNumber(json, "shoreCapacity", value.ShoreCapacity, true);
        appendNumber(json, "shoreFreeCapacity", value.ShoreFreeCapacity, true);
        appendNumber(json, "onboardQuantity", value.OnboardQuantity, true);
        appendNumber(json, "onboardFreeCapacity", value.OnboardFreeCapacity, true);
        appendDecimal(json, "transferPerCycle", value.TransferPerCycle, true);
        appendDecimal(json, "electricityKw", value.ElectricityKw, false);
        json.Append('}');
    }

    private static void appendAvailableCargoSnapshot(StringBuilder json, AvailableCargoSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        appendContractProduct(json, "product", value.Product, true);
        appendNumber(json, "quantity", value.Quantity, true);
        appendNumber(json, "capacity", value.Capacity, false);
        json.Append('}');
    }

    private static void appendCargoShipOperationSnapshot(StringBuilder json, CargoShipOperationSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        appendString(json, "state", value.State, true);
        json.Append("\"docked\":");
        json.Append(value.Docked ? "true" : "false");
        json.Append(',');
        json.Append("\"inTransit\":");
        json.Append(value.InTransit ? "true" : "false");
        json.Append(',');
        appendNumber(json, "workersNeeded", value.WorkersNeeded, true);
        appendNumber(json, "fuelQuantity", value.FuelQuantity, true);
        json.Append("\"canUseUnityForFuel\":");
        json.Append(value.CanUseUnityForFuel ? "true" : "false");
        json.Append(',');
        appendNullableDecimal(json, "unityPerTrip", value.UnityPerTrip, true);
        json.Append("\"departureRequested\":");
        json.Append(value.DepartureRequested ? "true" : "false");
        json.Append(',');
        json.Append("\"availableCargo\":");
        json.Append('[');
        for (int i = 0; i < value.AvailableCargo.Count; i++)
        {
            if (i > 0) json.Append(',');
            appendAvailableCargoSnapshot(json, value.AvailableCargo[i]);
        }
        json.Append(']');
        json.Append('}');
    }

    private static void appendCargoOperationSnapshot(StringBuilder json, CargoOperationSnapshot value)
    {
        if (value == null) { json.Append("null"); return; }
        json.Append('{');
        json.Append("\"dockBlocked\":");
        json.Append(value.DockBlocked ? "true" : "false");
        json.Append(',');
        json.Append("\"modules\":");
        json.Append('[');
        for (int i = 0; i < value.Modules.Count; i++)
        {
            if (i > 0) json.Append(',');
            appendCargoModuleOperationSnapshot(json, value.Modules[i]);
        }
        json.Append(']');
        json.Append(',');
        json.Append("\"ship\":");
        appendCargoShipOperationSnapshot(json, value.Ship);
        json.Append('}');
    }

    private static void appendWorldState(StringBuilder json, WorldStateSnapshot world)
    {
        json.Append("\"world\":{\"mines\":[");
        for (int i = 0; i < world.Mines.Count; i++)
        {
            if (i > 0) json.Append(',');
            appendWorldMineSnapshot(json, world.Mines[i]);
        }
        json.Append("],\"routes\":[");
        for (int i = 0; i < world.Routes.Count; i++)
        {
            if (i > 0) json.Append(',');
            appendCargoRoute(json, world.Routes[i]);
        }
        json.Append("],\"unassignedShipIds\":[");
        for (int i = 0; i < world.UnassignedShipIds.Count; i++)
        {
            if (i > 0) json.Append(',');
            json.Append(world.UnassignedShipIds[i]);
        }
        json.Append("],");
        appendNumber(json, "unassignedWorkers", world.UnassignedWorkers, false);
        json.Append('}');
    }
}
