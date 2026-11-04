using System;
using System.Collections.Generic;
using System.Reflection;
using Mafi;
using Mafi.Core;
using Mafi.Core.Buildings.Storages;
using Mafi.Core.Entities;
using Mafi.Core.Entities.Static;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Factory.WellPumps;
using Mafi.Core.Factory.Zippers;
using Mafi.Core.Factory.Sorters;
using Mafi.Core.Ports;
using Mafi.Core.Ports.Io;
using Mafi.Core.Products;

internal sealed class WaterBufferSnapshot
{
    public int EntityId;
    public string Kind;
    public double Quantity, Capacity;
}
internal sealed class WaterNetworkSnapshot
{
    public readonly List<int> PumpIds = new List<int>();
    public readonly List<int> ActivePumpIds = new List<int>();
    public readonly List<string> AquiferIds = new List<string>();
    public readonly List<WaterBufferSnapshot> Buffers = new List<WaterBufferSnapshot>();
    public bool HasOtherSources;
    public readonly List<int> ConsumerIds = new List<int>();
}

internal sealed partial class GameSnapshotCollector
{
    private sealed class PumpReach
    {
        public MachineInventorySnapshot Pump;
        public HashSet<IoPort> Ports;
    }

    private static bool waterPort(IoPort port, ProductProto water)
    {
        return !port.IsDestroyed && port.ShapePrototype.AllowedProductType.Matches(water.Type);
    }

    private static bool storageIoDisabled(Storage storage)
    {
        return (bool)typeof(Storage).GetProperty("IoDisabled", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic).GetValue(storage, null);
    }

    private static bool waterPassThrough(IEntity entity, ProductProto water)
    {
        if (entity.IsPaused) return false;
        var storage = entity as Storage;
        if (storage != null) return storage.IsConstructed && !storageIoDisabled(storage) && storage.StoredProduct.ValueOrNull == water;
        var stationary = entity as IStaticEntity;
        return stationary != null && stationary.IsConstructed
            && (entity is Transport || entity is Zipper || entity is MiniZipper || entity is Sorter);
    }

