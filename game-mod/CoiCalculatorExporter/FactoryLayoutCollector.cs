using System;
using System.Collections.Generic;
using System.Globalization;

using Mafi;
using Mafi.Collections.ImmutableCollections;
using Mafi.Core.Buildings.Settlements;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static.Layout;
using Mafi.Core.Vehicles;
using Mafi.Logging;

internal sealed class FactoryLayoutCollector
{
    private readonly IEntitiesManager m_entities;
    private readonly ILogisticsZonesManager m_zones;
    private readonly IGameIdProvider m_identity;
    private Dictionary<ImmutableArray<OccupiedTileRelative>, FactoryFootprint> m_footprints =
        new Dictionary<ImmutableArray<OccupiedTileRelative>, FactoryFootprint>();

    public FactoryLayoutCollector(IEntitiesManager entities, ILogisticsZonesManager zones, IGameIdProvider identity)
    {
        m_entities = entities;
        m_zones = zones;
        m_identity = identity;
    }

    private static IEnumerable<FactoryCell> getCells(ImmutableArray<OccupiedTileRelative> occupied)
    {
        // Installed 0.8.8 IStaticEntity.OccupiedTiles: already rotated, relative to CenterTile.
        foreach (OccupiedTileRelative tile in occupied) yield return new FactoryCell(tile.RelativeX, tile.RelativeY);
    }

    public string CaptureJson()
    {
        List<LayoutEntityBase> buildings = new List<LayoutEntityBase>();
        foreach (IEntity entity in m_entities.Entities)
        {
            LayoutEntityBase building = entity as LayoutEntityBase;
            // Settlement squares bypass LayoutEntity; roads and tracks also use
            // this base class but are not part of the building layer.
            if ((building is LayoutEntity || building is SettlementDecorationModule)
                && !building.IsDestroyed && !building.Prototype.IsPhantom) buildings.Add(building);
        }
        buildings.Sort(delegate(LayoutEntityBase a, LayoutEntityBase b) { return a.Id.Value.CompareTo(b.Id.Value); });
        List<LogisticsZoneFast> zones = new List<LogisticsZoneFast>();
        foreach (LogisticsZoneFast zone in m_zones.PlayerZonesFast)
        {
            if (!zone.IsEmpty && !zone.Zone.IsDefaultZone && !String.IsNullOrWhiteSpace(zone.Zone.CustomName.ValueOrNull)) zones.Add(zone);
        }
        zones.Sort(delegate(LogisticsZoneFast a, LogisticsZoneFast b) { return a.Zone.Id.Value.CompareTo(b.Zone.Id.Value); });
        var currentFootprints = new Dictionary<ImmutableArray<OccupiedTileRelative>, FactoryFootprint>();
        List<FactoryFootprint> shapes = new List<FactoryFootprint>();
        Dictionary<string, int> shapeIds = new Dictionary<string, int>(StringComparer.Ordinal);
        var json = new SnapshotJsonStream(65536);
        json.BeginObject();
        json.Field("schemaVersion", 1);
        json.Field("gameId", m_identity.GameId.ToString(CultureInfo.InvariantCulture));
        json.Field("sessionId", m_identity.SessionId.ToString(CultureInfo.InvariantCulture));
        json.Name("areas").BeginArray();
        foreach (LogisticsZoneFast zone in zones)
        {
            json.BeginObject();
            json.Field("id", zone.Zone.Id.Value);
            json.Name("outline").BeginArray();
            foreach (Vector2i vertex in zone.Zone.Area.Polygon.Vertices)
            {
                json.BeginArray().Value(vertex.X).Value(vertex.Y).EndArray();
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("buildings").BeginArray();
        foreach (LayoutEntityBase building in buildings)
        {
            ImmutableArray<OccupiedTileRelative> occupied = building.OccupiedTiles;
            if (occupied.Length == 0) continue;
            FactoryFootprint footprint;
            if (!currentFootprints.TryGetValue(occupied, out footprint) && !m_footprints.TryGetValue(occupied, out footprint))
                footprint = FactoryFootprint.Compress(getCells(occupied));
            currentFootprints[occupied] = footprint;
            int shapeId;
            if (!shapeIds.TryGetValue(footprint.Key, out shapeId))
            {
                shapeId = shapes.Count;
                shapes.Add(footprint);
                shapeIds.Add(footprint.Key, shapeId);
            }
            json.BeginObject();
            json.Field("id", building.Id.Value);
            json.Field("prototypeId", building.Prototype.Id.ToString());
            json.Field("x", building.CenterTile.X);
            json.Field("y", building.CenterTile.Y);
            json.Field("shape", shapeId);
            json.Field("constructed", building.IsConstructed);
            json.Name("areas").BeginArray();
            foreach (LogisticsZoneFast zone in zones) if (zone.Contains(building)) json.Value(zone.Zone.Id.Value);
            json.EndArray().EndObject();
        }
        json.EndArray();
        json.Name("shapes").BeginArray();
        foreach (FactoryFootprint shape in shapes)
        {
            json.BeginArray();
            foreach (FactoryRect rect in shape.Rects)
            {
                json.BeginArray().Value(rect.MinX).Value(rect.MinY).Value(rect.MaxX).Value(rect.MaxY).EndArray();
            }
            json.EndArray();
        }
        json.EndArray().EndObject();
        // Native immutable arrays compare by backing-array identity. Drop removed entities' geometry.
        m_footprints = currentFootprints;
        return json.GetJson();
    }
}
