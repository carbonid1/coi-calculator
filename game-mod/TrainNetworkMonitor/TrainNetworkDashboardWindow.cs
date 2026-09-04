using System.Collections.Generic;

using Mafi;
using Mafi.Core.Trains;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;

internal sealed class TrainNetworkDashboardWindow : Window
{
    private readonly TrainNetworksManager m_trainNetworksManager;
    private readonly Column m_networksColumn;
    private readonly List<TrainNetworkDashboardNetworkRow> m_networkRows =
        new List<TrainNetworkDashboardNetworkRow>();

    public TrainNetworkDashboardWindow(TrainNetworksManager trainNetworksManager)
        : base(new LocStrFormatted("Train Network Monitor"), false)
    {
        m_trainNetworksManager = trainNetworksManager;
        WindowWidth(620.px());
        WindowMaxHeight(Percent.FromPercentVal(85));
        MakeMovableAndEnablePositionSaving();
        EnablePinning();

        m_networksColumn = new Column(6.pt());
        m_networksColumn.AlignItemsStretch().Padding(6.pt());
        ScrollColumn scroll = new ScrollColumn();
        scroll.Add(m_networksColumn);
        scroll.AlignItemsStretch().FlexGrow(1);
        AddBodySingle(scroll);
    }

    public void Refresh()
    {
        List<TrainNetworkDashboardSnapshot> snapshots =
            TrainNetworkDashboardSnapshotBuilder.Build(m_trainNetworksManager);

        if (!hasSameStructure(snapshots))
        {
            rebuild(snapshots);
        }

        for (int i = 0; i < snapshots.Count; i++)
        {
            m_networkRows[i].Value(snapshots[i]);
        }
    }

    private bool hasSameStructure(List<TrainNetworkDashboardSnapshot> snapshots)
    {
        if (snapshots.Count != m_networkRows.Count)
        {
            return false;
        }

        for (int i = 0; i < snapshots.Count; i++)
        {
            if (!m_networkRows[i].MatchesStructure(snapshots[i]))
            {
                return false;
            }
        }

        return true;
    }

    private void rebuild(List<TrainNetworkDashboardSnapshot> snapshots)
    {
        m_networksColumn.Clear();
        m_networkRows.Clear();
        for (int i = 0; i < snapshots.Count; i++)
        {
            TrainNetworkDashboardNetworkRow row =
                new TrainNetworkDashboardNetworkRow(snapshots[i]);
            m_networkRows.Add(row);
            m_networksColumn.Add(row);
        }
    }
}
