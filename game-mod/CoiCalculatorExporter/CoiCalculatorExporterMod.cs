using System;
using System.IO;

using Mafi;
using Mafi.Collections;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Mods;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;

public sealed class CoiCalculatorExporterMod : IMod, IDisposable
{
    private static readonly TimeSpan ExportInterval = TimeSpan.FromSeconds(5);

    private readonly SnapshotFileWriter m_snapshotFileWriter;
    private GameSnapshotCollector m_snapshotCollector;
    private ICalendar m_calendar;
    private ISimLoopEvents m_simLoopEvents;
    private DateTime m_nextExportUtc = DateTime.MinValue;

    public string Name { get { return "CoI Calculator Exporter"; } }
    public int Version { get { return 28; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public CoiCalculatorExporterMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
        m_snapshotFileWriter = new SnapshotFileWriter(
            Path.Combine(manifest.RootDirectoryPath, "coi-calculator-state.json"));
    }

    public void RegisterPrototypes(ProtoRegistrator registrator)
    {
    }

    public void RegisterDependencies(
        DependencyResolverBuilder dependencyResolverBuilder,
        ProtosDb protosDb,
        bool gameWasLoaded)
    {
    }

    public void EarlyInit(DependencyResolver resolver)
    {
    }

    public void Initialize(DependencyResolver resolver, bool gameWasLoaded)
    {
        m_snapshotCollector = GameSnapshotCollector.Create(resolver);
        m_calendar = resolver.Resolve<ICalendar>();
        m_simLoopEvents = resolver.Resolve<ISimLoopEvents>();

        m_snapshotCollector.RefreshHistory();
        m_calendar.NewMonthEnd.AddNonSaveable(this, onNewMonthEnd);
        m_simLoopEvents.Update.AddNonSaveable(this, onSimUpdate);
        m_simLoopEvents.UpdateAfterCmdProc.AddNonSaveable(this, onSimUpdate);

        writeSnapshot();
        Log.Info("CoI Calculator Exporter: game snapshot enabled at "
            + m_snapshotFileWriter.SnapshotPath);
    }

    public void MigrateJsonConfig(VersionSlim savedVersion, Dict<string, object> savedValues)
    {
    }

    public void Dispose()
    {
        if (m_calendar != null)
        {
            try
            {
                m_calendar.NewMonthEnd.RemoveNonSaveable(this, onNewMonthEnd);
            }
            catch
            {
            }

            m_calendar = null;
        }

        if (m_simLoopEvents != null)
        {
            try
            {
                m_simLoopEvents.Update.RemoveNonSaveable(this, onSimUpdate);
                m_simLoopEvents.UpdateAfterCmdProc.RemoveNonSaveable(this, onSimUpdate);
            }
            catch
            {
            }

            m_simLoopEvents = null;
        }

        m_snapshotCollector = null;
        m_snapshotFileWriter.Dispose();
    }

    private void onNewMonthEnd()
    {
        if (m_snapshotCollector != null)
        {
            m_snapshotCollector.RefreshHistory();
        }
    }

    private void onSimUpdate()
    {
        DateTime now = DateTime.UtcNow;
        if (now < m_nextExportUtc)
        {
            return;
        }

        m_nextExportUtc = now.Add(ExportInterval);
        writeSnapshot();
    }

    private void writeSnapshot()
    {
        if (m_snapshotCollector == null)
        {
            return;
        }

        try
        {
            SnapshotDocument snapshot = m_snapshotCollector.Capture();
            m_snapshotFileWriter.Queue(SnapshotJsonWriter.Serialize(snapshot));
        }
        catch (Exception ex)
        {
            Log.Info("CoI Calculator Exporter: unable to write game snapshot: " + ex);
        }
    }
}
