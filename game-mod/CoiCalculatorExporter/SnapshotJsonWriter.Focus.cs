using System.Collections.Generic;
using System.Text;

internal static partial class SnapshotJsonWriter
{
    private static void appendFocusStates(StringBuilder json, List<FocusStateSnapshot> states)
    {
        json.Append("\"focus\":{");
        for (int i = 0; i < states.Count; i++)
        {
            if (i > 0) json.Append(',');
            json.Append('"');
            json.Append(states[i].Key);
            json.Append("\":{");
            appendNumber(json, "targetStep", states[i].TargetStep, true);
            appendNumber(json, "activeStep", states[i].ActiveStep, false);
            json.Append('}');
        }
        json.Append('}');
    }
}
