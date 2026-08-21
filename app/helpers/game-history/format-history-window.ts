export const formatHistoryWindow = (sampleMonths: number) => {
  const cycleLabel = `${sampleMonths.toLocaleString("en-US")} ${sampleMonths === 1 ? "cycle" : "cycles"}`;
  const years = sampleMonths / 12;
  const yearLabel = years.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return `${cycleLabel} · ${yearLabel} in-game ${years === 1 ? "year" : "years"}`;
};
