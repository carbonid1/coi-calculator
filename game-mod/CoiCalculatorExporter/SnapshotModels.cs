using System;
using System.Collections.Generic;

internal sealed class SnapshotDocument
{
    public readonly string SaveId;
    public readonly string GameId;
    public readonly string SessionId;
    public readonly DateTime ExportedAtUtc;
    public readonly int SpaceStationCurrentLevel;
    public readonly int SpaceStationHighestLevelAchieved;
    public readonly ProductionSnapshot Production;
    public readonly int GroundwaterDepletedPumpSpeedPercent;
    public readonly int GroundwaterReplenishWhenLowPercent;
    public readonly ContractStateSnapshot Contracts;
    public readonly int WorkersAssigned;
    public readonly int[] ResearchLevels;
    public readonly EdictState[] EdictStates;
    public readonly List<FocusStateSnapshot> FocusStates;
    public readonly List<StorageSnapshot> Storages;
    public readonly WorldStateSnapshot World;
    public readonly HistoryAverage MaintenanceI;
    public readonly HistoryAverage MaintenanceII;
    public readonly HistoryAverage MaintenanceIII;
    public readonly FuelHistory HydrogenFuel;
    public readonly List<GenerationHistory> GenerationByType;
    public readonly SettlementStateSnapshot Settlement;
    public readonly WeatherConfigSnapshot Weather;
    public readonly RecyclingSnapshot Recycling;
    public readonly List<BuildingDefinitionSnapshot> BuildingDefinitions;
    public readonly ChickenFarmDefinitionSnapshot ChickenFarmDefinition;

    public SnapshotDocument(
        string saveId,
        string gameId,
        string sessionId,
        DateTime exportedAtUtc,
        int spaceStationCurrentLevel,
        int spaceStationHighestLevelAchieved,
        ProductionSnapshot production,
        int groundwaterDepletedPumpSpeedPercent,
        int groundwaterReplenishWhenLowPercent,
        ContractStateSnapshot contracts,
        int workersAssigned,
        int[] researchLevels,
        EdictState[] edictStates,
        List<FocusStateSnapshot> focusStates,
        List<StorageSnapshot> storages,
        WorldStateSnapshot world,
        HistoryAverage maintenanceI,
        HistoryAverage maintenanceII,
        HistoryAverage maintenanceIII,
        FuelHistory hydrogenFuel,
        List<GenerationHistory> generationByType,
        SettlementStateSnapshot settlement,
        WeatherConfigSnapshot weather,
        RecyclingSnapshot recycling,
        List<BuildingDefinitionSnapshot> buildingDefinitions,
        ChickenFarmDefinitionSnapshot chickenFarmDefinition)
    {
        SaveId = saveId;
        GameId = gameId;
        SessionId = sessionId;
        ExportedAtUtc = exportedAtUtc;
        SpaceStationCurrentLevel = spaceStationCurrentLevel;
        SpaceStationHighestLevelAchieved = spaceStationHighestLevelAchieved;
        Production = production;
        GroundwaterDepletedPumpSpeedPercent = groundwaterDepletedPumpSpeedPercent;
        GroundwaterReplenishWhenLowPercent = groundwaterReplenishWhenLowPercent;
        Contracts = contracts;
        WorkersAssigned = workersAssigned;
        ResearchLevels = researchLevels;
        EdictStates = edictStates;
        FocusStates = focusStates;
        Storages = storages;
        World = world;
        MaintenanceI = maintenanceI;
        MaintenanceII = maintenanceII;
        MaintenanceIII = maintenanceIII;
        HydrogenFuel = hydrogenFuel;
        GenerationByType = generationByType;
        Settlement = settlement;
        Weather = weather;
        Recycling = recycling;
        BuildingDefinitions = buildingDefinitions;
        ChickenFarmDefinition = chickenFarmDefinition;
    }
}
