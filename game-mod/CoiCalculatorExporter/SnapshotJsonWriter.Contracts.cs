using System.Text;

internal static partial class SnapshotJsonWriter
{
    private static void appendContractState(
        StringBuilder json,
        ContractStateSnapshot contracts)
    {
        json.Append("\"contracts\":{\"established\":[");
        for (int i = 0; i < contracts.Established.Count; i++)
        {
            EstablishedContractSnapshot contract = contracts.Established[i];
            json.Append('{');
            appendString(json, "gameId", contract.GameId, true);
            appendContractProduct(json, "exportedProduct", contract.ExportedProduct, true);
            appendNumber(json, "exportedQuantity", contract.ExportedQuantity, true);
            appendContractProduct(json, "importedProduct", contract.ImportedProduct, true);
            appendNumber(json, "importedQuantity", contract.ImportedQuantity, true);
            appendDecimal(json, "unityPerCycle", contract.UnityPerCycle, true);
            appendDecimal(json, "unityPer100Imported", contract.UnityPer100Imported, true);
            appendDecimal(json, "unityToEstablish", contract.UnityToEstablish, true);
            appendNumber(json, "minimumReputation", contract.MinimumReputation, false);
            json.Append('}');
            if (i < contracts.Established.Count - 1)
            {
                json.Append(',');
            }
        }

        json.Append("],\"routes\":[");
        for (int i = 0; i < contracts.Routes.Count; i++)
        {
            ContractRouteSnapshot route = contracts.Routes[i];
            json.Append('{');
            appendNumber(json, "depotEntityId", route.DepotEntityId, true);
            appendString(json, "depotPrototypeId", route.DepotPrototypeId, true);
            appendString(json, "depotPrototypeName", route.DepotPrototypeName, true);
            appendNullableString(json, "depotCustomTitle", route.DepotCustomTitle, true);
            json.Append("\"running\":");
            json.Append(route.Running ? "true" : "false");
            json.Append(',');
            appendNumber(json, "slotCount", route.SlotCount, true);
            appendString(json, "contractGameId", route.ContractGameId, true);
            json.Append("\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < route.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = route.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < route.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }

            json.Append("],\"modules\":[");
            for (int moduleIndex = 0; moduleIndex < route.Modules.Count; moduleIndex++)
            {
                ContractModuleSnapshot module = route.Modules[moduleIndex];
                json.Append('{');
                appendNumber(json, "entityId", module.EntityId, true);
                appendNumber(json, "slot", module.Slot, true);
                appendString(json, "prototypeId", module.PrototypeId, true);
                appendString(json, "prototypeName", module.PrototypeName, true);
                json.Append("\"running\":");
                json.Append(module.Running ? "true" : "false");
                json.Append(',');
                appendNumber(json, "workers", module.Workers, true);
                appendNullableContractProduct(json, "selectedProduct", module.SelectedProduct, true);
                appendNullableString(json, "direction", module.Direction, true);
                appendNumber(json, "onboardCapacity", module.OnboardCapacity, false);
                json.Append('}');
                if (moduleIndex < route.Modules.Count - 1)
                {
                    json.Append(',');
                }
            }

            json.Append("],\"ship\":");
            if (route.Ship == null)
            {
                json.Append("null");
            }
            else
            {
                ContractShipSnapshot ship = route.Ship;
                json.Append('{');
                appendNumber(json, "entityId", ship.EntityId, true);
                appendString(json, "prototypeId", ship.PrototypeId, true);
                appendString(json, "prototypeName", ship.PrototypeName, true);
                json.Append("\"running\":");
                json.Append(ship.Running ? "true" : "false");
                json.Append(',');
                appendNumber(json, "workers", ship.Workers, true);
                appendContractProduct(json, "fuelProduct", ship.FuelProduct, true);
                json.Append("\"saveFuel\":");
                json.Append(ship.SaveFuel ? "true" : "false");
                json.Append(',');
                appendNullableDecimal(
                    json,
                    "journeyDurationSeconds",
                    ship.JourneyDurationSeconds,
                    true);
                appendNullableNumber(json, "fuelPerTrip", ship.FuelPerTrip, false);
                json.Append('}');
            }

            json.Append('}');
            if (i < contracts.Routes.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}");
    }

    private static void appendContractProduct(
        StringBuilder json,
        string key,
        ContractProductSnapshot product,
        bool appendComma)
    {
        json.Append('"');
        json.Append(key);
        json.Append("\":{");
        appendString(json, "productId", product.ProductId, true);
        appendString(json, "name", product.Name, false);
        json.Append('}');
        if (appendComma)
        {
            json.Append(',');
        }
    }

    private static void appendNullableContractProduct(
        StringBuilder json,
        string key,
        ContractProductSnapshot product,
        bool appendComma)
    {
        if (product == null)
        {
            json.Append('"');
            json.Append(key);
            json.Append("\":null");
            if (appendComma)
            {
                json.Append(',');
            }
            return;
        }

        appendContractProduct(json, key, product, appendComma);
    }
}
