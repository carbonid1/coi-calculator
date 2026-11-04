using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

internal struct FactoryCell
{
    public readonly int X;
    public readonly int Y;
    public FactoryCell(int x, int y) { X = x; Y = y; }
}

internal sealed class FactoryRect
{
    public int MinX;
    public int MinY;
    public int MaxX;
    public int MaxY;
}

internal sealed class FactoryFootprint
{
    public readonly List<FactoryRect> Rects;
    public readonly string Key;

    public FactoryFootprint(List<FactoryRect> rects)
    {
        Rects = rects;
        StringBuilder key = new StringBuilder();
        foreach (FactoryRect rect in rects)
        {
            key.Append(rect.MinX.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(rect.MinY.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(rect.MaxX.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(rect.MaxY.ToString(CultureInfo.InvariantCulture)).Append(';');
        }
        Key = key.ToString();
    }

    // Merge occupied cells exactly, including cut-outs; these are not bounding boxes.
    public static FactoryFootprint Compress(IEnumerable<FactoryCell> cells)
    {
        SortedDictionary<int, SortedSet<int>> rows = new SortedDictionary<int, SortedSet<int>>();
        foreach (FactoryCell cell in cells)
        {
            SortedSet<int> row;
            if (!rows.TryGetValue(cell.Y, out row)) rows.Add(cell.Y, row = new SortedSet<int>());
            row.Add(cell.X);
        }
        List<FactoryRect> result = new List<FactoryRect>();
        Dictionary<string, FactoryRect> active = new Dictionary<string, FactoryRect>();
        foreach (var row in rows)
        {
            List<int> columns = new List<int>(row.Value);
            Dictionary<string, FactoryRect> next = new Dictionary<string, FactoryRect>();
            for (int index = 0; index < columns.Count; index++)
            {
                int start = columns[index];
                int end = start + 1;
                while (index + 1 < columns.Count && columns[index + 1] == end) { index++; end++; }
                string key = start.ToString(CultureInfo.InvariantCulture) + ":" + end.ToString(CultureInfo.InvariantCulture);
                FactoryRect rect;
                if (!active.TryGetValue(key, out rect) || rect.MaxY != row.Key)
                {
                    rect = new FactoryRect { MinX = start, MinY = row.Key, MaxX = end, MaxY = row.Key + 1 };
                    result.Add(rect);
                }
                else rect.MaxY = row.Key + 1;
                next.Add(key, rect);
            }
            active = next;
        }
        return new FactoryFootprint(result);
    }
}
