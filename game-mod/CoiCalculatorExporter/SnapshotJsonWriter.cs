using System.Collections.Generic;
using System.Globalization;
using System.Text;

internal static partial class SnapshotJsonWriter
{
    public static string Serialize(SnapshotDocument snapshot)
    {
        StringBuilder json = new StringBuilder(3600);
        json.Append('{');
        json.Append("\"schemaVersion\":40,");
        appendSettlementState(json, snapshot.Settlement);
        appendWeatherConfig(json, snapshot.Weather);
        appendString(json, "saveId", snapshot.SaveId, true);
        json.Append("\"exportedAtUtc\":\"");
        json.Append(snapshot.ExportedAtUtc.ToString("O", CultureInfo.InvariantCulture));
        json.Append("\",");
        json.Append("\"spaceStation\":{");
        appendNumber(json, "currentLevel", snapshot.SpaceStationCurrentLevel, true);
        appendNumber(json, "highestLevelAchieved", snapshot.SpaceStationHighestLevelAchieved, false);
        json.Append("},");
        json.Append("\"logisticsZones\":[");
        for (int i = 0; i < snapshot.Production.LogisticsZones.Count; i++)
        {
            LogisticsZoneSnapshot zone = snapshot.Production.LogisticsZones[i];
            json.Append('{');
            appendNumber(json, "id", zone.Id, true);
            appendNullableString(json, "name", zone.Name, false);
            json.Append('}');
            if (i < snapshot.Production.LogisticsZones.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"chickenFarms\":[");
        for (int i = 0; i < snapshot.Production.ChickenFarmEntities.Count; i++)
        {
            ChickenFarmEntitySnapshot farm = snapshot.Production.ChickenFarmEntities[i];
            json.Append('{');
            appendNumber(json, "entityId", farm.EntityId, true);
            appendString(json, "prototypeId", SnapshotTracking.ChickenFarmPrototypeId, true);
            json.Append("\"running\":");
            json.Append(farm.Running ? "true" : "false");
            json.Append(',');
            json.Append("\"slaughtering\":");
            json.Append(farm.Slaughtering ? "true" : "false");
            json.Append(',');
            appendNumber(json, "chickens", farm.Chickens, true);
            json.Append("\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < farm.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]}");
            if (i < snapshot.Production.ChickenFarmEntities.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"cropFarms\":[");
        for (int i = 0; i < snapshot.Production.CropFarmEntities.Count; i++)
        {
            CropFarmEntitySnapshot farm = snapshot.Production.CropFarmEntities[i];
            json.Append('{');
            appendNumber(json, "entityId", farm.EntityId, true);
            appendString(json, "prototypeId", farm.PrototypeId, true);
            json.Append("\"running\":");
            json.Append(farm.Running ? "true" : "false");
            json.Append(',');
            appendNumber(json, "fertilityTargetPercent", farm.FertilityTargetPercent, true);
            appendNullableString(json, "fertilizerProductId", farm.FertilizerProductId, true);
            json.Append("\"schedule\":[");
            for (int scheduleIndex = 0; scheduleIndex < farm.Schedule.Length; scheduleIndex++)
            {
                string cropId = farm.Schedule[scheduleIndex];
                if (cropId == null)
                {
                    json.Append("null");
                }
                else
                {
                    json.Append('"');
                    appendEscapedString(json, cropId);
                    json.Append('"');
                }

                if (scheduleIndex < farm.Schedule.Length - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < farm.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]}");
            if (i < snapshot.Production.CropFarmEntities.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"machines\":[");
        for (int i = 0; i < snapshot.Production.Machines.Count; i++)
        {
            MachineInventorySnapshot machine = snapshot.Production.Machines[i];
            json.Append('{');
            appendNumber(json, "entityId", machine.EntityId, true);
            appendString(json, "kind", "groundwater-pump", true);
            appendString(json, "prototypeId", machine.PrototypeId, true);
            json.Append("\"running\":");
            json.Append(machine.Running ? "true" : "false");
            json.Append(',');
            appendNullableString(json, "customTitle", machine.CustomTitle, true);
            json.Append("\"tile\":{");
            appendNumber(json, "x", machine.TileX, true);
            appendNumber(json, "y", machine.TileY, false);
            json.Append("},\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < machine.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = machine.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < machine.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"aquifer\":");
            if (machine.Aquifer == null)
            {
                json.Append("null");
            }
            else
            {
                json.Append('{');
                appendString(json, "id", machine.Aquifer.Id, true);
                json.Append("\"position\":{");
                appendNumber(json, "x", machine.Aquifer.PositionX, true);
                appendNumber(json, "y", machine.Aquifer.PositionY, false);
                json.Append("},");
                appendNumber(json, "quantity", machine.Aquifer.Quantity, true);
                appendNumber(json, "capacity", machine.Aquifer.Capacity, true);
                appendNumber(
                    json,
                    "configuredCapacity",
                    machine.Aquifer.ConfiguredCapacity,
                    false);
                json.Append('}');
            }
            json.Append('}');
            if (i < snapshot.Production.Machines.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"groundwater\":{");
        appendNumber(
            json,
            "depletedPumpSpeedPercent",
            snapshot.GroundwaterDepletedPumpSpeedPercent,
            true);
        appendNumber(
            json,
            "replenishWhenLowPercent",
            snapshot.GroundwaterReplenishWhenLowPercent,
            false);
        json.Append("},");
        appendContractState(json, snapshot.Contracts);
        json.Append(',');
        json.Append("\"productionEntities\":[");
        for (int i = 0; i < snapshot.Production.ProductionEntities.Count; i++)
        {
            ProductionEntitySnapshot entity = snapshot.Production.ProductionEntities[i];
            json.Append('{');
            appendNumber(json, "entityId", entity.EntityId, true);
            appendString(json, "prototypeId", entity.PrototypeId, true);
            json.Append("\"running\":");
            json.Append(entity.Running ? "true" : "false");
            json.Append(',');
            json.Append("\"recipeIds\":[");
            for (int recipeIndex = 0; recipeIndex < entity.RecipeIds.Count; recipeIndex++)
            {
                json.Append('"');
                appendEscapedString(json, entity.RecipeIds[recipeIndex]);
                json.Append('"');
                if (recipeIndex < entity.RecipeIds.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < entity.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"nuclearReactor\":");
            if (entity.NuclearReactor == null)
            {
                json.Append("null");
            }
            else
            {
                json.Append('{');
                appendNumber(
                    json,
                    "enrichmentStep",
                    entity.NuclearReactor.EnrichmentStep,
                    true);
                appendNumber(
                    json,
                    "targetPowerPercent",
                    entity.NuclearReactor.TargetPowerPercent,
                    false);
                json.Append('}');
            }
            json.Append(",\"dataCenterRacks\":");
            if (entity.DataCenterRacks.HasValue)
            {
                json.Append(entity.DataCenterRacks.Value.ToString(CultureInfo.InvariantCulture));
            }
            else
            {
                json.Append("null");
            }
            json.Append(",\"trainStation\":");
            appendTrainStationConfiguration(json, entity.TrainStation);
            json.Append('}');
            if (i < snapshot.Production.ProductionEntities.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"areaEntities\":[");
        for (int i = 0; i < snapshot.Production.AreaEntities.Count; i++)
        {
            AreaEntitySnapshot entity = snapshot.Production.AreaEntities[i];
            json.Append('{');
            appendNumber(json, "entityId", entity.EntityId, true);
            appendString(json, "prototypeId", entity.PrototypeId, true);
            appendString(json, "prototypeName", entity.PrototypeName, true);
            appendString(json, "constructionState", entity.ConstructionState, true);
            json.Append("\"constructed\":");
            json.Append(entity.Constructed ? "true" : "false");
            json.Append(',');
            json.Append("\"running\":");
            json.Append(entity.Running ? "true" : "false");
            json.Append(',');
            json.Append("\"tile\":{");
            appendNumber(json, "x", entity.TileX, true);
            appendNumber(json, "y", entity.TileY, false);
            json.Append("},\"zones\":[");
            for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                json.Append('{');
                appendNumber(json, "id", zone.Id, true);
                appendNullableString(json, "name", zone.Name, false);
                json.Append('}');
                if (zoneIndex < entity.Zones.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],\"recipes\":[");
            for (int recipeIndex = 0; recipeIndex < entity.Recipes.Count; recipeIndex++)
            {
                AreaRecipeSnapshot recipe = entity.Recipes[recipeIndex];
                json.Append('{');
                appendString(json, "id", recipe.Id, true);
                appendString(json, "name", recipe.Name, true);
                appendDecimal(json, "durationSeconds", recipe.DurationSeconds, true);
                json.Append("\"assigned\":");
                json.Append(recipe.Assigned ? "true" : "false");
                json.Append(',');
                appendAreaRecipeProducts(json, "inputs", recipe.Inputs, true);
                appendAreaRecipeProducts(json, "outputs", recipe.Outputs, false);
                json.Append('}');
                if (recipeIndex < entity.Recipes.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("],");
            appendNumber(
                json,
                "availableRecipeCount",
                entity.AvailableRecipeCount,
                true);
            json.Append("\"oreSorter\":");
            appendOreSorterConfiguration(json, entity.OreSorter);
            json.Append(",\"trainStation\":");
            appendTrainStationConfiguration(json, entity.TrainStation);
            json.Append(",\"forestry\":");
            appendForestryConfiguration(json, entity.Forestry);
            json.Append(",\"office\":");
            appendOfficeConfiguration(json, entity.Office);
            json.Append('}');
            if (i < snapshot.Production.AreaEntities.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"mineTowers\":[");
        for (int i = 0; i < snapshot.Production.MineTowers.Count; i++)
        {
            MineTowerSnapshot tower = snapshot.Production.MineTowers[i];
            json.Append('{');
            appendNumber(json, "entityId", tower.EntityId, true);
            json.Append("\"assignedOreSorterEntityIds\":[");
            for (int sorterIndex = 0;
                sorterIndex < tower.AssignedOreSorterEntityIds.Count;
                sorterIndex++)
            {
                json.Append(tower.AssignedOreSorterEntityIds[sorterIndex]
                    .ToString(CultureInfo.InvariantCulture));
                if (sorterIndex < tower.AssignedOreSorterEntityIds.Count - 1)
                {
                    json.Append(',');
                }
            }
            json.Append("]}");
            if (i < snapshot.Production.MineTowers.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("],");
        json.Append("\"vehicles\":{");
        appendNumber(json, "workersAssigned", snapshot.WorkersAssigned, false);
        json.Append("},");
        json.Append("\"research\":{");
        for (int i = 0; i < SnapshotTracking.TrackedResearch.Length; i++)
        {
            appendNumber(
                json,
                SnapshotTracking.TrackedResearch[i].Key,
                snapshot.ResearchLevels[i],
                i < SnapshotTracking.TrackedResearch.Length - 1);
        }
        json.Append("},");
        json.Append("\"edicts\":{");
        for (int i = 0; i < SnapshotTracking.TrackedEdicts.Length; i++)
        {
            EdictState state = snapshot.EdictStates[i];
            json.Append('\"');
            json.Append(SnapshotTracking.TrackedEdicts[i].Key);
            json.Append("\":{");
            appendNumber(json, "enabledLevel", state.EnabledLevel, true);
            appendNumber(json, "activeLevel", state.ActiveLevel, true);
            appendNullableString(json, "inactiveReason", state.InactiveReason, false);
            json.Append('}');
            if (i < SnapshotTracking.TrackedEdicts.Length - 1)
            {
                json.Append(',');
            }
        }
        json.Append("},");
        json.Append("\"reserves\":{");
        for (int i = 0; i < SnapshotTracking.TrackedReserves.Length; i++)
        {
            appendNumber(
                json,
                SnapshotTracking.TrackedReserves[i].Key,
                snapshot.Reserves[i],
                i < SnapshotTracking.TrackedReserves.Length - 1);
        }
        json.Append("},");
        json.Append("\"history\":{");
        appendNumber(json, "windowMonths", SnapshotTracking.HistoryWindowMonths, true);
        json.Append("\"maintenance\":{");
        appendHistoryAverage(json, "maintenanceI", snapshot.MaintenanceI, true);
        appendHistoryAverage(json, "maintenanceII", snapshot.MaintenanceII, true);
        appendHistoryAverage(json, "maintenanceIII", snapshot.MaintenanceIII, false);
        json.Append("},");
        json.Append("\"hydrogenFuel\":{");
        appendHistoryAverage(json, "total", snapshot.HydrogenFuel.Total, true);
        json.Append("\"byUse\":{");
        appendHistoryAverage(json, "vehicles", snapshot.HydrogenFuel.Vehicles, true);
        appendHistoryAverage(json, "cargoShips", snapshot.HydrogenFuel.CargoShips, true);
        appendHistoryAverage(json, "battleShip", snapshot.HydrogenFuel.BattleShip, true);
        appendHistoryAverage(json, "powerGenerators", snapshot.HydrogenFuel.PowerGenerators, true);
        appendHistoryAverage(json, "trains", snapshot.HydrogenFuel.Trains, false);
        json.Append("}},");
        json.Append("\"electricityGeneration\":{");
        json.Append("\"byType\":[");
        for (int i = 0; i < snapshot.GenerationByType.Count; i++)
        {
            GenerationHistory generation = snapshot.GenerationByType[i];
            json.Append('{');
            appendString(json, "prototypeId", generation.PrototypeId, true);
            appendString(json, "name", generation.Name, true);
            appendDecimal(json, "averageMw", generation.Average.Value, true);
            appendNumber(json, "sampleMonths", generation.Average.SampleMonths, false);
            json.Append('}');
            if (i < snapshot.GenerationByType.Count - 1)
            {
                json.Append(',');
            }
        }
        json.Append("]}}}");
        return json.ToString();
    }
}
