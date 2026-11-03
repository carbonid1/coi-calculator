using System;
using System.Globalization;

using Mafi.Core;
using Mafi.Core.Population;
using Mafi.Core.SpaceProgram;

internal sealed partial class GameSnapshotCollector
{
    public SnapshotDocument Capture()
    {
        SnapshotEntities entities = getSnapshotEntities();
        int workersAssigned = 0;
        int[] researchLevels = getResearchLevels();
        EdictState[] edictStates = getEdictStates();
        var storages = getStorageInventory(entities);
        WorldStateSnapshot world = getWorldStateSnapshot(entities);
        var fertilizers = getFertilizerSources();
        ProductionSnapshot production = getProductionSnapshot(entities.Production, fertilizers);
        ContractStateSnapshot contracts = getContractStateSnapshot(entities.CargoDepots);

        foreach (var vehicle in m_vehiclesManager.AllVehicles)
        {
            workersAssigned += EntityWithWorkersExtensions.WorkersAssigned(vehicle);
        }

        DateTime exportedAtUtc = DateTime.UtcNow;
        SpaceStation spaceStation = m_orbitManager.SpaceStation.ValueOrNull;
        int depletedPumpSpeedPercent = m_propertiesDb.GetProperty(
            IdsCore.PropertyIds.GroundWaterPumpSpeedWhenDepleted)
            .Value
            .ToIntPercentRounded();
        int replenishWhenLowPercent = m_propertiesDb.GetProperty(
            IdsCore.PropertyIds.GroundWaterReplenishWhenLow)
            .Value
            .ToIntPercentRounded();

        return new SnapshotDocument(
            m_gameNameConfig.GameName,
            m_gameIdProvider.GameId.ToString(CultureInfo.InvariantCulture),
            m_gameIdProvider.SessionId.ToString(CultureInfo.InvariantCulture),
            exportedAtUtc,
            spaceStation == null ? 0 : spaceStation.CurrentTier,
            m_orbitManager.HighestStationTierAchieved,
            production,
            depletedPumpSpeedPercent,
            replenishWhenLowPercent,
            contracts,
            workersAssigned,
            researchLevels,
            edictStates,
            getFocusStates(),
            storages,
            world,
            m_maintenanceI,
            m_maintenanceII,
            m_maintenanceIII,
            m_hydrogenFuel,
            m_generationByType,
            getSettlementState(),
            m_weatherConfig,
            getRecyclingSnapshot(),
            getBuildingDefinitions(),
            getChickenFarmDefinition(),
            getRocketIiDefinition(),
            getSpaceStationLevels(),
            getCropFarmingSnapshot(fertilizers));
    }
}
