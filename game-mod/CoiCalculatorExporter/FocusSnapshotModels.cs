internal sealed class FocusStateSnapshot
{
    public readonly string Key;
    public readonly int TargetStep;
    public readonly int ActiveStep;

    public FocusStateSnapshot(string key, int targetStep, int activeStep)
    {
        Key = key;
        TargetStep = targetStep;
        ActiveStep = activeStep;
    }
}
