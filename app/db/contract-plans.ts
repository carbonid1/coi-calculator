interface ContractRoutePlan {
  /** False forecasts this route as unavailable without changing the game. */
  enabled?: boolean
  /** Fixed import allocation, or null/omitted to follow the remaining factory demand. */
  importedPerProductionCycle?: number | null
}

export type ContractRoutePlans = Readonly<Partial<Record<number, ContractRoutePlan>>>

/** Calculator-owned overrides for synced cargo-depot contract routes. */
export const contractRoutePlans: ContractRoutePlans = {}

/** Keep surplus Food Packs moving into the Uranium Ore stockpile. */
export const surplusExportContractIds: ReadonlySet<string> = new Set([
  'uranium-ore-for-food-pack',
])
