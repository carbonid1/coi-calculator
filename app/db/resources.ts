export type ResourceState = "loose" | "fluid" | "unit";

export interface Resource {
  id: string;
  name: string;
  state: ResourceState;
}

export const resources = {
  seaWater: { id: "seaWater", name: "Sea Water", state: "fluid" },
  water: { id: "water", name: "Water", state: "fluid" },
  brine: { id: "brine", name: "Brine", state: "fluid" },
  steamDepleted: { id: "steamDepleted", name: "Steam (Depleted)", state: "fluid" },
  steamSuper: { id: "steamSuper", name: "Steam (Super)", state: "fluid" },
  steamHigh: { id: "steamHigh", name: "Steam (High)", state: "fluid" },
  steamLow: { id: "steamLow", name: "Steam (Low)", state: "fluid" },
  coreFuel: { id: "coreFuel", name: "Core Fuel", state: "unit" },
  coreFuelSpent: { id: "coreFuelSpent", name: "Core Fuel (Spent)", state: "unit" },
  blanketFuel: { id: "blanketFuel", name: "Blanket Fuel", state: "unit" },
  blanketFuelEnriched: { id: "blanketFuelEnriched", name: "Blanket Fuel (Enriched)", state: "unit" },
  hydrogen: { id: "hydrogen", name: "Hydrogen", state: "fluid" },
  oxygen: { id: "oxygen", name: "Oxygen", state: "fluid" },
  enrichedUranium4: { id: "enrichedUranium4", name: "Enriched Uranium (4%)", state: "unit" },
  enrichedUranium20: { id: "enrichedUranium20", name: "Enriched Uranium (20%)", state: "unit" },
  moxRod: { id: "moxRod", name: "MOX Rod", state: "unit" },
  salt: { id: "salt", name: "Salt", state: "loose" },
  plutonium: { id: "plutonium", name: "Plutonium", state: "unit" },
  acid: { id: "acid", name: "Acid", state: "fluid" },
  moltenGlass: { id: "moltenGlass", name: "Molten Glass", state: "fluid" },
  steel: { id: "steel", name: "Steel", state: "unit" },
  fissionProduct: { id: "fissionProduct", name: "Fission Product", state: "unit" },
  depletedUranium: { id: "depletedUranium", name: "Depleted Uranium", state: "unit" },
  yellowcake: { id: "yellowcake", name: "Yellowcake", state: "loose" },
  spentFuel: { id: "spentFuel", name: "Spent Fuel", state: "unit" },
  spentMox: { id: "spentMox", name: "Spent MOX", state: "unit" },
  uraniumOre: { id: "uraniumOre", name: "Uranium Ore", state: "loose" },
  uraniumOrePowder: { id: "uraniumOrePowder", name: "Uranium Ore Powder", state: "loose" },
  toxicSlurry: { id: "toxicSlurry", name: "Toxic Slurry", state: "fluid" },
  hydrogenFluoride: { id: "hydrogenFluoride", name: "Hydrogen Fluoride", state: "fluid" },
  titaniumAlloy: { id: "titaniumAlloy", name: "Titanium Alloy", state: "unit" },
  electronicsIv: { id: "electronicsIv", name: "Electronics IV", state: "unit" },
  compactReactor: { id: "compactReactor", name: "Compact Reactor", state: "unit" },
  electricity: { id: "electricity", name: "Electricity", state: "unit" },
} as const satisfies Record<string, Resource>;

export type ResourceId = keyof typeof resources;
