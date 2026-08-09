export interface SolarPanelDefinition {
  recipeId: string;
  name: string;
  building: string;
  installedCount: number;
  sunnyOutputKw: number;
  maintenanceIIPerMonth: number;
}

// Captain of Industry v0.8.6 data. Maintenance is recorded here but remains
// part of the observed global demand modeled by the Maintenance module.
export const solarPanels = {
  standard: {
    recipeId: "solar-panel",
    name: "Solar Panel",
    building: "Solar Panel",
    installedCount: 38,
    sunnyOutputKw: 150,
    maintenanceIIPerMonth: 0.2,
  },
  mono: {
    recipeId: "solar-panel-mono",
    name: "Solar Panel (Mono)",
    building: "Solar Panel (Mono)",
    installedCount: 158,
    sunnyOutputKw: 200,
    maintenanceIIPerMonth: 0.2,
  },
} as const satisfies Record<string, SolarPanelDefinition>;

export type SolarPanelCounts = Record<keyof typeof solarPanels, number>;
export const solarPanelOrder: ReadonlyArray<keyof SolarPanelCounts> = ["standard", "mono"];

export const defaultSolarPanelCounts: SolarPanelCounts = {
  standard: solarPanels.standard.installedCount,
  mono: solarPanels.mono.installedCount,
};
