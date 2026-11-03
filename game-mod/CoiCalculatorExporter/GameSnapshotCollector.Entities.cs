using System;
using System.Collections.Generic;

using Mafi.Core;
using Mafi.Core.Buildings.Cargo;
using Mafi.Core.Buildings.Cargo.Ships;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Buildings.Mine;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Trains;

internal sealed partial class GameSnapshotCollector
{
    // Local to one simulation-thread capture. Never retain entity references
    // between requests: construction, pause state and assignments can change.
    private sealed class SnapshotEntities
    {
        public readonly List<ProductionEntitySource> Production = new List<ProductionEntitySource>();
        public readonly List<Storage> Storages = new List<Storage>();
        public readonly HashSet<EntityId> TrainLinkedStorageIds = new HashSet<EntityId>();
        public readonly List<CargoDepot> CargoDepots = new List<CargoDepot>();
        public readonly List<CargoShipV2> UnassignedCargoShips = new List<CargoShipV2>();
    }

    private struct ProductionEntitySource
    {
        public readonly IEntity Entity;
        public readonly string PrototypeId;
        public readonly bool IsAreaBuilding;
        public readonly bool IsTrackedProduction;

        public ProductionEntitySource(IEntity entity, string prototypeId, bool areaBuilding, bool trackedProduction)
        {
            Entity = entity;
            PrototypeId = prototypeId;
            IsAreaBuilding = areaBuilding;
            IsTrackedProduction = trackedProduction;
        }
    }

    private SnapshotEntities getSnapshotEntities()
    {
        SnapshotEntities result = new SnapshotEntities();
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            // Keep topology lookup independent of storage/building eligibility.
            ITrainStationModule station = entity as ITrainStationModule;
            if (station != null)
            {
                foreach (StorageBase storage in station.GetConnectedStorages())
                {
                    result.TrainLinkedStorageIds.Add(storage.Id);
                }
            }

            if (entity.IsDestroyed) continue;

            Storage inventoryStorage = entity as Storage;
            if (inventoryStorage != null && inventoryStorage.IsConstructed
                && inventoryStorage.StoredProduct.HasValue)
            {
                result.Storages.Add(inventoryStorage);
            }

            CargoDepot depot = entity as CargoDepot;
            if (depot != null && depot.IsConstructed) result.CargoDepots.Add(depot);

            CargoShipV2 ship = entity as CargoShipV2;
            if (ship != null && !ship.AssignedDepot.HasValue) result.UnassignedCargoShips.Add(ship);

            // Belts, pipes and other unrelated entities need no production or
            // factory-area lookup. Keep construction ghosts for area planning.
            string prototypeId = entity.Prototype.Id.ToString();
            bool areaBuilding = isAreaBuilding(entity);
            bool trackedProduction = areaBuilding
                || SnapshotTracking.TrackedProductionPrototypeIds.Contains(prototypeId)
                || String.Equals(entity.GetType().FullName,
                    SnapshotTracking.OceanWaterPumpRuntimeTypeName, StringComparison.Ordinal);
            if (trackedProduction
                || entity is WellPump || entity is MineTower || entity is AnimalFarm || entity is Farm)
            {
                result.Production.Add(new ProductionEntitySource(entity, prototypeId, areaBuilding, trackedProduction));
            }
        }
        return result;
    }
}
