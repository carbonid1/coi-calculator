using System;
using System.Collections.Generic;
using System.Globalization;
using Mafi.Base.Prototypes.Machines.PowerGenerators;

using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Forestry;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Factory;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Recipes;
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Map;
using Mafi.Core.Population;
using Mafi.Core.Prototypes;
using Mafi.Core.Products;
using Mafi.Core.Terrain;
using Mafi.Core.Terrain.Generation;
using Mafi.Core.Vehicles;

internal sealed partial class GameSnapshotCollector
{
    private GroundwaterAquiferSnapshot getGroundwaterAquifer(WellPump pump)
    {
        IVirtualTerrainResource resource = m_virtualResourceManager
            .RetrieveResourcesAt(pump.ProductToMine, pump.CenterTile.Tile2i)
            .FirstOrDefault();
        SimpleVirtualResource simpleResource = resource as SimpleVirtualResource;
        if (resource == null || simpleResource == null)
        {
            return null;
        }

        return getGroundwaterAquifer(simpleResource);
    }

    private static GroundwaterAquiferSnapshot getGroundwaterAquifer(SimpleVirtualResource resource)
    {
        Tile3i position = resource.Position;
        return new GroundwaterAquiferSnapshot(
            position.X.ToString(CultureInfo.InvariantCulture)
                + ":"
                + position.Y.ToString(CultureInfo.InvariantCulture),
            position.X,
            position.Y,
            resource.Quantity.Value,
            resource.Capacity.Value,
            resource.ConfiguredCapacity.Value,
            resource.MaxRadius.Value,
            resource.EmergencyQuantity.Value.ToDouble());
    }

    private List<GroundwaterAquiferSnapshot> getGroundwaterAquifers()
    {
        var result = new List<GroundwaterAquiferSnapshot>();
        var manager = (VirtualResourceManager)m_virtualResourceManager;
        // Enumerate the complete map collection, including sources which have
        // never had a pump. No map regeneration or mining occurs.
        var product = m_protosDb.GetOrThrow<VirtualResourceProductProto>(IdsCore.Products.Groundwater);
        foreach (var resource in manager.GetAllResourcesFor(product))
        {
            var simple = resource as SimpleVirtualResource;
            if (simple != null) result.Add(getGroundwaterAquifer(simple));
        }
        result.Sort(delegate(GroundwaterAquiferSnapshot left, GroundwaterAquiferSnapshot right) {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        return result;
    }

    private static List<string> getAssignedRecipeIds(IEntity entity)
    {
        List<string> recipeIds = new List<string>();
        IEntityWithAssignedRecipes recipeEntity = entity as IEntityWithAssignedRecipes;
        if (recipeEntity == null)
        {
            return recipeIds;
        }

        foreach (RecipeProto recipe in recipeEntity.RecipesAssigned)
        {
            recipeIds.Add(recipe.Id.ToString());
        }

        recipeIds.Sort(StringComparer.Ordinal);
        return recipeIds;
    }

    private List<LogisticsZoneSnapshot> getLogisticsZones(IStaticEntity staticEntity)
    {
        List<LogisticsZoneSnapshot> zones = new List<LogisticsZoneSnapshot>();
        if (staticEntity == null)
        {
            return zones;
        }

        foreach (LogisticsZoneFast zoneFast in m_logisticsZonesManager.PlayerZonesFast)
        {
            if (!zoneFast.IsEmpty && zoneFast.Contains(staticEntity))
            {
                LogisticsZone zone = zoneFast.Zone;
                zones.Add(new LogisticsZoneSnapshot(
                    zone.Id.Value,
                    zone.CustomName.ValueOrNull));
            }
        }
        zones.Sort(delegate(LogisticsZoneSnapshot left, LogisticsZoneSnapshot right)
        {
            return left.Id.CompareTo(right.Id);
        });
        return zones;
    }

    private static bool isAreaBuilding(IEntity entity)
    {
        IStaticEntity staticEntity = entity as IStaticEntity;
        if (staticEntity == null)
        {
            return false;
        }

        string entityNamespace = entity.GetType().Namespace;
        return entity is ForestryTower
            || staticEntity.Prototype is ElectricityGeneratorFromMechPowerProto
            || staticEntity.Prototype is MachineProto
            || entity is IEntityWithAssignedRecipes
            || entity is IEntityWithWorkers
            || (!String.IsNullOrWhiteSpace(entityNamespace)
                && entityNamespace.StartsWith(
                    "Mafi.Core.Buildings.Settlements",
                    StringComparison.Ordinal));
    }

    private List<LogisticsZoneSnapshot> getNamedLogisticsZones()
    {
        List<LogisticsZoneSnapshot> zones = new List<LogisticsZoneSnapshot>();
        foreach (LogisticsZoneFast zoneFast in m_logisticsZonesManager.PlayerZonesFast)
        {
            LogisticsZone zone = zoneFast.Zone;
            string name = zone.CustomName.ValueOrNull;
            if (!String.IsNullOrWhiteSpace(name))
            {
                zones.Add(new LogisticsZoneSnapshot(zone.Id.Value, name));
            }
        }
        zones.Sort(delegate(LogisticsZoneSnapshot left, LogisticsZoneSnapshot right)
        {
            return left.Id.CompareTo(right.Id);
        });
        return zones;
    }
}
