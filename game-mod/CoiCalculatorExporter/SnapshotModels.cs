using System;
using System.Collections.Generic;

internal sealed class SnapshotDocument
{
    public readonly string SaveId;
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
    public readonly int[] Reserves;
    public readonly HistoryAverage MaintenanceI;
    public readonly HistoryAverage MaintenanceII;
    public readonly HistoryAverage MaintenanceIII;
    public readonly FuelHistory HydrogenFuel;
    public readonly List<GenerationHistory> GenerationByType;
    public readonly SettlementStateSnapshot Settlement;
    public readonly WeatherConfigSnapshot Weather;

    public SnapshotDocument(
        string saveId,
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
        int[] reserves,
        HistoryAverage maintenanceI,
        HistoryAverage maintenanceII,
        HistoryAverage maintenanceIII,
        FuelHistory hydrogenFuel,
        List<GenerationHistory> generationByType,
        SettlementStateSnapshot settlement,
        WeatherConfigSnapshot weather)
    {
        SaveId = saveId;
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
        Reserves = reserves;
        MaintenanceI = maintenanceI;
        MaintenanceII = maintenanceII;
        MaintenanceIII = maintenanceIII;
        HydrogenFuel = hydrogenFuel;
        GenerationByType = generationByType;
        Settlement = settlement;
        Weather = weather;
    }
}
