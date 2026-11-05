using System;
using System.Collections.Generic;

internal enum CargoStorageNodeKind { Routing, Storage, Boundary, Unknown }

internal static class CargoStorageReach
{
    // Inventory has its own budget: line capacity stops at the first buffer,
    // whereas stock may span many directly connected storage buildings.
    public static List<int> Collect<T>(IEnumerable<T> roots, Func<T, int> idOf,
        Func<T, CargoStorageNodeKind> kindOf, Func<T, IEnumerable<T>> neighbors)
    {
        var visited = new HashSet<int>();
        var result = new List<int>();
        var queue = new Queue<T>(roots);
        int edges = 0;
        while (queue.Count > 0) {
            T node = queue.Dequeue();
            int id = idOf(node);
            if (!visited.Add(id)) continue;
            if (visited.Count > 512) return null;
            CargoStorageNodeKind kind = kindOf(node);
            if (kind == CargoStorageNodeKind.Unknown) return null;
            if (kind == CargoStorageNodeKind.Boundary) continue;
            if (kind == CargoStorageNodeKind.Storage) {
                result.Add(id);
                if (result.Count > 128) return null;
            }
            foreach (T next in neighbors(node)) {
                if (++edges > 2048) return null;
                queue.Enqueue(next);
            }
        }
        result.Sort();
        return result;
    }
}
