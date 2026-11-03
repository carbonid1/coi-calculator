using System.Collections.Generic;

internal static partial class SnapshotJsonWriter
{
    private static void appendFocusStates(SnapshotJsonStream json, List<FocusStateSnapshot> states)
    {
        json.Name("focus").BeginObject();
        for (int i = 0; i < states.Count; i++)
        {
            json.Name(states[i].Key).BeginObject();
            json.Field("targetStep", states[i].TargetStep);
            json.Field("activeStep", states[i].ActiveStep);
            json.EndObject();
        }
        json.EndObject();
    }
}
