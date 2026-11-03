using System;
using System.Collections.Generic;
using System.Reflection;

using Mafi;
using Mafi.Collections;
using Mafi.Collections.ImmutableCollections;
using Mafi.Core;
using Mafi.Core.Environment;
using Mafi.Core.Game;
using Mafi.Core.Simulation;

internal sealed class WeatherPeriodSnapshot
{
    public int Days;
    public double SunIntensityPercent;
    public double RainIntensityPercent;
}

internal sealed class WeatherConfigSnapshot
{
    public string Seed;
    public string Difficulty;
    public int Year;
    public int Month;
    public int Day;
    public bool HasOverride;
    public double CurrentRainIntensityPercent;
    public double CurrentSunIntensityPercent;
    public readonly List<WeatherPeriodSnapshot> Periods = new List<WeatherPeriodSnapshot>();
}

internal sealed partial class GameSnapshotCollector
{
    // Verified in installed 0.8.8 WeatherManager.onNewDay. These are calendar
    // boundaries, not inferred climate coefficients.
    private const int WEATHER_PERIOD_DAYS = 15;
    private const int WEATHER_HORIZON_YEARS = 100;
    private WeatherManager m_weatherManager;
    private ICalendar m_calendar;
    private RandomSeedConfig m_seedConfig;
    private GameDifficultyConfig m_difficultyConfig;
    private string m_weatherCacheKey;
    private List<ImmutableArray<WeatherProto>> m_weatherYears;

    private void initializeWeather(DependencyResolver resolver)
    {
        m_weatherManager = resolver.Resolve<WeatherManager>();
        m_calendar = resolver.Resolve<ICalendar>();
        m_seedConfig = resolver.Resolve<RandomSeedConfig>();
        m_difficultyConfig = resolver.Resolve<GameDifficultyConfig>();
    }

    private static FieldInfo weatherField(Type type, string name)
    {
        FieldInfo field = type.GetField(name, BindingFlags.Instance | BindingFlags.NonPublic);
        if (field == null) throw new NotSupportedException("Weather field unavailable: " + name);
        return field;
    }

    private WeatherConfigSnapshot getWeatherSnapshot()
    {
        var date = m_calendar.CurrentDate;
        var type = typeof(WeatherManager);
        var provider = (IWeatherProvider)weatherField(type, "m_weatherProvider").GetValue(m_weatherManager);
        // The manager already generated this year and next year. Read those
        // immutable schedules; never request another year from the live provider.
        var current = (ImmutableArray<WeatherProto>)weatherField(type, "m_thisYearWeather").GetValue(m_weatherManager);
        var next = (ImmutableArray<WeatherProto>)weatherField(type, "m_nextYearWeather").GetValue(m_weatherManager);
        if (provider.GetType().FullName != "Mafi.Base.Prototypes.Weather.DefaultWeatherProvider")
            throw new NotSupportedException("Unsupported weather provider: " + provider.GetType().FullName);
        FieldInfo randomField = weatherField(provider.GetType(), "m_random");
        IRandom liveRandom = (IRandom)randomField.GetValue(provider);
        string randomState = Convert.ToBase64String(liveRandom.GetState());
        string key = date.Year.ToString() + ":" + randomState;
        if (m_weatherCacheKey != key)
        {
            // Installed GetWeatherForYear only reads the climate table/protos and
            // mutates m_random and m_tempGenResult. Give both their own storage.
            var clone = (IWeatherProvider)typeof(object).GetMethod("MemberwiseClone",
                BindingFlags.Instance | BindingFlags.NonPublic).Invoke(provider, null);
            randomField.SetValue(clone, liveRandom.Clone());
            weatherField(provider.GetType(), "m_tempGenResult").SetValue(clone, new Lyst<WeatherProto>());
            var years = new List<ImmutableArray<WeatherProto>> { current, next };
            for (int offset = 2; offset <= WEATHER_HORIZON_YEARS; offset++)
                years.Add(clone.GetWeatherForYear(date.Year + offset, years[offset - 1].Last));
            if (randomState != Convert.ToBase64String(liveRandom.GetState()))
                throw new InvalidOperationException("Forecast changed the live weather random state");
            m_weatherYears = years;
            m_weatherCacheKey = key;
        }

        var snapshot = new WeatherConfigSnapshot {
            Seed = m_seedConfig.MasterRandomSeed,
            Difficulty = m_difficultyConfig.WeatherDifficulty.ToString(),
            Year = date.Year, Month = date.Month, Day = date.Day,
            HasOverride = m_weatherManager.HasWeatherOverride,
            CurrentRainIntensityPercent = m_weatherManager.RainIntensity.ToDouble() * 100,
            CurrentSunIntensityPercent = m_weatherManager.SimSunIntensity.ToDouble() * 100,
        };
        int daysPerMonth = Duration.OneMonth.Days.IntegerPart;
        int dayOfYear = (date.Month - 1) * daysPerMonth + date.Day - 1;
        int remaining = WEATHER_HORIZON_YEARS * 12 * daysPerMonth;
        int startPeriod = dayOfYear / WEATHER_PERIOD_DAYS;
        int firstDays = WEATHER_PERIOD_DAYS - dayOfYear % WEATHER_PERIOD_DAYS;
        for (int year = 0; year < m_weatherYears.Count && remaining > 0; year++)
        {
            var schedule = m_weatherYears[year];
            for (int period = year == 0 ? startPeriod : 0; period < schedule.Length && remaining > 0; period++)
            {
                int days = Math.Min(remaining, snapshot.Periods.Count == 0 ? firstDays : WEATHER_PERIOD_DAYS);
                WeatherProto weather = schedule[period];
                snapshot.Periods.Add(new WeatherPeriodSnapshot { Days = days,
                    SunIntensityPercent = weather.SunIntensity.ToDouble() * 100,
                    RainIntensityPercent = weather.RainIntensity.ToDouble() * 100 });
                remaining -= days;
            }
        }
        if (remaining != 0) throw new InvalidOperationException("Incomplete weather forecast");
        return snapshot;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendWeatherConfig(SnapshotJsonStream json, WeatherConfigSnapshot weather)
    {
        json.Name("weather").BeginObject();
        json.Field("gameSeed", weather.Seed);
        json.Field("difficulty", weather.Difficulty);
        json.Name("startDate").BeginObject();
        json.Field("year", weather.Year); json.Field("month", weather.Month); json.Field("day", weather.Day);
        json.EndObject();
        json.Field("hasOverride", weather.HasOverride);
        json.Field("currentRainIntensityPercent", weather.CurrentRainIntensityPercent);
        json.Field("currentSunIntensityPercent", weather.CurrentSunIntensityPercent);
        json.Name("periods").BeginArray();
        foreach (var period in weather.Periods)
        {
            json.BeginObject();
            json.Field("days", period.Days);
            json.Field("sunIntensityPercent", period.SunIntensityPercent);
            json.Field("rainIntensityPercent", period.RainIntensityPercent);
            json.EndObject();
        }
        json.EndArray().EndObject();
    }
}
