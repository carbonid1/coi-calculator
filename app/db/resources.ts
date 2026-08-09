export type ResourceState = "loose" | "fluid" | "unit";
export type RecyclableOutputId =
  | "ironScrap"
  | "copperScrap"
  | "aluminumScrap"
  | "goldScrap"
  | "brokenGlass";

export interface Resource {
  id: string;
  name: string;
  state: ResourceState;
  /** Recoverable outputs carried by one unit of this product in the current production path. */
  recyclableSources?: Partial<Record<RecyclableOutputId, number>>;
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
  sulfur: { id: "sulfur", name: "Sulfur", state: "loose" },
  acid: { id: "acid", name: "Acid", state: "fluid" },
  naphtha: { id: "naphtha", name: "Naphtha", state: "fluid" },
  ethanol: { id: "ethanol", name: "Ethanol", state: "fluid" },
  carbonDioxide: { id: "carbonDioxide", name: "Carbon Dioxide", state: "fluid" },
  graphite: { id: "graphite", name: "Graphite", state: "loose" },
  rubber: { id: "rubber", name: "Rubber", state: "unit" },
  glass: {
    id: "glass",
    name: "Glass",
    state: "unit",
    recyclableSources: { brokenGlass: 1 },
  },
  plastic: { id: "plastic", name: "Plastic", state: "unit" },
  pcb: { id: "pcb", name: "PCB", state: "unit" },
  moltenSilicon: { id: "moltenSilicon", name: "Molten Silicon", state: "fluid" },
  polySilicon: { id: "polySilicon", name: "Poly Silicon", state: "unit" },
  siliconWafer: { id: "siliconWafer", name: "Silicon Wafer", state: "unit" },
  microchipStage1A: { id: "microchipStage1A", name: "Microchip Wafer (1A)", state: "unit" },
  microchipStage1B: { id: "microchipStage1B", name: "Microchip Wafer (1B)", state: "unit" },
  microchipStage1C: { id: "microchipStage1C", name: "Microchip Wafer (1C)", state: "unit" },
  microchipStage2A: { id: "microchipStage2A", name: "Microchip Wafer (2A)", state: "unit" },
  microchipStage2B: { id: "microchipStage2B", name: "Microchip Wafer (2B)", state: "unit" },
  microchipStage2C: { id: "microchipStage2C", name: "Microchip Wafer (2C)", state: "unit" },
  microchipStage3A: { id: "microchipStage3A", name: "Microchip Wafer (3A)", state: "unit" },
  microchipStage3B: { id: "microchipStage3B", name: "Microchip Wafer (3B)", state: "unit" },
  microchipStage3C: { id: "microchipStage3C", name: "Microchip Wafer (3C)", state: "unit" },
  microchipStage4A: { id: "microchipStage4A", name: "Microchip Wafer (4A)", state: "unit" },
  microchipStage4B: { id: "microchipStage4B", name: "Microchip Wafer (4B)", state: "unit" },
  microchips: { id: "microchips", name: "Microchips", state: "unit" },
  impureCopper: { id: "impureCopper", name: "Impure Copper", state: "unit" },
  copper: {
    id: "copper",
    name: "Copper",
    state: "unit",
    recyclableSources: { copperScrap: 1 },
  },
  ironScrap: { id: "ironScrap", name: "Iron Scrap", state: "loose" },
  copperScrap: { id: "copperScrap", name: "Copper Scrap", state: "loose" },
  aluminumScrap: { id: "aluminumScrap", name: "Aluminum Scrap", state: "loose" },
  goldScrap: { id: "goldScrap", name: "Gold Scrap", state: "loose" },
  brokenGlass: { id: "brokenGlass", name: "Broken Glass", state: "loose" },
  moltenCopper: { id: "moltenCopper", name: "Molten Copper", state: "fluid" },
  copperOre: { id: "copperOre", name: "Copper Ore", state: "loose" },
  copperOreCrushed: { id: "copperOreCrushed", name: "Copper Ore Crushed", state: "loose" },
  sand: { id: "sand", name: "Sand", state: "loose" },
  slag: { id: "slag", name: "Slag", state: "loose" },
  exhaust: { id: "exhaust", name: "Exhaust", state: "fluid" },
  moltenGlass: { id: "moltenGlass", name: "Molten Glass", state: "fluid" },
  steel: { id: "steel", name: "Steel", state: "unit" },
  fissionProduct: { id: "fissionProduct", name: "Fission Product", state: "unit" },
  retiredWaste: { id: "retiredWaste", name: "Retired Waste", state: "unit" },
  recyclables: { id: "recyclables", name: "Recyclables", state: "loose" },
  depletedUranium: { id: "depletedUranium", name: "Depleted Uranium", state: "unit" },
  yellowcake: { id: "yellowcake", name: "Yellowcake", state: "loose" },
  spentFuel: { id: "spentFuel", name: "Spent Fuel", state: "unit" },
  spentMox: { id: "spentMox", name: "Spent MOX", state: "unit" },
  uraniumOre: { id: "uraniumOre", name: "Uranium Ore", state: "loose" },
  uraniumOrePowder: { id: "uraniumOrePowder", name: "Uranium Ore Powder", state: "loose" },
  foodPack: { id: "foodPack", name: "Food Pack", state: "unit" },
  goldOre: { id: "goldOre", name: "Gold Ore", state: "loose" },
  goldOreCrushed: { id: "goldOreCrushed", name: "Gold Ore Crushed", state: "loose" },
  goldOrePowder: { id: "goldOrePowder", name: "Gold Ore Powder", state: "loose" },
  goldOreConcentrate: { id: "goldOreConcentrate", name: "Gold Ore Concentrate", state: "loose" },
  gold: {
    id: "gold",
    name: "Gold",
    state: "unit",
    recyclableSources: { goldScrap: 1 },
  },
  ironOre: { id: "ironOre", name: "Iron Ore", state: "loose" },
  labEquipmentIv: { id: "labEquipmentIv", name: "Lab Equipment IV", state: "unit" },
  toxicSlurry: { id: "toxicSlurry", name: "Toxic Slurry", state: "fluid" },
  hydrogenFluoride: { id: "hydrogenFluoride", name: "Hydrogen Fluoride", state: "fluid" },
  titaniumAlloy: { id: "titaniumAlloy", name: "Titanium Alloy", state: "unit" },
  // Mechanical Parts use the Steel recipe in the current factory path. The
  // game tracks this provenance dynamically; one part carries one Iron Scrap.
  mechanicalParts: {
    id: "mechanicalParts",
    name: "Mechanical Parts",
    state: "unit",
    recyclableSources: { ironScrap: 1 },
  },
  electronicsI: {
    id: "electronicsI",
    name: "Electronics I",
    state: "unit",
    recyclableSources: { copperScrap: 1 },
  },
  electronicsII: {
    id: "electronicsII",
    name: "Electronics II",
    state: "unit",
    recyclableSources: { copperScrap: 2.25, brokenGlass: 0.25 },
  },
  electronicsIII: {
    id: "electronicsIII",
    name: "Electronics III",
    state: "unit",
    recyclableSources: {
      copperScrap: 31 / 6,
      brokenGlass: 0.5,
      goldScrap: 0.5,
    },
  },
  electronicsIv: { id: "electronicsIv", name: "Electronics IV", state: "unit" },
  maintenanceI: { id: "maintenanceI", name: "Maintenance I", state: "unit" },
  maintenanceII: { id: "maintenanceII", name: "Maintenance II", state: "unit" },
  maintenanceIII: { id: "maintenanceIII", name: "Maintenance III", state: "unit" },
  compactReactor: { id: "compactReactor", name: "Compact Reactor", state: "unit" },
  electricity: { id: "electricity", name: "Electricity", state: "unit" },
} as const satisfies Record<string, Resource>;

export type ResourceId = keyof typeof resources;
