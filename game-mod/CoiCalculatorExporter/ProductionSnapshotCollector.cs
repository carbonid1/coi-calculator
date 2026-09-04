using System;
using System.Collections.Generic;
using System.Globalization;

using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Buildings.Forestry;
using Mafi.Core.Buildings.Mine;
using Mafi.Core.Buildings.Offices;
using Mafi.Core.Buildings.OreSorting;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Factory;
using Mafi.Core.Factory.Datacenters;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.NuclearReactors;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Map;
using Mafi.Core.Ports.Io;
using Mafi.Core.Population;
using Mafi.Core.Products;
using Mafi.Core.Prototypes;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Designation;
using Mafi.Core.Terrain.Generation;
using Mafi.Core.Terrain.Trees;
using Mafi.Core.Trains;
using Mafi.Core.Vehicles;

internal sealed partial class GameSnapshotCollector
{
    private ProductionSnapshot getProductionSnapshot()
    {
        List<ChickenFarmEntitySnapshot> chickenFarmEntities =
            new List<ChickenFarmEntitySnapshot>();
        List<CropFarmEntitySnapshot> cropFarmEntities = new List<CropFarmEntitySnapshot>();
        List<MachineInventorySnapshot> machines = new List<MachineInventorySnapshot>();
        List<ProductionEntitySnapshot> productionEntities =
            new List<ProductionEntitySnapshot>();
        List<AreaEntitySnapshot> areaEntities = new List<AreaEntitySnapshot>();
        List<MineTowerSnapshot> mineTowers = new List<MineTowerSnapshot>();

        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            IStaticEntity staticEntity = entity as IStaticEntity;
            if (entity.IsDestroyed)
            {
                continue;
            }

            List<LogisticsZoneSnapshot> entityZones = getLogisticsZones(staticEntity);
            MineTower mineTower = entity as MineTower;
            if (mineTower != null && staticEntity != null && staticEntity.IsConstructed)
            {
                List<int> assignedOreSorterEntityIds = new List<int>();
                foreach (OreSortingPlant assignedSorter in mineTower.AssignedInputOreSorters)
                {
                    if (!assignedSorter.IsDestroyed)
                    {
                        assignedOreSorterEntityIds.Add(assignedSorter.Id.Value);
                    }
                }
                assignedOreSorterEntityIds.Sort();
                mineTowers.Add(new MineTowerSnapshot(
                    entity.Id.Value,
                    assignedOreSorterEntityIds));
            }
            if (staticEntity != null && isAreaBuilding(entity))
            {
                string prototypeName = staticEntity.Prototype.Strings.Name.TranslatedString;
                int availableRecipeCount;
                List<AreaRecipeSnapshot> areaRecipes = getAreaRecipes(
                    entity,
                    staticEntity,
                    out availableRecipeCount);
                areaEntities.Add(new AreaEntitySnapshot(
                    entity.Id.Value,
                    entity.Prototype.Id.ToString(),
                    String.IsNullOrWhiteSpace(prototypeName)
                        ? entity.Prototype.Id.ToString()
                        : prototypeName,
                    staticEntity.ConstructionState.ToString(),
                    staticEntity.IsConstructed,
                    staticEntity.IsConstructed && !entity.IsPaused,
                    staticEntity.CenterTile.X,
                    staticEntity.CenterTile.Y,
                    entityZones,
                    areaRecipes,
                    availableRecipeCount,
                    getOreSorterConfiguration(entity),
                    getTrainStationConfiguration(entity),
                    getForestryConfiguration(entity as ForestryTower),
                    getOfficeConfiguration(entity as OfficeBuilding)));
            }

            if (staticEntity != null && !staticEntity.IsConstructed)
            {
                continue;
            }

            bool isRunning = !entity.IsPaused;
            string prototypeId = entity.Prototype.Id.ToString();
            bool isOceanWaterPump = String.Equals(
                entity.GetType().FullName,
                SnapshotTracking.OceanWaterPumpRuntimeTypeName,
                StringComparison.Ordinal);
            DataCenter dataCenterEntity = entity as DataCenter;
            if (SnapshotTracking.TrackedProductionPrototypeIds.Contains(prototypeId)
                || isOceanWaterPump
                || isAreaBuilding(entity))
            {
                NuclearReactor reactor = entity as NuclearReactor;
                productionEntities.Add(new ProductionEntitySnapshot(
                    entity.Id.Value,
                    prototypeId,
                    isRunning,
                    getAssignedRecipeIds(entity),
                    entityZones,
                    reactor == null
                        ? null
                        : new NuclearReactorConfigurationSnapshot(
                            reactor.EnrichmentStep,
                            reactor.TargetPowerLevel.ToIntPercentRounded()),
                    dataCenterEntity == null
                        ? (int?)null
                        : dataCenterEntity.RacksCount,
                    getTrainStationConfiguration(entity)));
            }

            WellPump groundwaterPump = entity as WellPump;
            if (groundwaterPump != null)
            {
                machines.Add(new MachineInventorySnapshot(
                    entity.Id.Value,
                    prototypeId,
                    isRunning,
                    groundwaterPump.CustomTitle.ValueOrNull,
                    groundwaterPump.CenterTile.X,
                    groundwaterPump.CenterTile.Y,
                    entityZones,
                    getGroundwaterAquifer(groundwaterPump)));
            }

            AnimalFarm animalFarm = entity as AnimalFarm;
            if (animalFarm != null
                && String.Equals(prototypeId, SnapshotTracking.ChickenFarmPrototypeId, StringComparison.Ordinal))
            {
                chickenFarmEntities.Add(new ChickenFarmEntitySnapshot(
                    entity.Id.Value,
                    isRunning,
                    animalFarm.IsSlaughteringEnabled,
                    animalFarm.AnimalsCount,
                    entityZones));
                continue;
            }

            Farm cropFarm = entity as Farm;
            if (cropFarm == null
                || (!String.Equals(prototypeId, SnapshotTracking.GreenhousePrototypeId, StringComparison.Ordinal)
                    && !String.Equals(prototypeId, SnapshotTracking.GreenhouseIiPrototypeId, StringComparison.Ordinal)))
            {
                continue;
            }

            string[] schedule = new string[cropFarm.Schedule.Length];
            for (int i = 0; i < cropFarm.Schedule.Length; i++)
            {
                CropProto crop = cropFarm.Schedule[i].ValueOrNull;
                schedule[i] = crop == null ? null : crop.Id.ToString();
            }

            int fertilityTargetPercent = cropFarm.FertilityTargetValue.ToIntPercentRounded();
            string fertilizerProductId = getCropFarmFertilizerProductId(cropFarm);
            cropFarmEntities.Add(new CropFarmEntitySnapshot(
                entity.Id.Value,
                prototypeId,
                isRunning,
                schedule,
                fertilityTargetPercent,
                fertilizerProductId,
                entityZones));
        }

        cropFarmEntities.Sort(delegate(CropFarmEntitySnapshot left, CropFarmEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        machines.Sort(delegate(MachineInventorySnapshot left, MachineInventorySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        chickenFarmEntities.Sort(delegate(
            ChickenFarmEntitySnapshot left,
            ChickenFarmEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        productionEntities.Sort(delegate(
            ProductionEntitySnapshot left,
            ProductionEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        areaEntities.Sort(delegate(AreaEntitySnapshot left, AreaEntitySnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });
        mineTowers.Sort(delegate(MineTowerSnapshot left, MineTowerSnapshot right)
        {
            return left.EntityId.CompareTo(right.EntityId);
        });

        return new ProductionSnapshot(
            getNamedLogisticsZones(),
            chickenFarmEntities,
            cropFarmEntities,
            machines,
            productionEntities,
            areaEntities,
            mineTowers);
    }
}
