using System;
using Mafi;
using Mafi.Collections;
using Mafi.Core.Entities;
using Mafi.Core.Game;
using Mafi.Core.GameLoop;
using Mafi.Core.Mods;
using Mafi.Core.Prototypes;
using Mafi.Core.Simulation;

public sealed class MineStorageControlMod : IMod, IDisposable
{
    private MineStorageMonitor m_monitor;
    private MineStorageUi m_ui;
    private ISimLoopEvents m_events;
    public string Name { get { return "Mine Storage Control"; } }
    public int Version { get { return 1; } }
    public bool IsUiOnly { get { return false; } }
    public Option<IConfig> ModConfig { get; set; }
    public ModManifest Manifest { get; private set; }
    public ModJsonConfig JsonConfig { get; private set; }

    public MineStorageControlMod(ModManifest manifest)
    {
        Manifest = manifest;
        JsonConfig = new ModJsonConfig(this);
    }

    public void RegisterPrototypes(ProtoRegistrator registrator) { }
    public void RegisterDependencies(DependencyResolverBuilder builder, ProtosDb protos, bool loaded) { }
    public void EarlyInit(DependencyResolver resolver) { }
    public void MigrateJsonConfig(VersionSlim version, Dict<string, object> values) { }

    public void Initialize(DependencyResolver resolver, bool gameWasLoaded)
    {
        m_events = resolver.Resolve<ISimLoopEvents>();
        m_monitor = new MineStorageMonitor(resolver.Resolve<EntitiesManager>(), JsonConfig);
        m_events.UpdateAfterCmdProc.AddNonSaveable(this, update);
        m_events.BeforeSave.AddNonSaveable(this, beforeSave);
        resolver.Resolve<IGameLoopEvents>().RegisterRendererInitState(this, delegate {
            m_ui = new MineStorageUi(m_events, m_monitor);
            try
            {
                m_ui.Initialize(resolver);
            }
            catch (Exception exception)
            {
                // Saved rules keep working without the settings tab.
                Log.Info("Mine Storage Control: settings unavailable: " + exception);
            }
        });
        Log.Info("Mine Storage Control: initialized.");
    }

    private void update() { m_monitor.Update(); }
    private void beforeSave() { m_monitor.Save(); }

    public void Dispose()
    {
        if (m_ui != null) m_ui.Dispose();
        if (m_events != null)
        {
            m_events.UpdateAfterCmdProc.RemoveNonSaveable(this, update);
            m_events.BeforeSave.RemoveNonSaveable(this, beforeSave);
        }
        if (m_monitor != null) m_monitor.Dispose();
    }
}
