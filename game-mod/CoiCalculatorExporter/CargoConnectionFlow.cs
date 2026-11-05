using System;
using System.Collections.Generic;

// Node capacities keep a shared belt/pipe from being credited once per module.
internal static class CargoConnectionFlow
{
    public const double Unbounded = 1e12;
    private sealed class Edge
    {
        public int To, Reverse;
        public double Remaining;
    }

    private static void add(List<Edge>[] graph, int from, int to, double capacity)
    {
        var forward = new Edge { To = to, Reverse = graph[to].Count, Remaining = capacity };
        var reverse = new Edge { To = from, Reverse = graph[from].Count, Remaining = 0 };
        graph[from].Add(forward);
        graph[to].Add(reverse);
    }

    public static double Measure(Dictionary<int, double> capacities,
        List<KeyValuePair<int, int>> links, HashSet<int> sources, HashSet<int> terminals)
    {
        var ids = new Dictionary<int, int>();
        foreach (int id in capacities.Keys) ids.Add(id, ids.Count * 2);
        int source = ids.Count * 2, sink = source + 1;
        var graph = new List<Edge>[sink + 1];
        for (int i = 0; i < graph.Length; i++) graph[i] = new List<Edge>();
        foreach (var node in capacities) add(graph, ids[node.Key], ids[node.Key] + 1, node.Value);
        foreach (var link in links) add(graph, ids[link.Key] + 1, ids[link.Value], Unbounded);
        foreach (int id in sources) add(graph, source, ids[id], Unbounded);
        foreach (int id in terminals) add(graph, ids[id] + 1, sink, Unbounded);
        double total = 0;
        while (true) {
            var parent = new int[graph.Length];
            var edgeIndex = new int[graph.Length];
            for (int i = 0; i < parent.Length; i++) parent[i] = -1;
            parent[source] = source;
            var queue = new Queue<int>();
            queue.Enqueue(source);
            while (queue.Count > 0 && parent[sink] < 0) {
                int from = queue.Dequeue();
                for (int index = 0; index < graph[from].Count; index++) {
                    var edge = graph[from][index];
                    if (edge.Remaining <= 0.000001 || parent[edge.To] >= 0) continue;
                    parent[edge.To] = from; edgeIndex[edge.To] = index; queue.Enqueue(edge.To);
                }
            }
            if (parent[sink] < 0) return total;
            double amount = Unbounded;
            for (int at = sink; at != source; at = parent[at])
                amount = Math.Min(amount, graph[parent[at]][edgeIndex[at]].Remaining);
            for (int at = sink; at != source; at = parent[at]) {
                var edge = graph[parent[at]][edgeIndex[at]];
                edge.Remaining -= amount;
                graph[at][edge.Reverse].Remaining += amount;
            }
            total += amount;
        }
    }
}
