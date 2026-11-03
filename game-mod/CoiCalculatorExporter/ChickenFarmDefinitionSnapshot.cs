using System;

using Mafi.Core.Buildings.Farms;

internal sealed class ChickenFarmDefinitionSnapshot
{
    public int Capacity;
    public int CountStep;
    public double FeedPerChicken;
    public double WaterPerChicken;
    public double EggsPerChicken;
    public double BirthsPer100Chickens;
    public double CarcassPerSlaughteredChicken;
}

internal sealed partial class GameSnapshotCollector
{
    private ChickenFarmDefinitionSnapshot getChickenFarmDefinition()
    {
        foreach (AnimalFarmProto proto in m_protosDb.All<AnimalFarmProto>())
        {
            if (proto.Id.ToString() != SnapshotTracking.ChickenFarmPrototypeId) continue;
            return new ChickenFarmDefinitionSnapshot {
                Capacity = proto.AnimalsCapacity,
                CountStep = Math.Max(1, proto.AnimalsCapacity / AnimalFarm.MAX_SLIDES_STEPS),
                FeedPerChicken = proto.FoodPerAnimalPerMonth.Quantity.Value.ToDouble(),
                WaterPerChicken = proto.WaterPerAnimalPerMonth.Quantity.Value.ToDouble(),
                EggsPerChicken = proto.ProducedPerAnimalPerMonth.HasValue
                    ? proto.ProducedPerAnimalPerMonth.Value.Quantity.Value.ToDouble() : 0,
                BirthsPer100Chickens = proto.AnimalsBornPer100AnimalsPerMonth.ToDouble(),
                CarcassPerSlaughteredChicken = proto.CarcassMultiplier.ToDouble(),
            };
        }
        throw new InvalidOperationException("Chicken farm prototype was not found.");
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendChickenFarmDefinition(SnapshotJsonStream json, ChickenFarmDefinitionSnapshot definition)
    {
        json.Name("chickenFarmDefinition").BeginObject();
        json.Field("capacity", definition.Capacity);
        json.Field("countStep", definition.CountStep);
        // Preserve the game's fixed-point rates without six-decimal rounding.
        json.Field("feedPerChicken", definition.FeedPerChicken);
        json.Field("waterPerChicken", definition.WaterPerChicken);
        json.Field("eggsPerChicken", definition.EggsPerChicken);
        json.Field("birthsPer100Chickens", definition.BirthsPer100Chickens);
        json.Field("carcassPerSlaughteredChicken", definition.CarcassPerSlaughteredChicken);
        json.EndObject();
    }
}
