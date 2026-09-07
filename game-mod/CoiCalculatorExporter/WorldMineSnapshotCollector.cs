using System;
using System.Collections.Generic;
using Mafi;
using Mafi.Collections;
using Mafi.Core.Buildings.Cargo;
using Mafi.Core.Buildings.Cargo.Modules;
using Mafi.Core.Buildings.Cargo.Ships;
using Mafi.Core.Entities;
using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Population;
using Mafi.Core.World;
using Mafi.Core.World.Entities;

internal sealed partial class GameSnapshotCollector
{
    private WorldStateSnapshot getWorldStateSnapshot()
    {
        WorldStateSnapshot result = new WorldStateSnapshot();
        foreach (WorldMapMine mine in m_worldMapManager.Mines)
        {
            if (mine.IsDestroyed) continue;
            Quantity baseQuantity = mine.Prototype.ProducedProductPerStep.Quantity * mine.ProductionStep;
            Quantity availableQuantity = mine.QuantityAvailable ?? baseQuantity;
            Quantity penalizedQuantity = baseQuantity.Min(availableQuantity).ScaledBy(mine.GetProductionPenalty().InverseTo100());
            double capacity = baseQuantity.IsPositive
                ? mine.GetProducedWithBonus(mine.ProductionStep).Value.ToDouble()
                    * penalizedQuantity.Value / baseQuantity.Value
                    * 60.0 / mine.Prototype.ProductionDuration.Seconds.ToDouble()
                : 0;
            result.Mines.Add(new WorldMineSnapshot {
                EntityId = mine.Id.Value,
                PrototypeId = mine.Prototype.Id.ToString(),
                Name = mine.CustomTitle.ValueOrNull ?? mine.DefaultTitle.ToString(),
                Product = getProductSnapshot(mine.Product),
                Repaired = mine.IsRepaired,
                Running = mine.IsEnabled,
                State = mine.CurrentState.ToString(),
                Level = mine.Level,
                MaxLevel = mine.Prototype.MaxLevel,
                ProductionStep = mine.ProductionStep,
                CapacityPerCycle = capacity,
                OutputPerCycle = mine.CurrentState == WorldMapMine.State.Working ? capacity : 0,
                Workers = EntityWithWorkersExtensions.WorkersAssigned(mine),
                WorkersNeeded = mine.WorkersNeeded,
                UnityPerCycle = mine.MonthlyUnityConsumed.Value.ToDouble(),
                MaximumUnityPerCycle = mine.MaxMonthlyUnityConsumed.Value.ToDouble(),
                BufferQuantity = mine.Buffer.Quantity.Value,
                BufferCapacity = mine.Buffer.Capacity.Value,
                DepositQuantity = mine.QuantityAvailable.HasValue ? (int?)mine.QuantityAvailable.Value.Value : null,
            });
        }
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            CargoDepot depot = entity as CargoDepot;
            if (depot != null && !depot.IsDestroyed && depot.IsConstructed && !depot.ContractAssigned.HasValue)
                result.Routes.Add(getCargoRouteSnapshot(depot));
            CargoShipV2 ship = entity as CargoShipV2;
            if (ship != null && !ship.IsDestroyed && !ship.AssignedDepot.HasValue)
            {
                result.UnassignedWorkers += EntityWithWorkersExtensions.WorkersAssigned(ship);
                if (ship.IsEnabled) result.UnassignedShipIds.Add(ship.Id.Value);
            }
        }
        result.Mines.Sort(delegate(WorldMineSnapshot a, WorldMineSnapshot b) { return a.EntityId.CompareTo(b.EntityId); });
        result.Routes.Sort(delegate(ContractRouteSnapshot a, ContractRouteSnapshot b) { return a.DepotEntityId.CompareTo(b.DepotEntityId); });
        result.UnassignedShipIds.Sort();
        return result;
    }

    private CargoOperationSnapshot getCargoOperation(CargoDepot depot)
    {
        CargoOperationSnapshot result = new CargoOperationSnapshot {
            DockBlocked = depot.IsAccessBlocked,
            Modules = new List<CargoModuleOperationSnapshot>(),
        };
        for (int slot = 0; slot < depot.Modules.Length; slot++)
        {
            CargoDepotModule module = depot.Modules[slot].ValueOrNull;
            if (module == null || module.IsDestroyed || !module.IsConstructed) continue;
            var shipModule = module.GetShipModule().ValueOrNull;
            bool operational = module.IsEnabled
                && (module.CurrentState == CargoDepotModule.State.Idle || module.CurrentState == CargoDepotModule.State.Working);
            result.Modules.Add(new CargoModuleOperationSnapshot {
                EntityId = module.Id.Value,
                State = module.CurrentState.ToString(),
                Operational = operational,
                WorkersNeeded = module.Prototype.Costs.Workers,
                ShoreQuantity = module.CurrentQuantity.Value,
                ShoreCapacity = module.Capacity.Value,
                ShoreFreeCapacity = module.UsableCapacity.Value,
                OnboardQuantity = shipModule == null ? 0 : shipModule.Quantity.Value,
                OnboardFreeCapacity = shipModule == null ? 0 : shipModule.UsableCapacity.Value,
                TransferPerCycle = module.Prototype.QuantityPerExchange.Value * 60.0
                    / module.Prototype.DurationPerExchange.Seconds.ToDouble(),
                ElectricityKw = ((IElectricityConsumingEntity)module).PowerRequired.Value,
            });
        }
        CargoShipV2 ship = depot.CargoShip.ValueOrNull;
        if (ship == null || ship.IsDestroyed) return result;
        CargoShipAssignedToDockJobProviderBase provider = ship.JobProvider as CargoShipAssignedToDockJobProviderBase;
        List<AvailableCargoSnapshot> available = new List<AvailableCargoSnapshot>();
        if (!depot.ContractAssigned.HasValue)
        {
            Lyst<WorldMapCargoManager.WorldCargoData> cargo = new Lyst<WorldMapCargoManager.WorldCargoData>();
            m_worldMapCargoManager.GetAvailableWorldCargo(ship, cargo);
            foreach (WorldMapCargoManager.WorldCargoData item in cargo)
                available.Add(new AvailableCargoSnapshot {
                    Product = getProductSnapshot(item.Product), Quantity = item.Quantity.Value, Capacity = item.Capacity.Value,
                });
        }
        available.Sort(delegate(AvailableCargoSnapshot a, AvailableCargoSnapshot b) { return String.CompareOrdinal(a.Product.ProductId, b.Product.ProductId); });
        var unity = ship.GetUpointsCostIfNoFuel();
        result.Ship = new CargoShipOperationSnapshot {
            State = ship.IsPaused ? "Paused" : (ship.IsDocked && provider != null ? provider.LastDockedStatus.ToString() : "InTransit"),
            Docked = ship.IsDocked,
            InTransit = !ship.IsDocked,
            WorkersNeeded = ship.Prototype.Costs.Workers,
            FuelQuantity = ship.FuelBuffer.Quantity.Value,
            CanUseUnityForFuel = ship.CanPayWithUnityIfOutOfFuel,
            UnityPerTrip = unity.HasValue ? (double?)unity.Value.Value.ToDouble() : null,
            DepartureRequested = ship.DepartureRequestedByPlayer,
            AvailableCargo = available,
        };
        return result;
    }
}
