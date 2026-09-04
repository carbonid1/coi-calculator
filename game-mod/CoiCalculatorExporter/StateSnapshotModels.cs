internal sealed class HistoryAverage
{
    public static readonly HistoryAverage Empty = new HistoryAverage(0, 0);

    public readonly double Value;
    public readonly int SampleMonths;

    public HistoryAverage(double value, int sampleMonths)
    {
        Value = value;
        SampleMonths = sampleMonths;
    }
}

internal sealed class EdictState
{
    public int EnabledLevel;
    public int ActiveLevel;
    public string InactiveReason;
}

internal sealed class FuelHistory
{
    public static readonly FuelHistory Empty = new FuelHistory(
        HistoryAverage.Empty,
        HistoryAverage.Empty,
        HistoryAverage.Empty,
        HistoryAverage.Empty,
        HistoryAverage.Empty,
        HistoryAverage.Empty);

    public readonly HistoryAverage Total;
    public readonly HistoryAverage Vehicles;
    public readonly HistoryAverage CargoShips;
    public readonly HistoryAverage BattleShip;
    public readonly HistoryAverage PowerGenerators;
    public readonly HistoryAverage Trains;

    public FuelHistory(
        HistoryAverage total,
        HistoryAverage vehicles,
        HistoryAverage cargoShips,
        HistoryAverage battleShip,
        HistoryAverage powerGenerators,
        HistoryAverage trains)
    {
        Total = total;
        Vehicles = vehicles;
        CargoShips = cargoShips;
        BattleShip = battleShip;
        PowerGenerators = powerGenerators;
        Trains = trains;
    }
}

internal sealed class GenerationHistory
{
    public readonly string PrototypeId;
    public readonly string Name;
    public readonly HistoryAverage Average;

    public GenerationHistory(
        string prototypeId,
        string name,
        HistoryAverage average)
    {
        PrototypeId = prototypeId;
        Name = name;
        Average = average;
    }
}
