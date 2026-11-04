using System;
using System.Collections.Generic;

internal static class BridgeGeometrySmoke
{
    private static string key(int x, int y) { return x + ":" + y; }

    public static void Main()
    {
        if (FactoryFootprint.Compress(new FactoryCell[0]).Rects.Count != 0) throw new Exception("Empty footprint was not preserved.");
        for (int pattern = 0; pattern < 16; pattern++)
        for (int transform = 0; transform < 8; transform++)
        {
            List<FactoryCell> cells = new List<FactoryCell>();
            HashSet<string> expected = new HashSet<string>();
            for (int y = -4; y < 4; y++)
            for (int x = -6; x < 6; x++)
            {
                bool include = pattern % 4 == 0 || (pattern % 4 == 1 ? x < 0 || y < -1
                    : pattern % 4 == 2 ? (x + y) % 2 == 0 : !(x > -3 && x < 3 && y > -2 && y < 2));
                if (!include) continue;
                int tx = transform >= 4 ? -x : x;
                int ty = y;
                for (int rotation = 0; rotation < transform % 4; rotation++) { int oldX = tx; tx = -ty; ty = oldX; }
                tx += (pattern - 8) * 11;
                ty += (pattern % 7 - 3) * 13;
                cells.Add(new FactoryCell(tx, ty));
                expected.Add(key(tx, ty));
            }
            if (cells.Count > 0) cells.Add(cells[0]);
            FactoryFootprint footprint = FactoryFootprint.Compress(cells);
            HashSet<string> actual = new HashSet<string>();
            foreach (FactoryRect rect in footprint.Rects)
            for (int y = rect.MinY; y < rect.MaxY; y++)
            for (int x = rect.MinX; x < rect.MaxX; x++)
                if (!actual.Add(key(x, y))) throw new Exception("Footprint rectangles overlap.");
            if (!actual.SetEquals(expected)) throw new Exception("Footprint compression lost cells or filled a cut-out.");
            cells.Reverse();
            if (FactoryFootprint.Compress(cells).Key != footprint.Key) throw new Exception("Footprint ordering is unstable.");
        }
        Console.WriteLine("Bridge geometry smoke: 128 rotated/reflected footprint replays and empty geometry passed.");
    }
}
