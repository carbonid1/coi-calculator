using System;
using Mafi;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Buildings.RainwaterHarvesters;

internal sealed class FarmRuntimeSnapshot
{
    public int ScheduleIndex, DaysRemaining;
    public string CropId;
    public bool CropStarted, Irrigating;
    public double SoilWater, WaterCredit, EvaporatedWater, RainPartial;
}

internal sealed partial class GameSnapshotCollector
{
    private static PartialQuantity farmPartial(object target, Type type, string field)
    {
        return (PartialQuantity)weatherField(type, field).GetValue(target);
    }

    private static FarmRuntimeSnapshot getFarmRuntime(Farm farm)
    {
        var crop = farm.CurrentCrop.ValueOrNull;
        var rain = (RainHarvestingHelper)weatherField(typeof(Farm), "m_rainHarvestingHelper").GetValue(farm);
        return new FarmRuntimeSnapshot {
            ScheduleIndex = farm.ActiveScheduleIndex,
            CropId = crop == null ? null : crop.Prototype.Id.ToString(),
            DaysRemaining = crop == null ? 0 : crop.DaysRemaining,
            CropStarted = crop != null && crop.IsStarted,
            Irrigating = farm.IsIrrigating,
            SoilWater = farm.SoilWaterBuffer.Quantity.Value,
            WaterCredit = farmPartial(farm, typeof(Farm), "m_waterToConsume").Value.ToDouble(),
            EvaporatedWater = farmPartial(farm, typeof(Farm), "m_evaporatedWater").Value.ToDouble(),
            RainPartial = farmPartial(rain, typeof(RainHarvestingHelper), "m_waterPartialBuffer").Value.ToDouble(),
        };
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendFarmRuntime(SnapshotJsonStream json, FarmRuntimeSnapshot data)
    {
        json.Name("runtime").BeginObject();
        json.Field("scheduleIndex", data.ScheduleIndex);
        json.Field("cropId", data.CropId);
        json.Field("daysRemaining", data.DaysRemaining);
        json.Field("cropStarted", data.CropStarted);
        json.Field("irrigating", data.Irrigating);
        json.Field("soilWater", data.SoilWater);
        json.Field("waterCredit", data.WaterCredit);
        json.Field("evaporatedWater", data.EvaporatedWater);
        json.Field("rainPartial", data.RainPartial);
        json.EndObject();
    }
}