    private static bool waterSorterOutput(IoPort port, ProductProto water)
    {
        var sorter = port.OwnerEntity as Sorter;
        if (sorter == null) return true;
        char special = (char)typeof(Sorter).GetField("SPECIAL_PORT_NAME", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        return (port.Name == special) == sorter.FilteredProducts.Contains(water);
    }

    private static HashSet<IoPort> walkWater(IEnumerable<IoPort> start, ProductProto water, bool reverse)
    {
        var visited = new HashSet<IoPort>();
        var queue = new Queue<IoPort>(start);
        while (queue.Count > 0) {
            var port = queue.Dequeue();
            if (!waterPort(port, water) || !visited.Add(port)) continue;
            var owner = port.OwnerEntity;
            bool incoming = port.IsConnectedAsInput;
            bool outgoing = port.IsConnectedAsOutput;
            if ((reverse ? incoming : outgoing) && port.ConnectedPort.HasValue)
                queue.Enqueue(port.ConnectedPort.Value);
            if (!(reverse ? outgoing : incoming) || !waterPassThrough(owner, water) || (reverse && !waterSorterOutput(port, water))) continue;
            foreach (var next in owner.Ports) {
                if (reverse ? next.IsConnectedAsInput : next.IsConnectedAsOutput && waterSorterOutput(next, water)) queue.Enqueue(next);
            }
        }
        return visited;
    }

    private static WaterBufferSnapshot waterBuffer(IEntity entity, ProductProto water)
    {
        var storage = entity as Storage;
        if (storage != null && storage.IsConstructed && !storageIoDisabled(storage) && storage.StoredProduct.ValueOrNull == water)
            return new WaterBufferSnapshot { EntityId = entity.Id.Value, Kind = "tank", Quantity = storage.CurrentQuantity.Value, Capacity = storage.Capacity.Value };
        double quantity = 0;
        var pipe = entity as Transport;
        var zipper = entity as Zipper;
        var junction = entity as MiniZipper;
        var sorter = entity as Sorter;
        if (pipe != null) {
            for (int index = 0; index < pipe.TransportedProducts.Count; index++) {
                var product = pipe.TransportedProducts[index];
                if (product.SlimId.Equals(water.SlimId)) quantity += product.Quantity.Value;
            }
        } else if (zipper != null) {
            var amounts = new Mafi.Collections.Dict<ProductProto, Quantity>();
            var inputs = (MixedPile[])weatherField(typeof(Zipper), "m_inputBuffer").GetValue(zipper);
            foreach (var pile in inputs) pile.AggregateInto(amounts);
            var outputs = (Mafi.Collections.Queueue<ZipBuffProduct>)weatherField(typeof(Zipper), "m_outputBuffer").GetValue(zipper);
            foreach (var item in outputs) item.Pile.AggregateInto(amounts);
            Quantity amount; if (amounts.TryGetValue(water, out amount)) quantity = amount.Value;
        } else if (junction != null) {
            var amounts = new Mafi.Collections.Lyst<ProductQuantity>();
            junction.GetAllBufferedProducts(amounts);
            foreach (var item in amounts) if (item.Product == water) quantity += item.Quantity.Value;
        } else if (sorter != null) {
            var amounts = new Mafi.Collections.Dict<ProductProto, ProductQuantity>();
            sorter.GetQueuedProducts(amounts);
            ProductQuantity amount; if (amounts.TryGetValue(water, out amount)) quantity = amount.Quantity.Value;
        } else return null;
        // Pipes/junctions credit their captured water only; do not invent empty
        // transport capacity from trajectory length or product packing rules.
        return new WaterBufferSnapshot { EntityId = entity.Id.Value, Kind = "pipe", Quantity = quantity, Capacity = quantity };
    }

    private List<WaterNetworkSnapshot> getWaterNetworks(SnapshotEntities entities, ProductionSnapshot production)
    {
        ProductProto water = null;
        foreach (var product in m_protosDb.All<ProductProto>()) if (product.Id.ToString() == "Product_Water") { water = product; break; }
        if (water == null) throw new InvalidOperationException("Water product unavailable");
        var consumers = new HashSet<int>();
        foreach (var area in production.AreaEntities) foreach (var recipe in area.Recipes) if (recipe.Assigned)
            foreach (var input in recipe.Inputs) if (input.ProductId == "Product_Water") consumers.Add(area.EntityId);
        foreach (var farm in production.CropFarmEntities) consumers.Add(farm.EntityId);
        char farmWaterPort = (char)typeof(Farm).GetField("INPUT_WATER_PORT_NAME", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        var pumps = new Dictionary<int, MachineInventorySnapshot>();
        foreach (var machine in production.Machines) if (machine.Aquifer != null) pumps[machine.EntityId] = machine;
        var reaches = new List<PumpReach>();
        foreach (var source in entities.Production) {
            var pump = source.Entity as WellPump;
            MachineInventorySnapshot state;
            if (pump == null || !pump.IsConstructed || !pumps.TryGetValue(pump.Id.Value, out state)) continue;
            var start = new List<IoPort>();
            foreach (var port in ((IEntityWithPorts)pump).Ports) if (port.IsConnectedAsOutput) start.Add(port);
            reaches.Add(new PumpReach { Pump = state, Ports = walkWater(start, water, false) });
        }
        var result = new List<WaterNetworkSnapshot>();
        var assigned = new HashSet<PumpReach>();
        foreach (var first in reaches) {
            if (!assigned.Add(first)) continue;
            var group = new List<PumpReach> { first };
            var ports = new HashSet<IoPort>(first.Ports);
            for (int index = 0; index < group.Count; index++) foreach (var next in reaches) {
                if (assigned.Contains(next) || !ports.Overlaps(next.Ports)) continue;
                assigned.Add(next); group.Add(next); ports.UnionWith(next.Ports);
            }
            var network = new WaterNetworkSnapshot();
            var aquifers = new HashSet<string>();
            foreach (var reach in group) {
                network.PumpIds.Add(reach.Pump.EntityId);
                if (reach.Pump.Running) network.ActivePumpIds.Add(reach.Pump.EntityId);
                aquifers.Add(reach.Pump.Aquifer.Id);
            }
            network.AquiferIds.AddRange(aquifers);
            var consumerPorts = new List<IoPort>();
            var consumerIds = new HashSet<int>();
            foreach (var port in ports) if (port.IsConnectedAsInput && consumers.Contains(port.OwnerEntity.Id.Value)
                && (!(port.OwnerEntity is Farm) || port.Name == farmWaterPort)) {
                consumerPorts.Add(port); consumerIds.Add(port.OwnerEntity.Id.Value);
            }
            network.ConsumerIds.AddRange(consumerIds); network.ConsumerIds.Sort();
            var feeding = walkWater(consumerPorts, water, true);
            var seenBuffers = new HashSet<int>();
            foreach (var port in ports) {
                var owner = port.OwnerEntity;
                if (!feeding.Contains(port) || !seenBuffers.Add(owner.Id.Value)) continue;
                var buffer = waterBuffer(owner, water);
                if (buffer != null && buffer.Capacity > 0) network.Buffers.Add(buffer);
            }
            foreach (var port in feeding) {
                if (!port.IsConnectedAsOutput || waterPassThrough(port.OwnerEntity, water)) continue;
                MachineInventorySnapshot source;
                if (!pumps.TryGetValue(port.OwnerEntity.Id.Value, out source)) network.HasOtherSources = true;
                else if (!aquifers.Contains(source.Aquifer.Id)) {
                    aquifers.Add(source.Aquifer.Id); network.AquiferIds.Add(source.Aquifer.Id);
                }
            }
            network.PumpIds.Sort(); network.ActivePumpIds.Sort(); network.AquiferIds.Sort(StringComparer.Ordinal);
            network.Buffers.Sort(delegate(WaterBufferSnapshot a, WaterBufferSnapshot b) { return a.EntityId.CompareTo(b.EntityId); });
            result.Add(network);
        }
        result.Sort(delegate(WaterNetworkSnapshot a, WaterNetworkSnapshot b) { return a.PumpIds[0].CompareTo(b.PumpIds[0]); });
        return result;
    }
}

internal static partial class SnapshotJsonWriter
{
    private static void appendWaterNetworks(SnapshotJsonStream json, List<WaterNetworkSnapshot> networks)
    {
        json.Name("networks").BeginArray();
        foreach (var network in networks) {
            json.BeginObject();
            json.Name("pumpIds").BeginArray(); foreach (int id in network.PumpIds) json.Value(id); json.EndArray();
            json.Name("activePumpIds").BeginArray(); foreach (int id in network.ActivePumpIds) json.Value(id); json.EndArray();
            json.Name("aquiferIds").BeginArray(); foreach (string id in network.AquiferIds) json.Value(id); json.EndArray();
            json.Field("hasOtherSources", network.HasOtherSources);
            json.Name("consumerIds").BeginArray(); foreach (int id in network.ConsumerIds) json.Value(id); json.EndArray();
            json.Name("buffers").BeginArray();
            foreach (var buffer in network.Buffers) {
                json.BeginObject(); json.Field("entityId", buffer.EntityId); json.Field("kind", buffer.Kind);
                json.Field("quantity", buffer.Quantity); json.Field("capacity", buffer.Capacity); json.EndObject();
            }
            json.EndArray().EndObject();
        }
        json.EndArray();
    }
}
