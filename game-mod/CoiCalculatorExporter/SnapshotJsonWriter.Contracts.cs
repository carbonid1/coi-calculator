
internal static partial class SnapshotJsonWriter
{
    private static void appendContractState(
        SnapshotJsonStream json,
        ContractStateSnapshot contracts)
    {
        json.Name("contracts").BeginObject();
        json.Name("established").BeginArray();
        for (int i = 0; i < contracts.Established.Count; i++)
        {
            EstablishedContractSnapshot contract = contracts.Established[i];
            json.BeginObject();
            json.Field("gameId", contract.GameId);
            appendContractProduct(json, "exportedProduct", contract.ExportedProduct);
            json.Field("exportedQuantity", contract.ExportedQuantity);
            appendContractProduct(json, "importedProduct", contract.ImportedProduct);
            json.Field("importedQuantity", contract.ImportedQuantity);
            appendDecimal(json, "unityPerCycle", contract.UnityPerCycle);
            appendDecimal(json, "unityPer100Imported", contract.UnityPer100Imported);
            appendDecimal(json, "unityToEstablish", contract.UnityToEstablish);
            json.Field("minimumReputation", contract.MinimumReputation);
            json.EndObject();
        }

        json.EndArray();
        json.Name("routes").BeginArray();
        for (int i = 0; i < contracts.Routes.Count; i++)
        {
            ContractRouteSnapshot route = contracts.Routes[i];
            appendCargoRoute(json, route);
        }
        json.EndArray().EndObject();
    }

    private static void appendCargoRoute(SnapshotJsonStream json, ContractRouteSnapshot route)
    {
        json.BeginObject();
        json.Field("depotEntityId", route.DepotEntityId);
        json.Field("depotPrototypeId", route.DepotPrototypeId);
        json.Field("depotPrototypeName", route.DepotPrototypeName);
        json.Field("depotCustomTitle", route.DepotCustomTitle);
        json.Field("running", route.Running);
        json.Field("slotCount", route.SlotCount);
        json.Field("contractGameId", route.ContractGameId);
        json.Name("zones").BeginArray();
        for (int zoneIndex = 0; zoneIndex < route.Zones.Count; zoneIndex++)
        {
            LogisticsZoneSnapshot zone = route.Zones[zoneIndex];
            json.BeginObject();
            json.Field("id", zone.Id);
            json.Field("name", zone.Name);
            json.EndObject();
        }

        json.EndArray();
        json.Name("modules").BeginArray();
        for (int moduleIndex = 0; moduleIndex < route.Modules.Count; moduleIndex++)
        {
            ContractModuleSnapshot module = route.Modules[moduleIndex];
            json.BeginObject();
            json.Field("entityId", module.EntityId);
            json.Field("slot", module.Slot);
            json.Field("prototypeId", module.PrototypeId);
            json.Field("prototypeName", module.PrototypeName);
            json.Field("running", module.Running);
            json.Field("workers", module.Workers);
            appendNullableContractProduct(json, "selectedProduct", module.SelectedProduct);
            json.Field("direction", module.Direction);
            json.Field("onboardCapacity", module.OnboardCapacity);
            json.EndObject();
        }

        json.EndArray();
        json.Name("ship");
        if (route.Ship == null)
        {
            json.Value((string)null);
        }
        else
        {
            ContractShipSnapshot ship = route.Ship;
            json.BeginObject();
            json.Field("entityId", ship.EntityId);
            json.Field("prototypeId", ship.PrototypeId);
            json.Field("prototypeName", ship.PrototypeName);
            json.Field("running", ship.Running);
            json.Field("workers", ship.Workers);
            appendContractProduct(json, "fuelProduct", ship.FuelProduct);
            json.Field("saveFuel", ship.SaveFuel);
            appendNullableDecimal(json, "journeyDurationSeconds", ship.JourneyDurationSeconds);
            appendNullableNumber(json, "fuelPerTrip", ship.FuelPerTrip);
            json.EndObject();
        }

        json.Name("operation");
        appendCargoOperationSnapshot(json, route.Operation);
        json.EndObject();
    }

    private static void appendContractProduct(SnapshotJsonStream json, string key, ContractProductSnapshot product)
    {
        json.Name(key).BeginObject();
        json.Field("productId", product.ProductId);
        json.Field("name", product.Name);
        json.EndObject();
    }

    private static void appendNullableContractProduct(SnapshotJsonStream json, string key, ContractProductSnapshot product)
    {
        if (product == null)
        {
            json.Field(key, (string)null);
            return;
        }

        appendContractProduct(json, key, product);
    }
}
