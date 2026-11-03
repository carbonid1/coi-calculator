using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Core.Buildings.Cargo.Modules;
using Mafi.Core.Buildings.Offices;
using Mafi.Core.Buildings.Settlements;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Buildings.VehicleDepots;
using Mafi.Core.Entities;
using Mafi.Core.Factory.Datacenters;
using Mafi.Core.Prototypes;
using Mafi.Core.Trains;

internal sealed class BuildingDefinitionSnapshot
{
    public string Id;
    public string Name;
    public int Workers;
    public int ElectricityKw;
    public double ComputingTflops;
    public double UnityPerCycle;
}

internal sealed partial class GameSnapshotCollector
{
    private List<BuildingDefinitionSnapshot> m_buildingDefinitions;

    private List<BuildingDefinitionSnapshot> getBuildingDefinitions()
    {
        if (m_buildingDefinitions != null) return m_buildingDefinitions;
        List<BuildingDefinitionSnapshot> definitions = new List<BuildingDefinitionSnapshot>();
        ProtosDb protos = m_protosDb;
        foreach (Proto proto in protos.All<Proto>())
        {
            EntityProto entity = proto as EntityProto;
            ServerRackProto rack = proto as ServerRackProto;
            if (proto.IsPhantom || (entity == null && rack == null)) continue;
            IProtoWithComputingConsumption computing = proto as IProtoWithComputingConsumption;
            IProtoWithUnityConsumption unity = proto as IProtoWithUnityConsumption;
            OfficeBuildingProto office = proto as OfficeBuildingProto;
            SettlementIspModuleProto internet = proto as SettlementIspModuleProto;
            VehicleDepotBaseProto depot = proto as VehicleDepotBaseProto;
            definitions.Add(new BuildingDefinitionSnapshot {
                Id = proto.Id.ToString(),
                Name = getProtoName(proto),
                Workers = entity == null ? 0 : entity.Costs.Workers,
                ElectricityKw = getElectricityKw(proto),
                ComputingTflops = computing != null ? computing.ComputingConsumed.Value
                    : internet != null ? internet.GetComputingRequired(100, Percent.Hundred).ToDouble()
                    : depot != null ? depot.ConsumedComputingPerTick.Value
                    : office == null ? 0 : office.GetComputingPerLevel(1).Value,
                UnityPerCycle = unity == null ? 0 : unity.UnityMonthlyCost.Value.ToDouble(),
            });
        }
        definitions.Sort(delegate(BuildingDefinitionSnapshot left, BuildingDefinitionSnapshot right) {
            return String.CompareOrdinal(left.Id, right.Id);
        });
        m_buildingDefinitions = definitions;
        return definitions;
    }

    // These prototypes expose their requirements without the shared power interface.
    private static int getElectricityKw(Proto proto)
    {
        IProtoWithPowerConsumption power = proto as IProtoWithPowerConsumption;
        if (power != null) return power.ElectricityConsumed.Value;
        ServerRackProto rack = proto as ServerRackProto;
        if (rack != null) return rack.ConsumedPowerPerTick.Value;
        TrainStationBaseProto station = proto as TrainStationBaseProto;
        if (station != null) return station.PowerConsumption.Value;
        HospitalProto hospital = proto as HospitalProto;
        if (hospital != null) return hospital.PowerRequired.Value;
        StorageProto storage = proto as StorageProto;
        if (storage != null) return storage.PowerConsumedForProductsExchange.Value;
        CargoDepotModuleProto cargo = proto as CargoDepotModuleProto;
        if (cargo != null) return cargo.ConsumedPowerForCranePerTick.Value;
        VehicleDepotBaseProto depot = proto as VehicleDepotBaseProto;
        if (depot != null) return depot.ConsumedPowerPerTick.Value;
        SettlementModuleProto settlement = proto as SettlementModuleProto;
        if (settlement != null) return settlement.ElectricityConsumed.Value;
        SettlementIspModuleProto internet = proto as SettlementIspModuleProto;
        return internet == null ? 0 : internet.ElectricityConsumed.Value;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendBuildingDefinitions(SnapshotJsonStream json, List<BuildingDefinitionSnapshot> definitions)
    {
        json.Name("buildingDefinitions").BeginArray();
        for (int index = 0; index < definitions.Count; index++)
        {
            BuildingDefinitionSnapshot definition = definitions[index];
            json.BeginObject();
            json.Field("id", definition.Id);
            json.Field("name", definition.Name);
            json.Field("workers", definition.Workers);
            json.Field("electricityKw", definition.ElectricityKw);
            appendDecimal(json, "computingTflops", definition.ComputingTflops);
            appendDecimal(json, "unityPerCycle", definition.UnityPerCycle);
            json.EndObject();
        }
        json.EndArray();
    }
}
