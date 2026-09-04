internal sealed class TrackedReserveDefinition
{
    public readonly string Key;
    public readonly string ProductId;

    public TrackedReserveDefinition(string key, string productId)
    {
        Key = key;
        ProductId = productId;
    }
}

internal sealed class TrackedResearchDefinition
{
    public readonly string Key;
    public readonly string PrototypeId;

    public TrackedResearchDefinition(string key, string prototypeId)
    {
        Key = key;
        PrototypeId = prototypeId;
    }
}

internal sealed class TrackedEdictDefinition
{
    public readonly string Key;
    public readonly string[] TierPrototypeIds;

    public TrackedEdictDefinition(string key, params string[] tierPrototypeIds)
    {
        Key = key;
        TierPrototypeIds = tierPrototypeIds;
    }
}

internal sealed class TrackedEdictTier
{
    public readonly int EdictIndex;
    public readonly int Level;

    public TrackedEdictTier(int edictIndex, int level)
    {
        EdictIndex = edictIndex;
        Level = level;
    }
}
