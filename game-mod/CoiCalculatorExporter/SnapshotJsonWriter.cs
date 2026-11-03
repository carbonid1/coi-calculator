using System.Globalization;

internal static partial class SnapshotJsonWriter
{
    public static string Serialize(SnapshotDocument snapshot)
    {
        SnapshotJsonStream json = new SnapshotJsonStream(3600);
        json.BeginObject();
        json.Field("schemaVersion", 44);
        appendRecycling(json, snapshot.Recycling);
        appendBuildingDefinitions(json, snapshot.BuildingDefinitions);
        json.Field("gameVersion", Mafi.GameVersion.Version.ToString());
        json.Field("gameId", snapshot.GameId);
        json.Field("sessionId", snapshot.SessionId);
        appendSettlementState(json, snapshot.Settlement);
        appendWeatherConfig(json, snapshot.Weather);
        json.Field("saveId", snapshot.SaveId);
        json.Field("exportedAtUtc", snapshot.ExportedAtUtc.ToString("O", CultureInfo.InvariantCulture));
        json.Name("spaceStation").BeginObject();
        json.Field("currentLevel", snapshot.SpaceStationCurrentLevel);
        json.Field("highestLevelAchieved", snapshot.SpaceStationHighestLevelAchieved);
        json.EndObject();
        json.Name("logisticsZones").BeginArray();
        for (int i = 0; i < snapshot.Production.LogisticsZones.Count; i++)
        {
            LogisticsZoneSnapshot zone = snapshot.Production.LogisticsZones[i];
            json.BeginObject();
            json.Field("id", zone.Id);
            json.Field("name", zone.Name);
            json.EndObject();
        }
        json.EndArray();
        json.Name("chickenFarms").BeginArray();
        for (int i = 0; i < snapshot.Production.ChickenFarmEntities.Count; i++)
        {
            ChickenFarmEntitySnapshot farm = snapshot.Production.ChickenFarmEntities[i];
            json.BeginObject();
            json.Field("entityId", farm.EntityId);
            json.Field("prototypeId", SnapshotTracking.ChickenFarmPrototypeId);
            json.Field("running", farm.Running);
            json.Field("slaughtering", farm.Slaughtering);
            json.Field("chickens", farm.Chickens);
            json.Name("zones").BeginArray();
            for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                json.BeginObject();
                json.Field("id", zone.Id);
                json.Field("name", zone.Name);
                json.EndObject();
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("cropFarms").BeginArray();
        for (int i = 0; i < snapshot.Production.CropFarmEntities.Count; i++)
        {
            CropFarmEntitySnapshot farm = snapshot.Production.CropFarmEntities[i];
            json.BeginObject();
            json.Field("entityId", farm.EntityId);
            json.Field("prototypeId", farm.PrototypeId);
            json.Field("running", farm.Running);
            json.Field("fertilityTargetPercent", farm.FertilityTargetPercent);
            json.Field("fertilizerProductId", farm.FertilizerProductId);
            json.Name("schedule").BeginArray();
            for (int scheduleIndex = 0; scheduleIndex < farm.Schedule.Length; scheduleIndex++)
            {
                string cropId = farm.Schedule[scheduleIndex];
                json.Value(cropId);
            }
            json.EndArray();
            json.Name("zones").BeginArray();
            for (int zoneIndex = 0; zoneIndex < farm.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = farm.Zones[zoneIndex];
                json.BeginObject();
                json.Field("id", zone.Id);
                json.Field("name", zone.Name);
                json.EndObject();
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("machines").BeginArray();
        for (int i = 0; i < snapshot.Production.Machines.Count; i++)
        {
            MachineInventorySnapshot machine = snapshot.Production.Machines[i];
            json.BeginObject();
            json.Field("entityId", machine.EntityId);
            json.Field("kind", "groundwater-pump");
            json.Field("prototypeId", machine.PrototypeId);
            json.Field("running", machine.Running);
            json.Field("customTitle", machine.CustomTitle);
            json.Name("tile").BeginObject();
            json.Field("x", machine.TileX);
            json.Field("y", machine.TileY);
            json.EndObject();
            json.Name("zones").BeginArray();
            for (int zoneIndex = 0; zoneIndex < machine.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = machine.Zones[zoneIndex];
                json.BeginObject();
                json.Field("id", zone.Id);
                json.Field("name", zone.Name);
                json.EndObject();
            }
            json.EndArray();
            json.Name("aquifer");
            if (machine.Aquifer == null)
            {
                json.Value((string)null);
            }
            else
            {
                json.BeginObject();
                json.Field("id", machine.Aquifer.Id);
                json.Name("position").BeginObject();
                json.Field("x", machine.Aquifer.PositionX);
                json.Field("y", machine.Aquifer.PositionY);
                json.EndObject();
                json.Field("quantity", machine.Aquifer.Quantity);
                json.Field("capacity", machine.Aquifer.Capacity);
                json.Field("configuredCapacity", machine.Aquifer.ConfiguredCapacity);
                json.EndObject();
            }
            json.EndObject();
        }
        json.EndArray();
        json.Name("groundwater").BeginObject();
        json.Field("depletedPumpSpeedPercent", snapshot.GroundwaterDepletedPumpSpeedPercent);
        json.Field("replenishWhenLowPercent", snapshot.GroundwaterReplenishWhenLowPercent);
        json.EndObject();
        appendContractState(json, snapshot.Contracts);
        json.Name("productionEntities").BeginArray();
        for (int i = 0; i < snapshot.Production.ProductionEntities.Count; i++)
        {
            ProductionEntitySnapshot entity = snapshot.Production.ProductionEntities[i];
            json.BeginObject();
            json.Field("entityId", entity.EntityId);
            json.Field("prototypeId", entity.PrototypeId);
            json.Field("running", entity.Running);
            json.Name("recipeIds").BeginArray();
            for (int recipeIndex = 0; recipeIndex < entity.RecipeIds.Count; recipeIndex++)
            {
                json.Value(entity.RecipeIds[recipeIndex]);
            }
            json.EndArray();
            json.Name("zones").BeginArray();
            for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                json.BeginObject();
                json.Field("id", zone.Id);
                json.Field("name", zone.Name);
                json.EndObject();
            }
            json.EndArray();
            json.Name("nuclearReactor");
            if (entity.NuclearReactor == null)
            {
                json.Value((string)null);
            }
            else
            {
                json.BeginObject();
                json.Field("enrichmentStep", entity.NuclearReactor.EnrichmentStep);
                json.Field("targetPowerPercent", entity.NuclearReactor.TargetPowerPercent);
                json.EndObject();
            }
            json.Name("dataCenterRacks");
            if (entity.DataCenterRacks.HasValue)
            {
                json.Value(entity.DataCenterRacks.Value);
            }
            else
            {
                json.Value((string)null);
            }
            json.Name("trainStation");
            appendTrainStationConfiguration(json, entity.TrainStation);
            json.EndObject();
        }
        json.EndArray();
        json.Name("areaEntities").BeginArray();
        for (int i = 0; i < snapshot.Production.AreaEntities.Count; i++)
        {
            AreaEntitySnapshot entity = snapshot.Production.AreaEntities[i];
            json.BeginObject();
            json.Field("entityId", entity.EntityId);
            json.Field("prototypeId", entity.PrototypeId);
            json.Field("prototypeName", entity.PrototypeName);
            json.Field("constructionState", entity.ConstructionState);
            json.Field("constructed", entity.Constructed);
            json.Field("running", entity.Running);
            json.Name("tile").BeginObject();
            json.Field("x", entity.TileX);
            json.Field("y", entity.TileY);
            json.EndObject();
            json.Name("zones").BeginArray();
            for (int zoneIndex = 0; zoneIndex < entity.Zones.Count; zoneIndex++)
            {
                LogisticsZoneSnapshot zone = entity.Zones[zoneIndex];
                json.BeginObject();
                json.Field("id", zone.Id);
                json.Field("name", zone.Name);
                json.EndObject();
            }
            json.EndArray();
            json.Name("recipes").BeginArray();
            for (int recipeIndex = 0; recipeIndex < entity.Recipes.Count; recipeIndex++)
            {
                AreaRecipeSnapshot recipe = entity.Recipes[recipeIndex];
                json.BeginObject();
                json.Field("id", recipe.Id);
                json.Field("name", recipe.Name);
                appendDecimal(json, "durationSeconds", recipe.DurationSeconds);
                appendDecimal(json, "electricityMultiplier", recipe.ElectricityMultiplier);
                json.Field("assigned", recipe.Assigned);
                json.Field("recyclesInputs", recipe.RecyclesInputs);
                if (recipe.RecyclingInputSources != null)
                {
                    appendRecyclingSources(json, "recyclingInputSources", recipe.RecyclingInputSources);
                }
                appendAreaRecipeProducts(json, "inputs", recipe.Inputs);
                appendAreaRecipeProducts(json, "outputs", recipe.Outputs);
                json.EndObject();
            }
            json.EndArray();
            json.Field("availableRecipeCount", entity.AvailableRecipeCount);
            json.Name("oreSorter");
            appendOreSorterConfiguration(json, entity.OreSorter);
            json.Name("trainStation");
            appendTrainStationConfiguration(json, entity.TrainStation);
            json.Name("forestry");
            appendForestryConfiguration(json, entity.Forestry);
            json.Name("office");
            appendOfficeConfiguration(json, entity.Office);
            json.EndObject();
        }
        json.EndArray();
        json.Name("mineTowers").BeginArray();
        for (int i = 0; i < snapshot.Production.MineTowers.Count; i++)
        {
            MineTowerSnapshot tower = snapshot.Production.MineTowers[i];
            json.BeginObject();
            json.Field("entityId", tower.EntityId);
            json.Name("assignedOreSorterEntityIds").BeginArray();
            for (int sorterIndex = 0;
                sorterIndex < tower.AssignedOreSorterEntityIds.Count;
                sorterIndex++)
            {
                json.Value(tower.AssignedOreSorterEntityIds[sorterIndex]);
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("vehicles").BeginObject();
        json.Field("workersAssigned", snapshot.WorkersAssigned);
        json.EndObject();
        json.Name("research").BeginObject();
        for (int i = 0; i < SnapshotTracking.TrackedResearch.Length; i++)
        {
            json.Field(SnapshotTracking.TrackedResearch[i].Key, snapshot.ResearchLevels[i]);
        }
        json.EndObject();
        json.Name("edicts").BeginObject();
        for (int i = 0; i < SnapshotTracking.TrackedEdicts.Length; i++)
        {
            EdictState state = snapshot.EdictStates[i];
            json.Name(SnapshotTracking.TrackedEdicts[i].Key).BeginObject();
            json.Field("enabledLevel", state.EnabledLevel);
            json.Field("activeLevel", state.ActiveLevel);
            json.Field("inactiveReason", state.InactiveReason);
            json.EndObject();
        }
        json.EndObject();
        appendFocusStates(json, snapshot.FocusStates);
        appendWorldState(json, snapshot.World);
        json.Name("storages").BeginArray();
        for (int i = 0; i < snapshot.Storages.Count; i++)
        {
            appendStorageSnapshot(json, snapshot.Storages[i]);
        }
        json.EndArray();
        json.Name("history").BeginObject();
        json.Field("windowMonths", SnapshotTracking.HistoryWindowMonths);
        json.Name("maintenance").BeginObject();
        appendHistoryAverage(json, "maintenanceI", snapshot.MaintenanceI);
        appendHistoryAverage(json, "maintenanceII", snapshot.MaintenanceII);
        appendHistoryAverage(json, "maintenanceIII", snapshot.MaintenanceIII);
        json.EndObject();
        json.Name("hydrogenFuel").BeginObject();
        appendHistoryAverage(json, "total", snapshot.HydrogenFuel.Total);
        json.Name("byUse").BeginObject();
        appendHistoryAverage(json, "vehicles", snapshot.HydrogenFuel.Vehicles);
        appendHistoryAverage(json, "cargoShips", snapshot.HydrogenFuel.CargoShips);
        appendHistoryAverage(json, "battleShip", snapshot.HydrogenFuel.BattleShip);
        appendHistoryAverage(json, "powerGenerators", snapshot.HydrogenFuel.PowerGenerators);
        appendHistoryAverage(json, "trains", snapshot.HydrogenFuel.Trains);
        json.EndObject().EndObject();
        json.Name("electricityGeneration").BeginObject();
        json.Name("byType").BeginArray();
        for (int i = 0; i < snapshot.GenerationByType.Count; i++)
        {
            GenerationHistory generation = snapshot.GenerationByType[i];
            json.BeginObject();
            json.Field("prototypeId", generation.PrototypeId);
            json.Field("name", generation.Name);
            appendDecimal(json, "averageMw", generation.Average.Value);
            json.Field("sampleMonths", generation.Average.SampleMonths);
            json.EndObject();
        }
        json.EndArray().EndObject();
        json.EndObject().EndObject();
        return json.GetJson();
    }
}
