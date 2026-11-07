using System;
using System.Collections.Generic;

using Mafi.Core.Factory.ElectricPower;
using Mafi.Core.Prototypes;

internal sealed class ElectricitySnapshot
{
    public double DemandMw;
    public double SurplusDemandMw;
    public double ConsumedMw;
    public double GenerationMw;
    public double GenerationCapacityMw;
    public double MaximumGenerationCapacityMw;
    public readonly List<ElectricityConsumerSnapshot> ByType = new List<ElectricityConsumerSnapshot>();
}

internal sealed class ElectricityConsumerSnapshot
{
    public string PrototypeId;
    public string Name;
    public double DemandMw;
    public double ConsumedMw;
    public double MaximumDemandMw;
    public int Entities;
    public bool Transport;
}

internal sealed partial class GameSnapshotCollector
{
    private ElectricitySnapshot getElectricitySnapshot()
    {
        // Native Electricity values are kW, matching building definitions.
        // Demand excludes surplus-only consumers; unmet requests still count.
        ElectricitySnapshot result = new ElectricitySnapshot {
            DemandMw = m_electricityManager.DemandedThisTick.Value * 0.001,
            SurplusDemandMw = m_electricityManager.SurplusDemandedThisTick.Value * 0.001,
            ConsumedMw = m_electricityManager.ConsumedThisTick.Value * 0.001,
            GenerationMw = m_electricityManager.GeneratedThisTick.Value * 0.001,
            GenerationCapacityMw = m_electricityManager.GenerationCapacityThisTick.Value * 0.001,
            MaximumGenerationCapacityMw = m_electricityManager.MaxGenerationCapacity.Value * 0.001
        };

        // One native aggregate scan per capture, no per-transport export.
        foreach (ElectricityManager.ConsumptionPerProto consumption in m_electricityManager.GetConsumptionStatsPerProto())
        {
            Proto proto = consumption.ConsumerProto as Proto;
            string id = proto == null ? consumption.ConsumerProto.ToString() : proto.Id.ToString();
            string name = proto == null ? id : proto.Strings.Name.TranslatedString;
            result.ByType.Add(new ElectricityConsumerSnapshot {
                PrototypeId = id,
                Name = String.IsNullOrWhiteSpace(name) ? id : name,
                DemandMw = consumption.LastTick.Demand.Value * 0.001,
                ConsumedMw = consumption.LastTick.Consumed.Value * 0.001,
                MaximumDemandMw = consumption.LastTick.MaxPossibleConsumption.Value * 0.001,
                Entities = consumption.EntitiesTotal,
                Transport = consumption.ConsumerProto.GetType().Namespace == "Mafi.Core.Factory.Transports"
            });
        }
        result.ByType.Sort(delegate(ElectricityConsumerSnapshot left, ElectricityConsumerSnapshot right) {
            return String.Compare(left.PrototypeId, right.PrototypeId, StringComparison.Ordinal);
        });
        return result;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendElectricity(SnapshotJsonStream json, ElectricitySnapshot electricity)
    {
        if (electricity == null) return;
        json.Name("electricity").BeginObject();
        json.Field("demandMw", electricity.DemandMw);
        json.Field("surplusDemandMw", electricity.SurplusDemandMw);
        json.Field("consumedMw", electricity.ConsumedMw);
        json.Field("generationMw", electricity.GenerationMw);
        json.Field("generationCapacityMw", electricity.GenerationCapacityMw);
        json.Field("maximumGenerationCapacityMw", electricity.MaximumGenerationCapacityMw);
        json.Name("byType").BeginArray();
        foreach (ElectricityConsumerSnapshot consumer in electricity.ByType)
        {
            json.BeginObject();
            json.Field("prototypeId", consumer.PrototypeId);
            json.Field("name", consumer.Name);
            json.Field("demandMw", consumer.DemandMw);
            json.Field("consumedMw", consumer.ConsumedMw);
            json.Field("maximumDemandMw", consumer.MaximumDemandMw);
            json.Field("entities", consumer.Entities);
            json.Field("transport", consumer.Transport);
            json.EndObject();
        }
        json.EndArray();
        json.EndObject();
    }
}
