using System;
using System.Collections.Generic;

using Mafi;
using Mafi.Core;
using Mafi.Localization;
using Mafi.Unity;
using Mafi.Unity.UiToolkit;
using Mafi.Unity.UiToolkit.Component;
using Mafi.Unity.UiToolkit.Library;
using Mafi.Unity.UiToolkit.Themes;

internal sealed class TrainNetworkDashboardNetworkRow : Column
{
    private const string TrainIconPath =
        "Assets/Unity/UserInterface/Toolbar/TrainLines.svg";
    private const string WaitingBayIconPath =
        "Assets/Unity/UserInterface/Trains/TrainDestination.svg";

    private readonly int m_networkId;
    private readonly UiComponent m_colorSwatch;
    private readonly Label m_nameLabel;
    private readonly TrainNetworkDashboardMetricRow m_trainRow;
    private readonly TrainNetworkDashboardMetricRow m_waitingBayRow;
    private readonly List<TrainNetworkDashboardMetricRow> m_typeRows =
        new List<TrainNetworkDashboardMetricRow>();
    private readonly List<TrainNetworkDashboardWagonKind> m_typeKinds =
        new List<TrainNetworkDashboardWagonKind>();

    public TrainNetworkDashboardNetworkRow(TrainNetworkDashboardSnapshot snapshot)
        : base(4.pt())
    {
        m_networkId = snapshot.NetworkId;
        this.AlignItemsStretch()
            .Padding(8.pt())
            .Background(Theme.BackgroundPanelLike)
            .Border(1.pt(), Theme.BorderColor, 2);

        m_colorSwatch = new UiComponent()
            .Width(5.px())
            .Height(24.px())
            .NoShrink();
        m_nameLabel = new Label(snapshot.Name).FontBold().FlexGrow(1);

        Row header = new Row(6.pt());
        header.AlignItemsCenter();
        header.Add(m_colorSwatch);
        header.Add(m_nameLabel);
        Add(header);

        m_trainRow = new TrainNetworkDashboardMetricRow(
            TrainIconPath,
            new LocStrFormatted(Tr.StatsCat__Trains.ToString()),
            true,
            new LocStrFormatted("Occupied / total trains"));
        Add(m_trainRow);

        m_waitingBayRow = new TrainNetworkDashboardMetricRow(
            WaitingBayIconPath,
            new LocStrFormatted(Tr.TrainNetwork_WaitingBays.ToString()),
            true,
            new LocStrFormatted("Busy / total waiting bays"));
        Add(m_waitingBayRow);

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            TrainNetworkDashboardTypeSnapshot typeSnapshot = snapshot.TypeRows[i];
            TrainNetworkDashboardMetricRow typeRow =
                TrainNetworkDashboardMetricRow.ForWagonType(typeSnapshot);
            m_typeKinds.Add(typeSnapshot.Kind);
            m_typeRows.Add(typeRow);
            Add(typeRow);
        }

        Value(snapshot);
    }

    public bool MatchesStructure(TrainNetworkDashboardSnapshot snapshot)
    {
        if (snapshot.NetworkId != m_networkId
            || snapshot.TypeRows.Count != m_typeKinds.Count)
        {
            return false;
        }

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            if (snapshot.TypeRows[i].Kind != m_typeKinds[i])
            {
                return false;
            }
        }

        return true;
    }

    public void Value(TrainNetworkDashboardSnapshot snapshot)
    {
        m_colorSwatch.Background(snapshot.Color);
        m_nameLabel.Value(snapshot.Name);
        m_trainRow.Value(snapshot.OccupiedTrains, snapshot.TotalTrains);
        m_waitingBayRow.Value(snapshot.BusyWaitingBays, snapshot.TotalWaitingBays);

        for (int i = 0; i < snapshot.TypeRows.Count; i++)
        {
            TrainNetworkDashboardTypeSnapshot typeSnapshot = snapshot.TypeRows[i];
            m_typeRows[i].Value(typeSnapshot.Occupied, typeSnapshot.Total);
        }
    }
}

internal sealed class TrainNetworkDashboardMetricRow : Row
{
    private const string MixedIconPath =
        "Assets/Unity/UserInterface/Trains/WagonEmpty.svg";
    private const string GenericTrainIconPath =
        "Assets/Unity/UserInterface/Toolbar/TrainLines.svg";

    private readonly TrainNetworkDashboardOccupancy m_occupancy;

    public TrainNetworkDashboardMetricRow(
        string iconPath,
        LocStrFormatted label,
        bool showLabel,
        LocStrFormatted tooltip)
        : this(new Icon(iconPath), label, showLabel, tooltip)
    {
    }

