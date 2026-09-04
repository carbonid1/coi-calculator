using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Maintenance;
using Mafi.Core.Population.Edicts;
using Mafi.Core.Prototypes;
using Mafi.Core.Research;
using Mafi.Core.Stats;
using Mafi.Core.Trains;

internal sealed partial class GameSnapshotCollector
{
    private int[] getResearchLevels()
    {
        int[] levels = new int[SnapshotTracking.TrackedResearch.Length];

        foreach (ResearchNode node in m_researchManager.AllNodes)
        {
            int index;
            if (SnapshotTracking.TrackedResearchIndices.TryGetValue(node.Proto.Id.ToString(), out index))
            {
                levels[index] = Math.Max(0, node.TimesResearched);
            }
        }

        return levels;
    }

    private EdictState[] getEdictStates()
    {
        EdictState[] states = new EdictState[SnapshotTracking.TrackedEdicts.Length];
        for (int i = 0; i < states.Length; i++)
        {
            states[i] = new EdictState();
        }

        foreach (Edict edict in m_edictsManager.AllEdicts)
        {
            TrackedEdictTier tier;
            if (!SnapshotTracking.TrackedEdictTiers.TryGetValue(edict.Prototype.Id.ToString(), out tier))
            {
                continue;
            }

            EdictState state = states[tier.EdictIndex];
            if (edict.IsEnabled && tier.Level >= state.EnabledLevel)
            {
                state.EnabledLevel = tier.Level;
                state.InactiveReason = edict.IsActive
                    || String.IsNullOrWhiteSpace(edict.LastReasonForNotBeingActive)
                    ? null
                    : edict.LastReasonForNotBeingActive;
            }

            if (edict.IsActive && tier.Level > state.ActiveLevel)
            {
                state.ActiveLevel = tier.Level;
            }
        }

        for (int i = 0; i < states.Length; i++)
        {
            if (states[i].ActiveLevel == states[i].EnabledLevel)
            {
                states[i].InactiveReason = null;
            }
        }

        return states;
    }

    private int[] getReserveQuantities()
    {
        HashSet<EntityId> stationLinkedStorageIds = new HashSet<EntityId>();

        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            ITrainStationModule stationModule = entity as ITrainStationModule;
            if (stationModule == null)
            {
                continue;
            }

            foreach (StorageBase connectedStorage in stationModule.GetConnectedStorages())
            {
                stationLinkedStorageIds.Add(connectedStorage.Id);
            }
        }

        long[] quantities = new long[SnapshotTracking.TrackedReserves.Length];
        foreach (IEntity entity in m_entitiesManager.Entities)
        {
            Storage storage = entity as Storage;
            if (storage == null
                || storage.IsDestroyed
                || !storage.IsConstructed
                || stationLinkedStorageIds.Contains(storage.Id)
                || storage.AssignedInputs.Count > 0
                || !storage.StoredProduct.HasValue)
            {
                continue;
            }

            string productId = storage.StoredProduct.Value.Id.ToString();
            int reserveIndex;
            if (!SnapshotTracking.TrackedReserveProductIndices.TryGetValue(productId, out reserveIndex))
            {
                continue;
            }

            quantities[reserveIndex] = Math.Min(
                Int32.MaxValue,
                quantities[reserveIndex] + storage.CurrentQuantity.Value);
        }

        int[] result = new int[SnapshotTracking.TrackedReserves.Length];
        for (int i = 0; i < quantities.Length; i++)
        {
            result[i] = (int)quantities[i];
        }

