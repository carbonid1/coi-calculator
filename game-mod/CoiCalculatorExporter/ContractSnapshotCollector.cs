using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Core.Buildings.Cargo;
using Mafi.Core.Buildings.Cargo.Modules;
using Mafi.Core.Buildings.Cargo.Ships;
using Mafi.Core.Entities;
using Mafi.Core.Population;
using Mafi.Core.Products;
using Mafi.Core.World.Contracts;

internal sealed partial class GameSnapshotCollector
{
    private ContractStateSnapshot getContractStateSnapshot()
    {
        Dictionary<string, EstablishedContractSnapshot> establishedById =
            new Dictionary<string, EstablishedContractSnapshot>(StringComparer.Ordinal);
        for (int i = 0; i < m_contractsManager.ActiveContracts.Count; i++)
        {
            ContractProto contract = m_contractsManager.ActiveContracts[i];
            EstablishedContractSnapshot snapshot = getEstablishedContractSnapshot(contract);
            establishedById[snapshot.GameId] = snapshot;
        }

        List<ContractRouteSnapshot> routes = new List<ContractRouteSnapshot>();
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            CargoDepot depot = entity as CargoDepot;
            if (depot == null || depot.IsDestroyed || !depot.IsConstructed)
            {
                continue;
            }

            ContractProto contract = depot.ContractAssigned.ValueOrNull;
            if (contract == null)
            {
                continue;
            }

            EstablishedContractSnapshot established;
            if (!establishedById.TryGetValue(contract.Id.ToString(), out established))
            {
                established = getEstablishedContractSnapshot(contract);
                establishedById.Add(established.GameId, established);
            }

            List<ContractModuleSnapshot> modules = new List<ContractModuleSnapshot>();
            for (int slot = 0; slot < depot.Modules.Length; slot++)
            {
                CargoDepotModule module = depot.Modules[slot].ValueOrNull;
                if (module == null || module.IsDestroyed || !module.IsConstructed)
                {
                    continue;
                }

                ProductProto product = module.StoredProduct.ValueOrNull;
                Mafi.Core.Buildings.Cargo.Ships.Modules.CargoShipModule shipModule =
                    module.GetShipModule().ValueOrNull;
                modules.Add(new ContractModuleSnapshot(
                    module.Id.Value,
                    slot,
                    module.Prototype.Id.ToString(),
                    getPrototypeName(module.Prototype.Id.ToString(), module.Prototype.Strings.Name.TranslatedString),
                    !module.IsPaused,
                    EntityWithWorkersExtensions.WorkersAssigned(module),
                    product == null ? null : getProductSnapshot(product),
                    product == null ? null : (module.IsForImport() ? "import" : "export"),
                    shipModule == null ? 0 : shipModule.Capacity.Value));
            }

            CargoShipV2 ship = depot.CargoShip.ValueOrNull;
            ContractShipSnapshot shipSnapshot = null;
            if (ship != null && !ship.IsDestroyed)
            {
                CargoShipAssignedToDockJobProviderBase jobProvider =
                    ship.JobProvider as CargoShipAssignedToDockJobProviderBase;
                shipSnapshot = new ContractShipSnapshot(
                    ship.Id.Value,
                    ship.Prototype.Id.ToString(),
                    getPrototypeName(ship.Prototype.Id.ToString(), ship.Prototype.Strings.Name.TranslatedString),
                    !ship.IsPaused,
                    EntityWithWorkersExtensions.WorkersAssigned(ship),
                    getProductSnapshot(ship.FuelProto),
                    ship.IsFuelReductionEnabled,
                    ship.JourneyDuration.HasValue
                        ? (double?)ship.JourneyDuration.Value.Seconds.ToDouble()
                        : null,
                    jobProvider == null
                        ? (int?)null
                        : jobProvider.FuelPerJourneyNeeded().Value);
            }

            routes.Add(new ContractRouteSnapshot(
                depot.Id.Value,
                depot.Prototype.Id.ToString(),
                getPrototypeName(depot.Prototype.Id.ToString(), depot.Prototype.Strings.Name.TranslatedString),
                depot.CustomTitle.ValueOrNull,
                !depot.IsPaused,
                depot.SlotCount,
                contract.Id.ToString(),
                getLogisticsZones(depot),
                modules,
                shipSnapshot));
        }

        List<EstablishedContractSnapshot> establishedContracts =
            new List<EstablishedContractSnapshot>(establishedById.Values);
        establishedContracts.Sort(delegate(
            EstablishedContractSnapshot left,
            EstablishedContractSnapshot right)
        {
            return StringComparer.Ordinal.Compare(left.GameId, right.GameId);
        });
        routes.Sort(delegate(ContractRouteSnapshot left, ContractRouteSnapshot right)
        {
            return left.DepotEntityId.CompareTo(right.DepotEntityId);
        });

        return new ContractStateSnapshot(establishedContracts, routes);
    }

    private static EstablishedContractSnapshot getEstablishedContractSnapshot(
        ContractProto contract)
    {
        return new EstablishedContractSnapshot(
            contract.Id.ToString(),
            getProductSnapshot(contract.ProductToPayWith),
            contract.QuantityToPayWith.Value,
            getProductSnapshot(contract.ProductToBuy),
            contract.GetQuantityToBuy(Percent.Hundred).Value,
            contract.UpointsPerMonthBase.Value.ToDouble(),
            contract.UpointsPer100ProductsBoughtBase.Value.ToDouble(),
            contract.UpointsToEstablish.Value.ToDouble(),
            contract.MinReputationRequired);
    }

    private static ContractProductSnapshot getProductSnapshot(ProductProto product)
    {
        string productId = product.Id.ToString();
        return new ContractProductSnapshot(
            productId,
            getPrototypeName(productId, product.Strings.Name.TranslatedString));
    }

    private static string getPrototypeName(string prototypeId, string translatedName)
    {
        return String.IsNullOrWhiteSpace(translatedName) ? prototypeId : translatedName;
    }
}