    private TrainNetworkDashboardMetricRow(
        Icon icon,
        LocStrFormatted label,
        bool showLabel,
        LocStrFormatted tooltip)
        : base(6.pt())
    {
        this.AlignItemsCenter().PaddingLeft(14.pt());
        icon.Width(30.px()).Height(22.px()).NoShrink().NoTint();
        Add(icon);

        if (showLabel)
        {
            Add(new Label(label).FontSize(13).Width(110.px()).NoShrink());
        }
        else
        {
            Add(new UiComponent().Width(110.px()).NoShrink());
        }

        m_occupancy = new TrainNetworkDashboardOccupancy();
        m_occupancy.Tooltip(tooltip);
        Add(m_occupancy);
    }

    public static TrainNetworkDashboardMetricRow ForWagonType(
        TrainNetworkDashboardTypeSnapshot snapshot)
    {
        LocStrFormatted label = labelFor(snapshot.Kind);
        bool showLabel = snapshot.Kind != TrainNetworkDashboardWagonKind.Generic;
        Icon icon;
        if (snapshot.IconProto != null
            && snapshot.Kind != TrainNetworkDashboardWagonKind.Mixed
            && snapshot.Kind != TrainNetworkDashboardWagonKind.Generic)
        {
            icon = new Icon(snapshot.IconProto, true, true);
        }
        else
        {
            string iconPath = snapshot.Kind == TrainNetworkDashboardWagonKind.Mixed
                ? MixedIconPath
                : GenericTrainIconPath;
            icon = new Icon(iconPath);
        }

        return new TrainNetworkDashboardMetricRow(
            icon,
            label,
            showLabel,
            new LocStrFormatted("Occupied / total trains"));
    }

    public void Value(int occupied, int total)
    {
        m_occupancy.Value(occupied, total);
    }

    private static LocStrFormatted labelFor(TrainNetworkDashboardWagonKind kind)
    {
        switch (kind)
        {
            case TrainNetworkDashboardWagonKind.Unit:
                return new LocStrFormatted(Tr.ProductType__Countable.ToString());
            case TrainNetworkDashboardWagonKind.Loose:
                return new LocStrFormatted(Tr.ProductType__Loose.ToString());
            case TrainNetworkDashboardWagonKind.Fluid:
                return new LocStrFormatted(Tr.ProductType__Fluid.ToString());
            case TrainNetworkDashboardWagonKind.Molten:
                return new LocStrFormatted(Tr.ProductType__Molten.ToString());
            case TrainNetworkDashboardWagonKind.Universal:
                return new LocStrFormatted(Tr.ProductType__Universal.ToString());
            case TrainNetworkDashboardWagonKind.Mixed:
                return new LocStrFormatted("Mixed");
            default:
                return new LocStrFormatted("");
        }
    }
}

internal sealed class TrainNetworkDashboardOccupancy : Row
{
    private const int BarWidth = 112;

    private readonly Label m_valueLabel;
    private readonly UiComponent m_occupiedBar;
    private readonly UiComponent m_freeBar;
    private int m_lastOccupied = -1;
    private int m_lastTotal = -1;
    private int m_lastOccupiedWidth = -1;

    public TrainNetworkDashboardOccupancy()
        : base(6.pt())
    {
        this.AlignItemsCenter().NoShrink();
        m_valueLabel = new Label(new LocStrFormatted("0/0"))
            .FontSize(13)
            .TextAlign(TextAlignment.RightMiddle)
            .Width(46.px())
            .NoShrink();
        m_occupiedBar = new UiComponent()
            .Height(7.px())
            .Background(Theme.ImportantColor)
            .NoShrink();
        m_freeBar = new UiComponent()
            .Height(7.px())
            .Background(Theme.BackgroundDark)
            .NoShrink();
        Row bar = new Row(0.pt());
        bar.Width(BarWidth.px())
            .Height(9.px())
            .Border(1.pt(), Theme.BorderColor, 2)
            .NoShrink();
        bar.Add(m_occupiedBar);
        bar.Add(m_freeBar);
        Add(m_valueLabel);
        Add(bar);
        Value(0, 0);
    }

    public void Value(int occupied, int total)
    {
        total = Math.Max(0, total);
        occupied = Math.Max(0, Math.Min(occupied, total));
        if (occupied != m_lastOccupied || total != m_lastTotal)
        {
            m_lastOccupied = occupied;
            m_lastTotal = total;
            m_valueLabel.Value(new LocStrFormatted(occupied + "/" + total));
        }

        int occupiedWidth = total == 0
            ? 0
            : (int)Math.Round((double)occupied * BarWidth / total);
        occupiedWidth = Math.Max(0, Math.Min(BarWidth, occupiedWidth));
        if (occupiedWidth == m_lastOccupiedWidth)
        {
            return;
        }

        m_lastOccupiedWidth = occupiedWidth;
        m_occupiedBar.Width(occupiedWidth.px());
        m_freeBar.Width((BarWidth - occupiedWidth).px());
    }
}