        return result;
    }

    public void RefreshHistory()
    {
        m_maintenanceI = HistoryAverage.Empty;
        m_maintenanceII = HistoryAverage.Empty;
        m_maintenanceIII = HistoryAverage.Empty;

        foreach (IMaintenanceBufferReadonly buffer in m_maintenanceManager.MaintenanceBuffers)
        {
            string productId = buffer.Product.Id.ToString();
            HistoryAverage average = getHistoryAverage(buffer.ConsumedTotalStats, 1.0);

            if (String.Equals(productId, SnapshotTracking.MaintenanceT1ProductId, StringComparison.Ordinal))
            {
                m_maintenanceI = average;
            }
            else if (String.Equals(productId, SnapshotTracking.MaintenanceT2ProductId, StringComparison.Ordinal))
            {
                m_maintenanceII = average;
            }
            else if (String.Equals(productId, SnapshotTracking.MaintenanceT3ProductId, StringComparison.Ordinal))
            {
                m_maintenanceIII = average;
            }
        }

        m_hydrogenFuel = getHydrogenFuelHistory();
        m_generationByType = getGenerationHistory();
    }


    private FuelHistory getHydrogenFuelHistory()
    {
        foreach (FuelStatsCollector.StatsPerProduct stats in m_fuelStatsCollector.Stats)
        {
            if (!String.Equals(stats.Product.Id.ToString(), SnapshotTracking.HydrogenProductId, StringComparison.Ordinal))
            {
                continue;
            }

            HistoryAverage vehicles = getHistoryAverage(stats.TotalConsumedInVehicles, 1.0);
            HistoryAverage cargoShips = getHistoryAverage(stats.TotalConsumedInCargoShips, 1.0);
            HistoryAverage battleShip = getHistoryAverage(stats.TotalConsumedInBattleship, 1.0);
            HistoryAverage powerGenerators = getHistoryAverage(
                stats.TotalConsumedInPowerGenerators,
                1.0);
            HistoryAverage trains = getHistoryAverage(stats.TotalConsumedInTrains, 1.0);
            int sampleMonths = Math.Max(
                Math.Max(vehicles.SampleMonths, cargoShips.SampleMonths),
                Math.Max(
                    Math.Max(battleShip.SampleMonths, powerGenerators.SampleMonths),
                    trains.SampleMonths));
            double totalAverage = sampleMonths == 0
                ? 0
                : (vehicles.Value * vehicles.SampleMonths
                    + cargoShips.Value * cargoShips.SampleMonths
                    + battleShip.Value * battleShip.SampleMonths
                    + powerGenerators.Value * powerGenerators.SampleMonths
                    + trains.Value * trains.SampleMonths)
                    / sampleMonths;

            return new FuelHistory(
                new HistoryAverage(totalAverage, sampleMonths),
                vehicles,
                cargoShips,
                battleShip,
                powerGenerators,
                trains);
        }

        return FuelHistory.Empty;
    }

    private List<GenerationHistory> getGenerationHistory()
    {
        List<GenerationHistory> result = new List<GenerationHistory>();

        foreach (ElectricityManager.ProductionPerProto production
            in m_electricityManager.GetProductionStatsPerProto())
        {
            Proto producerProto = production.ProducerProto as Proto;
            string prototypeId = producerProto == null
                ? production.ProducerProto.ToString()
                : producerProto.Id.ToString();
            string name = producerProto == null
                ? prototypeId
                : producerProto.Strings.Name.TranslatedString;

            result.Add(new GenerationHistory(
                prototypeId,
                String.IsNullOrWhiteSpace(name) ? prototypeId : name,
                getHistoryAverage(production.ProductionStats, 0.001)));
        }

        result.Sort(delegate(GenerationHistory left, GenerationHistory right)
        {
            return String.Compare(left.PrototypeId, right.PrototypeId, StringComparison.Ordinal);
        });
        return result;
    }

    private static HistoryAverage getHistoryAverage(ItemStats stats, double scale)
    {
        Lyst<long> monthly = new Lyst<long>(SnapshotTracking.HistoryWindowMonths);
        stats.GetLatestData(StatsDataRange.Last120Months, monthly);
        int sampleMonths = Math.Min(SnapshotTracking.HistoryWindowMonths, monthly.Count);

        if (sampleMonths == 0)
        {
            return HistoryAverage.Empty;
        }

        double total = 0;
        for (int i = 0; i < sampleMonths; i++)
        {
            total += monthly[i];
        }

        return new HistoryAverage(total / sampleMonths * scale, sampleMonths);
    }
}
