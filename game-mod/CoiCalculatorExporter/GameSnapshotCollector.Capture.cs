using System;

using Mafi.Core;
using Mafi.Core.Population;
using Mafi.Core.SpaceProgram;

internal sealed partial class GameSnapshotCollector
{
    public SnapshotDocument Capture()
    {
        int workersAssigned = 0;
        int[] researchLevels = getResearchLevels();
        EdictState[] edictStates = getEdictStates();
        int[] reserves = getReserveQuantities();
        ProductionSnapshot production = getProductionSnapshot();
        ContractStateSnapshot contracts = getContractStateSnapshot();

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
            reserves,
            m_maintenanceI,
            m_maintenanceII,
            m_maintenanceIII,
            m_hydrogenFuel,
            m_generationByType,
            getSettlementState(),
            m_weatherConfig);
    }
}
