using System;
using System.Globalization;

using Mafi;
using Mafi.Core;
using Mafi.Core.Game;
using Mafi.Core.Terrain;
using Mafi.Logging;

// Optional map route: keep terrain sampling out of the calculator snapshot.
internal sealed class IslandMapCollector : IDisposable
{
    private readonly TerrainManager m_terrain;
    private readonly IGameIdProvider m_identity;
    private long m_revision;
    private string m_cachedJson;

    public IslandMapCollector(TerrainManager terrain, IGameIdProvider identity)
    {
        m_terrain = terrain;
        m_identity = identity;
        m_terrain.OceanFlagChanged.AddNonSaveable(this, onOceanChanged);
    }

    private void onOceanChanged(Tile2iAndIndex tile)
    {
        m_revision++;
        m_cachedJson = null;
    }

    public string CaptureJson()
    {
        if (!m_terrain.IsInitialized) return null;
        if (m_cachedJson != null) return m_cachedJson;
        int width = m_terrain.TerrainWidth;
        int height = m_terrain.TerrainHeight;
        int cellSize = Math.Max(8, (Math.Max(width, height) + 255) / 256);
        int columns = (width + cellSize - 1) / cellSize;
        int rows = (height + cellSize - 1) / cellSize;
        var json = new SnapshotJsonStream(16384);
        json.BeginObject();
        json.Field("schemaVersion", 1);
        json.Field("gameId", m_identity.GameId.ToString(CultureInfo.InvariantCulture));
        json.Field("sessionId", m_identity.SessionId.ToString(CultureInfo.InvariantCulture));
        json.Field("revision", m_revision);
        json.Field("width", width);
        json.Field("height", height);
        json.Field("cellSize", cellSize);
        json.Name("landRows").BeginArray();
        for (int row = 0; row < rows; row++)
        {
            int y = Math.Min(height - 1, row * cellSize + cellSize / 2);
            int start = -1;
            json.BeginArray();
            for (int column = 0; column <= columns; column++)
            {
                bool land = column < columns && !m_terrain.IsOcean(new Tile2i(
                    Math.Min(width - 1, column * cellSize + cellSize / 2), y));
                if (land && start < 0) start = column;
                if (!land && start >= 0)
                {
                    json.Value(start).Value(column);
                    start = -1;
                }
            }
            json.EndArray();
        }
        json.EndArray().EndObject();
        m_cachedJson = json.GetJson();
        return m_cachedJson;
    }

    public void Dispose()
    {
        m_terrain.OceanFlagChanged.RemoveNonSaveable(this, onOceanChanged);
    }
}
