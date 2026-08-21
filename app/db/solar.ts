export interface SolarPanelDefinition {
  recipeId: string;
  name: string;
  building: string;
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
