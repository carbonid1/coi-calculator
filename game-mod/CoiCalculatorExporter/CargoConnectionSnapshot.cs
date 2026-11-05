using System.Collections.Generic;
using Mafi.Core.Buildings.Cargo;
using Mafi.Core.Buildings.Cargo.Modules;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Factory.Sorters;
using Mafi.Core.Factory.Lifts;
using Mafi.Core.Ports;
using Mafi.Core.Products;
using Mafi.Core.Buildings.Storages;

internal sealed class CargoConnectionSnapshot
{
    public ContractProductSnapshot Product;
    public string Direction;
    public double? CapacityPerCycle;
    public string UnmeasuredReason;
    public List<int> StorageEntityIds;
}

internal sealed partial class GameSnapshotCollector
{
    private List<CargoConnectionSnapshot> getCargoConnections(CargoDepot depot)
    {
        var result = new List<CargoConnectionSnapshot>();
        var groups = new Dictionary<string, List<CargoDepotModule>>();
        foreach (var slot in depot.Modules) {
            var module = slot.ValueOrNull;
            if (module == null || module.IsDestroyed || !module.IsConstructed
                || !module.StoredProduct.HasValue) continue;
            string key = module.StoredProduct.Value.Id.ToString() + (module.IsForImport() ? ":import" : ":export");
            List<CargoDepotModule> group;
            if (!groups.TryGetValue(key, out group)) groups.Add(key, group = new List<CargoDepotModule>());
            group.Add(module);
        }
        foreach (var group in groups.Values) {
            ProductProto product = group[0].StoredProduct.Value;
            bool reverse = !group[0].IsForImport();
            string reason;
            double? capacity = measureCargoConnections(group, product, reverse, out reason);
            result.Add(new CargoConnectionSnapshot {
                Product = getProductSnapshot(product), Direction = reverse ? "export" : "import",
                CapacityPerCycle = capacity, UnmeasuredReason = reason,
                StorageEntityIds = collectCargoStorage(group, product, reverse),
            });
        }
        result.Sort(delegate(CargoConnectionSnapshot a, CargoConnectionSnapshot b) {
            return System.String.CompareOrdinal(a.Product.ProductId + a.Direction, b.Product.ProductId + b.Direction);
        });
        return result;
    }

    private static IEnumerable<IEntityWithPorts> cargoNeighbors(IEntityWithPorts owner, ProductProto product, bool reverse)
    {
        foreach (var port in owner.Ports) {
            if (port.IsDestroyed || !port.ShapePrototype.AllowedProductType.Matches(product.Type)
                || !(reverse ? port.IsConnectedAsInput : port.IsConnectedAsOutput) || !port.ConnectedPort.HasValue) continue;
            var sorter = owner as Sorter;
            if (!reverse && sorter != null
                && !CargoConnectionTypes.AllowsSorterOutput(port.Name, sorter.FilteredProducts.Contains(product))) continue;
            var peer = port.ConnectedPort.Value;
            var next = peer.OwnerEntity;
            if (next.IsDestroyed) continue;
            var nextSorter = next as Sorter;
            if (reverse && nextSorter != null
                && !CargoConnectionTypes.AllowsSorterOutput(peer.Name, nextSorter.FilteredProducts.Contains(product))) continue;
            yield return next;
        }
    }

    private static List<int> collectCargoStorage(List<CargoDepotModule> modules, ProductProto product, bool reverse)
    {
        var sources = new HashSet<int>();
        var roots = new List<IEntityWithPorts>();
        foreach (var module in modules) { sources.Add(module.Id.Value); roots.Add(module); }
        return CargoStorageReach.Collect(roots, node => node.Id.Value, delegate(IEntityWithPorts node) {
            var storage = node as Storage;
            if (storage != null) return storage.IsConstructed && storage.StoredProduct.ValueOrNull == product
                ? CargoStorageNodeKind.Storage : CargoStorageNodeKind.Boundary;
            if (sources.Contains(node.Id.Value) || CargoConnectionTypes.IsRouting(node.GetType()))
                return CargoStorageNodeKind.Routing;
            if (node is CargoDepotModule || CargoConnectionTypes.IsEndpoint(node.GetType()))
                return CargoStorageNodeKind.Boundary;
            return CargoStorageNodeKind.Unknown;
        }, node => cargoNeighbors(node, product, reverse));
    }

    private static double? measureCargoConnections(List<CargoDepotModule> modules, ProductProto product, bool reverse,
        out string reason)
    {
        reason = null;
        var capacities = new Dictionary<int, double>();
        var links = new List<KeyValuePair<int, int>>();
        var sources = new HashSet<int>();
        var terminals = new HashSet<int>();
        var queue = new Queue<IEntityWithPorts>();
        int transports = 0;
        foreach (var module in modules) {
            int id = module.Id.Value;
            capacities.Add(id, module.IsPaused ? 0 : CargoConnectionFlow.Unbounded); sources.Add(id); queue.Enqueue(module);
        }
        while (queue.Count > 0) {
            var owner = queue.Dequeue();
            foreach (var next in cargoNeighbors(owner, product, reverse)) {
                int id = next.Id.Value;
                links.Add(new KeyValuePair<int, int>(owner.Id.Value, id));
                // Bound snapshot work and payload cost independently of island/network size.
                if (capacities.Count >= 128 || links.Count >= 512) { reason = "scan-limit"; return null; }
                if (capacities.ContainsKey(id)) continue;
                var transport = next as Transport;
                var lift = next as Lift;
                bool junction = CargoConnectionTypes.IsRouting(next.GetType());
                if (transport != null) {
                    transports++;
                    capacities.Add(id, transport.IsConstructed && !transport.IsPaused
                        ? transport.Prototype.GetMaxThroughputPer60For(product).Value : 0);
                    queue.Enqueue(next);
                } else if (lift != null) {
                    transports++;
                    capacities.Add(id, lift.IsConstructed && !lift.IsPaused
                        ? CargoConnectionTypes.LiftCapacityPerCycle(lift.Prototype.MaxThroughputPerStep) : 0);
                    queue.Enqueue(next);
                } else if (junction) {
                    capacities.Add(id, next.IsPaused ? 0 : CargoConnectionFlow.Unbounded); queue.Enqueue(next);
                } else if (next is CargoDepotModule) {
                    // Another depot may share this network; don't count it as a storage/machine sink.
                    reason = "shared-depot"; return null;
                } else if (CargoConnectionTypes.IsEndpoint(next.GetType())) {
                    capacities.Add(id, CargoConnectionFlow.Unbounded); terminals.Add(id);
                } else {
                    reason = "unsupported-device:" + next.GetType().FullName; return null;
                }
            }
        }
        if (transports == 0) { reason = "no-transport"; return null; } // Direct transfers / trucks are not belt or pipe capacity.
        double capacity = CargoConnectionFlow.Measure(capacities, links, sources, terminals);
        if (capacity >= CargoConnectionFlow.Unbounded) { reason = "direct-connection"; return null; }
        return capacity;
    }
}
