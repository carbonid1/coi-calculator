using System.Collections.Generic;

using Mafi;
using Mafi.Core;
using Mafi.Core.Products;
using Mafi.Core.Prototypes;
using Mafi.Core.Trains;
using Mafi.Localization;
using Mafi.Unity;

internal static class TrainNetworkDashboardSnapshotBuilder
{
    private const int WagonKindCount = 7;

    public static List<TrainNetworkDashboardSnapshot> Build(
        TrainNetworksManager trainNetworksManager)
    {
        List<TrainNetworkDashboardSnapshot> snapshots =
            new List<TrainNetworkDashboardSnapshot>();
        foreach (KeyValuePair<TrainNetworkId, TrainNetwork> pair
            in trainNetworksManager.Networks)
        {
            TrainNetworkDashboardSnapshot snapshot = buildNetwork(pair.Value);
            if (snapshot.TotalTrains > 0)
            {
                snapshots.Add(snapshot);
            }
        }

        snapshots.Sort((left, right) => left.NetworkId.CompareTo(right.NetworkId));
        return snapshots;
    }

    private static TrainNetworkDashboardSnapshot buildNetwork(TrainNetwork network)
    {
        int[] totals = new int[WagonKindCount];
        int[] occupied = new int[WagonKindCount];
        IProtoWithIcon[] iconProtos = new IProtoWithIcon[WagonKindCount];
        int totalTrains = 0;
        int occupiedTrains = 0;

        foreach (Train train in network.Trains)
        {
            if (train.IsDestroyed || train.IsDespawning)
            {
                continue;
            }

            bool isOccupied = network.GetTrainState(train)
                != TrainNetwork.NetworkStateForUi.WaitingForJob;
            TrainNetworkDashboardWagonKind kind = classify(train);
            int kindIndex = (int)kind;
            totalTrains++;
            totals[kindIndex]++;
            if (isOccupied)
            {
                occupiedTrains++;
                occupied[kindIndex]++;
            }

            if (iconProtos[kindIndex] == null
                && kind != TrainNetworkDashboardWagonKind.Mixed
                && kind != TrainNetworkDashboardWagonKind.Generic
                && train.CargoWagons.Length > 0)
            {
                iconProtos[kindIndex] = train.CargoWagons[0].Prototype;
            }
        }

        int busyWaitingBays = 0;
        foreach (ITrainStationRoot waitingBay in network.WaitingBays)
        {
            Option<TrainStationGroup> group = waitingBay.Group;
            if (group.HasValue && group.Value.GetTotalServicingTrainsCount() > 0)
            {
                busyWaitingBays++;
            }
        }

        List<TrainNetworkDashboardTypeSnapshot> typeRows =
            new List<TrainNetworkDashboardTypeSnapshot>();
        for (int i = 0; i < WagonKindCount; i++)
        {
            if (totals[i] > 0)
            {
                typeRows.Add(new TrainNetworkDashboardTypeSnapshot(
                    (TrainNetworkDashboardWagonKind)i,
                    occupied[i],
                    totals[i],
                    iconProtos[i]));
            }
        }

        return new TrainNetworkDashboardSnapshot(
            network.Id.Value,
            network.Name,
            network.Color.Primary,
            occupiedTrains,
            totalTrains,
            busyWaitingBays,
            network.WaitingBays.Count,
            typeRows);
    }

    private static TrainNetworkDashboardWagonKind classify(Train train)
    {
        if (train.CargoWagons.Length == 0)
        {
            return TrainNetworkDashboardWagonKind.Generic;
        }

        if (train.GetHasMixedWagonTypes())
        {
            return TrainNetworkDashboardWagonKind.Mixed;
        }

        ProductType productType = train.CargoWagons[0].Prototype.ProductType;
        if (productType.ExactlyMatches(CountableProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Unit;
        }

        if (productType.ExactlyMatches(LooseProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Loose;
        }

        if (productType.ExactlyMatches(FluidProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Fluid;
        }

        if (productType.ExactlyMatches(MoltenProductProto.ProductType))
        {
            return TrainNetworkDashboardWagonKind.Molten;
        }

        if (productType.ExactlyMatches(ProductType.NON_MOLTEN))
        {
            return TrainNetworkDashboardWagonKind.Universal;
        }

        return TrainNetworkDashboardWagonKind.Generic;
    }
}

internal sealed class TrainNetworkDashboardSnapshot
{
    public readonly int NetworkId;
    public readonly LocStrFormatted Name;
    public readonly ColorRgba Color;
    public readonly int OccupiedTrains;
    public readonly int TotalTrains;
    public readonly int BusyWaitingBays;
    public readonly int TotalWaitingBays;
    public readonly List<TrainNetworkDashboardTypeSnapshot> TypeRows;

    public TrainNetworkDashboardSnapshot(
        int networkId,
        LocStrFormatted name,
        ColorRgba color,
        int occupiedTrains,
        int totalTrains,
        int busyWaitingBays,
        int totalWaitingBays,
        List<TrainNetworkDashboardTypeSnapshot> typeRows)
    {
        NetworkId = networkId;
        Name = name;
        Color = color;
        OccupiedTrains = occupiedTrains;
        TotalTrains = totalTrains;
        BusyWaitingBays = busyWaitingBays;
        TotalWaitingBays = totalWaitingBays;
        TypeRows = typeRows;
    }
}

internal sealed class TrainNetworkDashboardTypeSnapshot
{
    public readonly TrainNetworkDashboardWagonKind Kind;
    public readonly int Occupied;
    public readonly int Total;
    public readonly IProtoWithIcon IconProto;

    public TrainNetworkDashboardTypeSnapshot(
        TrainNetworkDashboardWagonKind kind,
        int occupied,
        int total,
        IProtoWithIcon iconProto)
    {
        Kind = kind;
        Occupied = occupied;
        Total = total;
        IconProto = iconProto;
    }
}

internal enum TrainNetworkDashboardWagonKind
{
    Unit = 0,
    Loose = 1,
    Fluid = 2,
    Molten = 3,
    Universal = 4,
    Mixed = 5,
    Generic = 6,
}
