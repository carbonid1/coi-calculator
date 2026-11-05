using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Mafi;
using Mafi.Core.Factory.Sorters;
using Mafi.Core.Factory.Lifts;
using Mafi.Core.Trains;

internal static class CargoConnectionsSmoke
{
    private static void check(string name, double expected, Dictionary<int, double> nodes,
        List<KeyValuePair<int, int>> links, HashSet<int> sources, HashSet<int> sinks)
    {
        double actual = CargoConnectionFlow.Measure(nodes, links, sources, sinks);
        if (Math.Abs(actual - expected) > 0.000001)
            throw new Exception(name + ": expected " + expected + ", got " + actual);
    }

    private static void harborFeedReplay()
    {
        if (!CargoConnectionTypes.IsRouting(typeof(Lift)))
            throw new Exception("Live Dirt trace: conveyor lifts must be traversed, not reported as unsupported endpoints.");
        char sortedPort = (char)typeof(Sorter).GetField("SPECIAL_PORT_NAME",
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        char otherPort = sortedPort == 'A' ? 'B' : 'A';
        if (!CargoConnectionTypes.AllowsSorterOutput(sortedPort, true)
            || CargoConnectionTypes.AllowsSorterOutput(otherPort, true)
            || CargoConnectionTypes.AllowsSorterOutput(sortedPort, false)
            || !CargoConnectionTypes.AllowsSorterOutput(otherPort, false))
            throw new Exception("Sorter traversal must follow the selected product's real output.");
        if (CargoConnectionTypes.IsEndpoint(typeof(Sorter)) || CargoConnectionTypes.IsEndpoint(typeof(object)))
            throw new Exception("Routers and unknown devices cannot become fictitious storage endpoints.");
        if (!CargoConnectionTypes.IsEndpoint(typeof(ITrainStationModule)))
            throw new Exception("The shared Dirt conveyor must reach its train-station buffer endpoint.");
        // Live harbor trace: module branches pass conveyor lifts before
        // reaching one shared 450/month Dirt belt and its storage buffer.
        var nodes = new Dictionary<int, double> {
            { 1, CargoConnectionFlow.Unbounded }, { 2, CargoConnectionFlow.Unbounded },
            { 3, CargoConnectionFlow.Unbounded }, { 10, 450 }, { 11, 450 },
            { 20, CargoConnectionFlow.Unbounded }, { 21, CargoConnectionFlow.Unbounded },
            { 30, 450 }, { 40, CargoConnectionFlow.Unbounded },
        };
        var links = new List<KeyValuePair<int, int>> {
            new KeyValuePair<int, int>(1, 10), new KeyValuePair<int, int>(2, 10),
            new KeyValuePair<int, int>(3, 11), new KeyValuePair<int, int>(10, 20),
            new KeyValuePair<int, int>(11, 21),
        };
        var sinks = new HashSet<int>();
        if (CargoConnectionTypes.IsRouting(typeof(Lift))) {
            links.Add(new KeyValuePair<int, int>(20, 30));
            links.Add(new KeyValuePair<int, int>(21, 30));
            links.Add(new KeyValuePair<int, int>(30, 40));
            sinks.Add(40);
        } else {
            sinks.Add(20); sinks.Add(21);
        }
        check("shared Dirt feed through lifts", 450, nodes, links, new HashSet<int> { 1, 2, 3 }, sinks);
        nodes[30] = 900;
        check("upgraded shared Dirt feed through lifts", 900, nodes, links, new HashSet<int> { 1, 2, 3 }, sinks);
        nodes[20] = CargoConnectionTypes.LiftCapacityPerCycle(PartialQuantity.FromFraction(1, 4));
        check("a slow lift limits its branches", 600, nodes, links, new HashSet<int> { 1, 2, 3 }, sinks);
        nodes[20] = 0;
        check("paused lift blocks only its branches", 450, nodes, links, new HashSet<int> { 1, 2, 3 }, sinks);
    }

    private static void sulfurStorageBankReplay()
    {
        // Depot -> belt -> almost empty first silo -> 35 more silos -> train.
        // The train is a boundary; unrelated island storage is not local stock.
        var links = new Dictionary<int, int[]> { { 1, new[] { 2 } }, { 2, new[] { 100 } } };
        for (int id = 100; id < 135; id++) links.Add(id, new[] { id + 1 });
        links.Add(135, new[] { 100, 200 }); // A loop must not count stock twice.
        links.Add(200, new[] { 999 });
        Func<int, CargoStorageNodeKind> kind = delegate(int id) {
            return id >= 100 && id <= 135 || id == 999 ? CargoStorageNodeKind.Storage
                : id == 200 ? CargoStorageNodeKind.Boundary : CargoStorageNodeKind.Routing;
        };
        Func<int, IEnumerable<int>> neighbors = delegate(int id) {
            int[] next; return links.TryGetValue(id, out next) ? next : new int[0];
        };
        var stock = CargoStorageReach.Collect(new[] { 1, 2 }, id => id, kind, neighbors);
        if (stock == null || stock.Count != 36 || stock[0] != 100 || stock[35] != 135)
            throw new Exception("Sulfur stock must include the entire 36-silo bank, once, without crossing the train.");
        links[135] = new[] { 300 };
        var incomplete = CargoStorageReach.Collect(new[] { 1 }, id => id,
            id => id == 300 ? CargoStorageNodeKind.Unknown : kind(id), neighbors);
        if (incomplete != null) throw new Exception("Unknown devices cannot produce a complete stock total.");
        links[135] = new[] { 136 };
        for (int id = 136; id < 700; id++) links[id] = new[] { id + 1 };
        if (CargoStorageReach.Collect(new[] { 1 }, id => id, id => CargoStorageNodeKind.Routing, neighbors) != null)
            throw new Exception("Oversized storage networks must stop within the scan budget.");
    }

    public static void Main(string[] args)
    {
        AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs request) {
            string file = Path.Combine(args[0], new AssemblyName(request.Name).Name + ".dll");
            return File.Exists(file) ? Assembly.LoadFrom(file) : null;
        };
        harborFeedReplay();
        sulfurStorageBankReplay();
        var nodes = new Dictionary<int, double>();
        var links = new List<KeyValuePair<int, int>>();
        var sources = new HashSet<int>();
        var sinks = new HashSet<int> { 100 };
        nodes.Add(100, CargoConnectionFlow.Unbounded);
        nodes.Add(50, 900);
        links.Add(new KeyValuePair<int, int>(50, 100));
        // Five depot modules feed five pipe branches, merging into one Pipe IV.
        for (int i = 0; i < 5; i++) {
            sources.Add(i); nodes.Add(i, CargoConnectionFlow.Unbounded); nodes.Add(10 + i, 900);
            links.Add(new KeyValuePair<int, int>(i, 10 + i));
            links.Add(new KeyValuePair<int, int>(10 + i, 50));
        }
        check("shared pipe is counted once", 900, nodes, links, sources, sinks);
        nodes[50] = 450;
        check("lower tier trunk constrains all branches", 450, nodes, links, sources, sinks);
        nodes.Add(60, 900);
        links.Add(new KeyValuePair<int, int>(10, 60)); links.Add(new KeyValuePair<int, int>(60, 100));
        check("parallel independent lines add capacity", 1350, nodes, links, sources, sinks);
        links.Add(new KeyValuePair<int, int>(50, 10));
        check("loops cannot multiply line capacity", 1350, nodes, links, sources, sinks);
        nodes[50] = 0;
        check("paused trunk leaves the independent line", 900, nodes, links, sources, sinks);
        sinks.Clear();
        check("unconnected outlets cannot deliver", 0, nodes, links, sources, sinks);
        Console.WriteLine("Cargo connections smoke: live lift trace, slow lifts, sorter routing, shared feeds, upgrades, parallel lines, loops and pauses passed.");
    }
}
