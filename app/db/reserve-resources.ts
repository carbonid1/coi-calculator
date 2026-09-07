import { type ResourceId } from "./resources";

interface ReserveResourceDefinition {
  key: string;
  name: string;
  recipeId: string;
  resourceId: ResourceId;
  sourceAllocation: "primary" | "fallback";
  storageScope: "standalone" | "island";
}

export const reserveResourceCatalog = [
  {
    key: "gold",
    name: "Gold",
    recipeId: "gold-virtual-provision",
    resourceId: "gold",
    sourceAllocation: "primary",
    storageScope: "standalone",
  },
  {
    key: "fuelGas",
    name: "Fuel Gas",
    recipeId: "fuel-gas-virtual-provision",
    resourceId: "fuelGas",
    sourceAllocation: "fallback",
    storageScope: "standalone",
  },
  {
    key: "sulfur",
    name: "Sulfur",
    recipeId: "sulfur-virtual-provision",
    resourceId: "sulfur",
    sourceAllocation: "fallback",
    storageScope: "island",
  },
] as const satisfies readonly ReserveResourceDefinition[];

type ReserveKey = (typeof reserveResourceCatalog)[number]["key"];
export type ReserveValues<T> = Record<ReserveKey, T>;
export type ReserveBalances = ReserveValues<number | null>;

export function mapReserveResources<T>(
  mapDefinition: (definition: (typeof reserveResourceCatalog)[number]) => T,
): ReserveValues<T>;
export function mapReserveResources<T>(
  mapDefinition: (definition: (typeof reserveResourceCatalog)[number]) => T,
) {
  return Object.fromEntries(
    reserveResourceCatalog.map((definition) => [
      definition.key,
      mapDefinition(definition),
    ]),
  );
}
