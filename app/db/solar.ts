export interface SolarPanelDefinition {
  recipeId: string;
  name: string;
  building: string;
  sunnyOutputKw: number;
  maintenanceIIPerMonth: number;
}

// Captain of Industry v0.8.6 data. Maintenance is recorded here but remains
// part of the observed global demand applied to area-owned depots.
export const solarPanels = {
  standard: {
    recipeId: "solar-panel",
    name: "Solar Panel",
    building: "Solar Panel",
    sunnyOutputKw: 150,
    maintenanceIIPerMonth: 0.2,
  },
  mono: {
    recipeId: "solar-panel-mono",
    name: "Solar Panel (Mono)",
    building: "Solar Panel (Mono)",
    sunnyOutputKw: 200,
    maintenanceIIPerMonth: 0.2,
  },
} as const satisfies Record<string, SolarPanelDefinition>;

export type SolarPanelCounts = Record<keyof typeof solarPanels, number>;
export const solarPanelOrder: ReadonlyArray<keyof SolarPanelCounts> = ["standard", "mono"];

export const emptySolarPanelCounts: SolarPanelCounts = {
  standard: 0,
  mono: 0,
};

export const plannedSolarPanelTargets: Partial<SolarPanelCounts> = {
  // The current save started this plan at 195 panels. Keep the target fixed so
  // newly synced construction reduces the remaining work instead of moving it.
  mono: 245,
};

export interface ResolvedSolarPanelPlan {
  activeCounts: SolarPanelCounts;
  plannedPanels: Partial<Record<keyof SolarPanelCounts, true>>;
}

export const resolveSolarPanelPlan = (
  builtCounts: SolarPanelCounts,
  runningCounts: SolarPanelCounts,
  plannedTargets?: Partial<SolarPanelCounts>,
): ResolvedSolarPanelPlan => {
  const activeCounts = { ...emptySolarPanelCounts };
  const plannedPanels: ResolvedSolarPanelPlan["plannedPanels"] = {};

  for (const panel of solarPanelOrder) {
    const built = Math.max(0, Math.trunc(builtCounts[panel]));
    const running = Math.min(built, Math.max(0, Math.trunc(runningCounts[panel])));
    const plannedTarget = plannedTargets?.[panel];
    const target = plannedTarget == null
      ? null
      : Math.max(0, Math.trunc(plannedTarget));
    const hasPendingPlan = target != null && running < target;

    activeCounts[panel] = hasPendingPlan ? target : running;

    if (hasPendingPlan) plannedPanels[panel] = true;
  }

  return { activeCounts, plannedPanels };
};
