using System;
using System.Reflection;
using Mafi;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Lifts;
using Mafi.Core.Factory.Sorters;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Factory.Zippers;
using Mafi.Core.Trains;

internal static class CargoConnectionTypes
{
    private static readonly char SortedOutputPort = (char)typeof(Sorter)
        .GetField("SPECIAL_PORT_NAME", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);

    public static bool IsRouting(Type type)
    {
        return typeof(Transport).IsAssignableFrom(type)
            || typeof(Zipper).IsAssignableFrom(type)
            || typeof(MiniZipper).IsAssignableFrom(type)
            || typeof(Sorter).IsAssignableFrom(type)
            || typeof(Lift).IsAssignableFrom(type);
    }

    public static double LiftCapacityPerCycle(PartialQuantity perStep)
    {
        return perStep.Value.ToDouble() * SimStep.STEPS_PER_SECOND * 60.0;
    }

    public static bool AllowsSorterOutput(char portName, bool productIsFiltered)
    {
        return (portName == SortedOutputPort) == productIsFiltered;
    }

    public static bool IsEndpoint(Type type)
    {
        return typeof(Storage).IsAssignableFrom(type) || typeof(Machine).IsAssignableFrom(type)
            || typeof(ITrainStationModule).IsAssignableFrom(type);
    }
}
