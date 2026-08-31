import { type GroundwaterSourceConstraint } from '../helpers/groundwater/calculate-groundwater-production'
import { chickenFarm } from './chicken-farm'
import { computingRecipeIds, dataCenter } from './computing'
import {
  calculateCropFarmGroupRates,
  cropFarmGroups,
  cropFarmTiers,
  fertilizers,
  type CropFarmGroup,
} from './crop-farming'
import { activeHousingType, housingTypes } from './housing'
import { maintenanceStatue } from './maintenance-statue'
import { getOfficeRecipeId, officeCatalog, type OfficeBoostStep } from './offices'
import { TREE_FULL_GROWTH_CYCLES } from './research'
import { reserveResourceCatalog } from './reserve-resources'
import { type ResourceId } from './resources'
import { calculateSettlementPopulationFlows, settlementRecipeIds } from './settlement'
import { solarPanels } from './solar'
import {
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationLevel,
  rocketIiGameData,
} from './space-station'

export interface Ingredient {
  resourceId: ResourceId
  quantity: number // per 60 seconds
  /** Additional output quantity that is not scaled by outputModifierId. */
  modifierExemptQuantity?: number
  /** Optional modifier for modifierExemptQuantity; defaults to no scaling. */
  modifierExemptOutputModifierId?: OutputModifierId
  inputModifierId?: InputModifierId
  outputModifierId?: OutputModifierId
  /** Applies the configured seed's finite-buffer farm rainfall simulation. */
  weatherAdjustedFarmId?: string
  /** Runtime-defined farm configuration used when no static farm ID exists. */
  weatherAdjustedFarm?: CropFarmGroup
}

export type RecipeGroup = 'source' | 'electricity' | 'production' | 'waste' | 'sink'
export type InputModifierId =
  | 'cropWater'
  | 'foodConsumption'
  | 'rocketLaunches'
  | 'settlementConsumption'
  | 'settlementWater'
  | 'treeGrowthSpeed'
export type OutputModifierId =
  | 'foodConsumption'
  | 'maintenanceOutput'
  | 'settlementConsumption'
  | 'settlementWater'
  | 'solarPower'
  | 'cropYield'
  | 'treeGrowthSpeed'
type BalanceBy = 'input' | 'output'
type RecipeAllocation = 'primary' | 'fallback' | 'surplus'
export type SourceKind = 'groundwater' | 'map-mine' | 'virtual-provision' | 'world-mine'
export type SourceMode = 'demand' | 'module-demand' | 'demand-capped' | 'module-demand-capped'

export const isUnboundedDemandSourceMode = (mode: SourceMode | undefined) => (
  mode === 'demand' || mode === 'module-demand'
)

export const isModuleScopedSourceMode = (mode: SourceMode | undefined) => (
  mode === 'module-demand' || mode === 'module-demand-capped'
)

interface SharedCapacity {
  /** Recipes with the same ID share one installed building pool inside a module. */
  id: string
  /** Optional UI label for distinguishing separate pools of the same building type. */
  label?: string
  /** Optional UI order; larger values render later than ordinary production cards. */
  displayOrder?: number
  /** Lower values are allocated first, matching the in-game recipe order. */
  priority: number
}

interface DisplayGroup {
  /** Independent recipes rendered as operations of one physical entity. */
  id: string
  label: string
}

export interface DecayStorage {
  capacity: number
  decayCycles: number
}

export interface Recipe {
  id: string
  /** Exact stable ID exported by the game for an in-game selectable recipe. */
  gameRecipeId?: string
  /** Placement section for a synced train-station module card. */
  stationRole?: 'input' | 'export'
  /** Optional concise label used when the building name is already visible. */
  displayName?: string
  /** Internal calculation line intentionally omitted from the module card list. */
  hiddenFromModuleView?: boolean
  name: string
  building: string
  /** Whether generic cards show recipe and speed metadata below the building name. */
  showConfigurationSummary?: boolean
  /** Visually combines independent operations without sharing calculation capacity. */
  displayGroup?: DisplayGroup
  group: RecipeGroup
  inputs: Ingredient[]
  outputs: Ingredient[]
  decayStorage?: DecayStorage
  /** The resource side that determines utilization when this recipe is not fixed by its preset. */
  balanceBy?: BalanceBy
  /** Inputs that cap utilization; input-balanced recipes default to every input. */
  balanceInputIds?: ResourceId[]
  /** Lower values consume a shared constrained resource first across buildings. */
  inputPriorities?: Partial<Record<ResourceId, number>>
  /** Outputs that create demand for an output-balanced recipe; defaults to every output. */
  balanceOutputIds?: ResourceId[]
  /** Lower values allocate demand-balanced recipes first when planned outputs compete. */
  demandPriority?: number
  /** Fallback recipes run after ordinary production; surplus recipes run last. */
  allocation?: RecipeAllocation
  /** Lower values run first within the same non-primary allocation pass. */
  allocationPriority?: number
  /** Inputs whose remaining surplus may drive additional utilization after ordinary demand. */
  consumeSurplusInputIds?: ResourceId[]
  /** Limits additional surplus consumption to production inside the same physical module. */
  consumeSurplusInputScope?: 'module'
  /** Lower values receive a shared surplus resource first. */
  surplusConsumptionPriority?: number
  /** Input-balanced recipes can consume only net production from their own physical module. */
  balanceInputScope?: 'module'
  sharedCapacity?: SharedCapacity
  cycleDurationSeconds?: number
  /**
   * Whether creating Recyclables applies the global recycling-efficiency loss.
   * Defaults to true. Captain of Industry v0.8.6 bypasses it for Shredder;
   * settlement collection uses its own source-to-Recyclables conversion.
   */
  appliesRecyclingEfficiency?: boolean
  /** Emits the recoverable material composition carried by Recyclables. */
  sortsRecyclableSources?: boolean
  /** Demand sources cover deficits; module variants remain owned by one physical area. */
  sourceMode?: SourceMode
  sourceKind?: SourceKind
  /** Synced aquifer state and its weather-limited steady-state pump ceiling. */
  groundwaterConstraint?: GroundwaterSourceConstraint
  /** Unbounded sinks remove every available unit of their declared excess inputs. */
  sinkMode?: 'unbounded'
  /** Module-scoped sinks can dispose only excess attributable to their own module. */
  sinkScope?: 'module'
  /** Lower-priority sinks run first; useful conversion can follow local disposal. */
  sinkPriority?: number
  /** Recipe-specific multiplier applied to the building's base electricity draw. */
  electricityMultiplier?: number
  /** Scale the building's electricity demand by speedLevel (used for per-population housing). */
  electricityScalesWithSpeed?: boolean
  /** Scale the building's computing demand by speedLevel (used for per-100-population services). */
  computingScalesWithSpeed?: boolean
  /** Recipe-specific multiplier applied to the building's computing demand. */
  computingMultiplier?: number
  /** Scales population-driven electricity demand with a global input modifier. */
  electricityInputModifierId?: InputModifierId
  /** Scales population-driven computing demand with a global input modifier. */
  computingInputModifierId?: InputModifierId
  /** Generators in one group share utilization; lower priorities serve demand first. */
  electricityDispatch?: {
    groupId: string
    priority: number
  }
  /** Displays fractional throughput as a livestock count instead of a generic speed. */
  animalPopulationCapacity?: number
  /** Smallest useful livestock adjustment supported by the in-game control. */
  animalPopulationStep?: number
  /** Human-readable plural used by livestock diagnostics. */
  animalPopulationLabel?: string
  /** In-game fertilizer control shown on crop-farm production cards. */
  farmFertilizer?: {
    targetFertilityPercent: number
    maximumFertilityPercent: number
  }
  /** False for modes or capabilities that do not represent a separate physical building. */
  tracksPhysicalCapacity?: boolean
}

const radioactiveWasteStorageCapacity = 2400
const fissionProductDecayCycles = 100 * 12
const radioactiveWasteStorageThroughput =
  radioactiveWasteStorageCapacity / fissionProductDecayCycles
const housingPopulationFlows = calculateSettlementPopulationFlows(
  activeHousingType.populationCapacity,
  activeHousingType,
)
const housingIiPopulationFlows = calculateSettlementPopulationFlows(
  housingTypes.housingII.populationCapacity,
  housingTypes.housingII,
)

export const createCropFarmRecipe = (group: CropFarmGroup): Recipe => {
  const rates = calculateCropFarmGroupRates(group)
  const fertilizerDefinition = group.fertilizer ? fertilizers[group.fertilizer.id] : null
  const fertilizerInput = fertilizerDefinition
    ? [
        {
          resourceId: fertilizerDefinition.resourceId,
          quantity: rates.fertilizerPerMonth,
        },
      ]
    : []

  return {
    id: group.id,
    name: `${cropFarmTiers[group.tierId].name} (${group.name})`,
    building: cropFarmTiers[group.tierId].name,
    group: 'production',
    cycleDurationSeconds: 60,
    farmFertilizer:
      group.fertilizer && fertilizerDefinition
        ? {
            targetFertilityPercent: group.fertilizer.targetFertilityPercent,
            maximumFertilityPercent: fertilizerDefinition.maximumFertilityPercent,
          }
        : undefined,
    inputs: [
      {
        resourceId: 'water',
        quantity: rates.waterPerMonth,
        inputModifierId: 'cropWater',
        weatherAdjustedFarmId: group.id,
        weatherAdjustedFarm: group,
      },
      ...fertilizerInput,
    ],
    outputs: [...rates.outputsPerMonth].map(([resourceId, quantity]) => ({
      resourceId,
      quantity,
      outputModifierId: 'cropYield',
    })),
  }
}

const cropFarmRecipes: Recipe[] = cropFarmGroups.map(createCropFarmRecipe)

export const recipes: Recipe[] = [
  // Sources
  {
    // Captain of Industry v0.8.6c: one sapling becomes 20 Wood when harvested
    // at 100% growth after 12 in-game years. Forest area is intentionally
    // unbounded, so this demand source scales the number of growing trees.
    id: 'forestry-trees-100-growth',
    name: 'Forestry Control Tower (Mature tree harvesting)',
    building: 'Forestry Control Tower',
    group: 'source',
    cycleDurationSeconds: TREE_FULL_GROWTH_CYCLES * 60,
    inputs: [
      {
        resourceId: 'treeSapling',
        quantity: 1 / TREE_FULL_GROWTH_CYCLES,
        inputModifierId: 'treeGrowthSpeed',
      },
    ],
    outputs: [
      {
        resourceId: 'wood',
        quantity: 20 / TREE_FULL_GROWTH_CYCLES,
        outputModifierId: 'treeGrowthSpeed',
      },
    ],
    sourceMode: 'demand',
  },
  {
    id: 'seawater-pump',
    name: 'Seawater Pump (Fast)',
    building: 'Seawater Pump',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'seaWater', quantity: 216 }],
    // Pumps are physically piped inside their module. Do not let spare pump
    // capacity in one network supply a different module's desalination plant.
    sourceMode: 'module-demand-capped',
  },
  {
    id: 'seawater-pump-tall',
    name: 'Seawater Pump (Tall) (Fast)',
    building: 'Seawater Pump (Tall)',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'seaWater', quantity: 216 }],
    sourceMode: 'module-demand-capped',
  },
  {
    id: 'coal-map-mine',
    name: 'Coal (Map Mine)',
    building: 'Coal Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'coal', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'copper-map-mine',
    name: 'Copper Ore (Map Mine)',
    building: 'Copper Ore Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'copperOre', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'iron-map-mine',
    name: 'Iron Ore (Map Mine)',
    building: 'Iron Ore Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'ironOre', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'limestone-map-mine',
    name: 'Limestone (Map Mine)',
    building: 'Limestone Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'limestone', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'sulfur-world-mine',
    name: 'Sulfur (World Mine)',
    building: 'Sulfur World Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'sulfur', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'world-mine',
  },
  {
    id: 'gold-map-mine',
    name: 'Gold Ore (Map Mine)',
    building: 'Gold Ore Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'goldOre', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  ...reserveResourceCatalog.map(
    ({ name, recipeId, resourceId }): Recipe => ({
      id: recipeId,
      name: `${name} (Synced Reserve)`,
      building: 'Eligible Storage',
      group: 'source',
      inputs: [],
      outputs: [{ resourceId, quantity: 0 }],
      sourceMode: 'demand',
      sourceKind: 'virtual-provision',
    }),
  ),
  {
    id: 'bauxite-map-mine',
    name: 'Bauxite (Map Mine)',
    building: 'Bauxite Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'bauxite', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'titanium-map-mine',
    name: 'Titanium Ore (Map Mine)',
    building: 'Titanium Ore Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'titaniumOre', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'sand-map-mine',
    name: 'Sand (Map Mine)',
    building: 'Sand Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'sand', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'rock-map-mine',
    name: 'Rock (Map Mine)',
    building: 'Rock Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'rock', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    id: 'dirt-map-mine',
    name: 'Dirt (Map Mine)',
    building: 'Dirt Mine',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'dirt', quantity: 0 }],
    sourceMode: 'demand',
    sourceKind: 'map-mine',
  },
  {
    // Captain of Industry v0.8.7: 8 Water every 10 seconds.
    id: 'groundwater-pump',
    name: 'Groundwater Pump',
    building: 'Groundwater Pump',
    group: 'source',
    cycleDurationSeconds: 10,
    inputs: [],
    outputs: [{ resourceId: 'water', quantity: 48 }],
    sourceMode: 'module-demand-capped',
    sourceKind: 'groundwater',
  },
  {
    // Same v0.8.7 building, connected to the factory water network as reserve capacity.
    id: 'groundwater-pump-factory-reserve',
    name: 'Groundwater Pump (Factory reserve)',
    building: 'Groundwater Pump',
    group: 'source',
    cycleDurationSeconds: 10,
    inputs: [],
    outputs: [{ resourceId: 'water', quantity: 48 }],
    sourceMode: 'demand-capped',
    sourceKind: 'groundwater',
  },
  {
    id: 'slag-terrain-dump',
    name: 'Terrain Dump (Slag)',
    building: 'Terrain Dump',
    group: 'sink',
    inputs: [{ resourceId: 'slag', quantity: 1 }],
    outputs: [],
    sinkMode: 'unbounded',
  },
  {
    id: 'waste-terrain-dump',
    name: 'Terrain Dump (Waste)',
    building: 'Terrain Dump',
    group: 'sink',
    inputs: [{ resourceId: 'waste', quantity: 1 }],
    outputs: [],
    sinkMode: 'unbounded',
  },
  {
    id: 'dirt-terrain-dump',
    name: 'Terrain Dump (Dirt)',
    building: 'Terrain Dump',
    group: 'sink',
    inputs: [{ resourceId: 'dirt', quantity: 1 }],
    outputs: [],
    sinkMode: 'unbounded',
  },

  // Electricity
  {
    id: 'fbr',
    name: 'Fast Breeder Reactor',
    building: 'Fast Breeder Reactor',
    group: 'electricity',
    inputs: [
      { resourceId: 'water', quantity: 96 },
      { resourceId: 'coreFuel', quantity: 4 },
      { resourceId: 'blanketFuel', quantity: 4 },
    ],
    outputs: [
      { resourceId: 'steamSuper', quantity: 96 },
      { resourceId: 'coreFuelSpent', quantity: 4 },
      { resourceId: 'blanketFuelEnriched', quantity: 4 },
    ],
  },
  {
    id: 'fbr-0x',
    name: 'FBR (0x Enrichment)',
    building: 'Fast Breeder Reactor',
    group: 'electricity',
    inputs: [
      { resourceId: 'water', quantity: 96 },
      { resourceId: 'coreFuel', quantity: 2 },
    ],
    outputs: [
      { resourceId: 'steamSuper', quantity: 96 },
      { resourceId: 'coreFuelSpent', quantity: 2 },
    ],
  },
  {
    id: 'fbr-3x',
    name: 'FBR (3x Enrichment)',
    building: 'Fast Breeder Reactor',
    group: 'electricity',
    inputs: [
      { resourceId: 'water', quantity: 24 },
      { resourceId: 'coreFuel', quantity: 4 },
      { resourceId: 'blanketFuel', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'steamSuper', quantity: 24 },
      { resourceId: 'coreFuelSpent', quantity: 4 },
      { resourceId: 'blanketFuelEnriched', quantity: 12 },
    ],
  },
  {
    id: 'turbine-super',
    name: 'Super-Pressure Turbine',
    building: 'Super-Pressure Turbine',
    group: 'electricity',
    inputs: [{ resourceId: 'steamSuper', quantity: 48 }],
    outputs: [
      { resourceId: 'steamHigh', quantity: 48 },
      { resourceId: 'electricity', quantity: 15 },
    ],
    electricityDispatch: { groupId: 'fbr-turbines', priority: 2 },
  },
  {
    id: 'turbine-high',
    name: 'High-Pressure Turbine II',
    building: 'High-Pressure Turbine II',
    group: 'electricity',
    inputs: [{ resourceId: 'steamHigh', quantity: 48 }],
    outputs: [
      { resourceId: 'steamLow', quantity: 48 },
      { resourceId: 'electricity', quantity: 10 },
    ],
    electricityDispatch: { groupId: 'fbr-turbines', priority: 2 },
  },
  {
    id: 'turbine-low',
    name: 'Low-Pressure Turbine II',
    building: 'Low-Pressure Turbine II',
    group: 'electricity',
    inputs: [{ resourceId: 'steamLow', quantity: 48 }],
    outputs: [
      { resourceId: 'steamDepleted', quantity: 48 },
      { resourceId: 'electricity', quantity: 5 },
    ],
    electricityDispatch: { groupId: 'fbr-turbines', priority: 2 },
  },
  {
    id: 'power-generator-ii-nuclear',
    name: 'Power Generator II',
    building: 'Power Generator II',
    group: 'electricity',
    inputs: [],
    outputs: [],
    // Turbine recipes already expose the Generator II electrical output. Keep
    // the physical generator on the same dispatch ratio so its card reports
    // the matching average load without double-counting electricity.
    electricityDispatch: { groupId: 'fbr-turbines', priority: 2 },
  },
  {
    id: solarPanels.standard.recipeId,
    name: solarPanels.standard.name,
    building: solarPanels.standard.building,
    group: 'electricity',
    inputs: [],
    outputs: [
      {
        resourceId: 'electricity',
        quantity: solarPanels.standard.sunnyOutputKw / 1000,
        outputModifierId: 'solarPower',
      },
    ],
    electricityDispatch: { groupId: 'solar', priority: 1 },
  },
  {
    id: solarPanels.mono.recipeId,
    name: solarPanels.mono.name,
    building: solarPanels.mono.building,
    group: 'electricity',
    inputs: [],
    outputs: [
      {
        resourceId: 'electricity',
        quantity: solarPanels.mono.sunnyOutputKw / 1000,
        outputModifierId: 'solarPower',
      },
    ],
    electricityDispatch: { groupId: 'solar', priority: 1 },
  },

  // Production (order = priority)

  // Settlement demand at full configured housing population capacity
  {
    id: settlementRecipeIds.residents,
    displayName: activeHousingType.name,
    name: `${activeHousingType.name} Residents`,
    building: activeHousingType.name,
    showConfigurationSummary: false,
    group: 'production',
    inputs: housingPopulationFlows.inputs,
    outputs: housingPopulationFlows.outputs,
    // v0.8.6 settlement collection converts tracked recyclable sources with
    // its own 2:1 rule; the global recycling modifier is not applied here.
    appliesRecyclingEfficiency: false,
    electricityInputModifierId: 'settlementConsumption',
    electricityScalesWithSpeed: true,
  },
  {
    id: settlementRecipeIds.residentsII,
    displayName: housingTypes.housingII.name,
    name: `${housingTypes.housingII.name} Residents`,
    building: housingTypes.housingII.name,
    showConfigurationSummary: false,
    group: 'production',
    inputs: housingIiPopulationFlows.inputs,
    outputs: housingIiPopulationFlows.outputs,
    appliesRecyclingEfficiency: false,
    electricityInputModifierId: 'settlementConsumption',
    electricityScalesWithSpeed: true,
  },
  {
    id: settlementRecipeIds.internetModule,
    name: 'Internet Module',
    building: 'Internet Module',
    group: 'production',
    inputs: [],
    outputs: [],
    computingInputModifierId: 'settlementConsumption',
    computingScalesWithSpeed: true,
  },
  {
    id: computingRecipeIds.dataCenter,
    name: 'Data Center',
    building: 'Data Center',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    // v0.8.6 Basic rack: 4 TFLOPS, 0.5 chilled water, 0.5 returned water per month.
    id: computingRecipeIds.basicRack,
    name: 'Basic Rack',
    building: 'Basic Rack',
    group: 'production',
    // Computing is the capacity-driving output; returned Water is a byproduct.
    balanceOutputIds: ['computing'],
    inputs: [{ resourceId: 'chilledWater', quantity: dataCenter.chilledWaterPerRack }],
    outputs: [
      { resourceId: 'water', quantity: dataCenter.chilledWaterPerRack },
      { resourceId: 'computing', quantity: dataCenter.computingTflopsPerRack },
    ],
  },
  {
    // v0.8.6 Water Chiller: 10 Water -> 8 Chilled Water every 20 seconds.
    id: computingRecipeIds.waterChiller,
    name: 'Water Chiller',
    building: 'Water Chiller',
    group: 'production',
    inputs: [{ resourceId: 'water', quantity: 30 }],
    outputs: [{ resourceId: 'chilledWater', quantity: 24 }],
    balanceBy: 'output',
  },
  {
    id: settlementRecipeIds.foodMarket,
    name: 'Food Market',
    building: 'Food Market',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.foodMarketII,
    name: 'Food Market II',
    building: 'Food Market II',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.transformer,
    name: 'Transformer',
    building: 'Transformer',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.waterFacility,
    name: 'Water Facility',
    building: 'Water Facility',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.householdGoodsModule,
    name: 'Household Goods Module',
    building: 'Household Goods Module',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.wasteCollection,
    name: 'Waste Collection',
    building: 'Waste Collection',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.recyclablesCollection,
    name: 'Recyclables Collection',
    building: 'Recyclables Collection',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.biomassCollection,
    name: 'Biomass Collection',
    building: 'Biomass Collection',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.clinic,
    name: 'Clinic I',
    building: 'Clinic I',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  {
    id: settlementRecipeIds.wastewaterTreatment,
    name: 'Wastewater Treatment (Filter Media)',
    building: 'Wastewater Treatment',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'input',
    balanceInputIds: ['wasteWater'],
    inputs: [
      { resourceId: 'wasteWater', quantity: 160 },
      { resourceId: 'filterMedia', quantity: 8 },
      { resourceId: 'chlorine', quantity: 16 },
    ],
    outputs: [
      { resourceId: 'water', quantity: 120 },
      { resourceId: 'sludge', quantity: 36 },
    ],
  },
  {
    id: settlementRecipeIds.anaerobicDigester,
    name: 'Anaerobic Digester (Sludge)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['sludge'],
    inputs: [{ resourceId: 'sludge', quantity: 18 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 8 },
      { resourceId: 'compost', quantity: 3 },
    ],
  },
  {
    id: settlementRecipeIds.biomassCompostMixer,
    name: 'Mixer II (Biomass → Compost)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['biomass'],
    balanceInputScope: 'module',
    inputs: [{ resourceId: 'biomass', quantity: 24 }],
    outputs: [{ resourceId: 'compost', quantity: 16 }],
  },

  // Settlement food. Each recipe uses its own dedicated building installation.
  {
    id: 'mill-wheat',
    name: 'Mill (Wheat)',
    building: 'Mill',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['flour'],
    inputs: [{ resourceId: 'wheat', quantity: 16 }],
    outputs: [
      { resourceId: 'flour', quantity: 16 },
      { resourceId: 'animalFeed', quantity: 2 },
    ],
  },
  {
    id: 'mill-canola-cooking-oil',
    name: 'Mill (Canola → Cooking Oil)',
    building: 'Mill',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['cookingOil'],
    inputs: [{ resourceId: 'canola', quantity: 16 }],
    outputs: [
      { resourceId: 'cookingOil', quantity: 12 },
      { resourceId: 'animalFeed', quantity: 4 },
    ],
  },
  {
    id: 'baking-unit-bread',
    name: 'Baking Unit (Bread)',
    building: 'Baking Unit',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'flour', quantity: 16 },
      { resourceId: 'water', quantity: 8 },
    ],
    outputs: [{ resourceId: 'bread', quantity: 24 }],
  },
  {
    id: 'baking-unit-cake',
    name: 'Baking Unit (Cake)',
    building: 'Baking Unit',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    demandPriority: -2,
    inputs: [
      { resourceId: 'flour', quantity: 10 },
      { resourceId: 'sugar', quantity: 4 },
      { resourceId: 'cookingOil', quantity: 2 },
      { resourceId: 'eggs', quantity: 2 },
      { resourceId: 'fruit', quantity: 2 },
    ],
    outputs: [{ resourceId: 'cake', quantity: 14 }],
  },
  {
    id: 'food-processor-snack',
    name: 'Food Processor (Snack)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['snack'],
    inputs: [
      { resourceId: 'corn', quantity: 24 },
      { resourceId: 'sugar', quantity: 6 },
      { resourceId: 'cookingOil', quantity: 3 },
      { resourceId: 'salt', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'snack', quantity: 24 },
      { resourceId: 'biomass', quantity: 3 },
    ],
  },
  {
    id: 'food-processor-sugar',
    name: 'Food Processor (Sugar)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['sugar'],
    inputs: [
      { resourceId: 'sugarCane', quantity: 15 },
      { resourceId: 'water', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'sugar', quantity: 12 },
      { resourceId: 'biomass', quantity: 6 },
    ],
  },
  {
    id: 'food-processor-sausage',
    // Captain of Industry v0.8.6 game-data rate, normalized to 60 seconds.
    name: 'Food Processor (Sausage)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['sausage'],
    inputs: [
      { resourceId: 'meatTrimmings', quantity: 24 },
      { resourceId: 'flour', quantity: 6 },
      { resourceId: 'salt', quantity: 9 },
    ],
    outputs: [{ resourceId: 'sausage', quantity: 24 }],
  },
  {
    id: 'food-processor-tofu',
    // Captain of Industry v0.8.6 game-data rate, normalized to 60 seconds.
    name: 'Food Processor (Tofu)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['tofu'],
    inputs: [
      { resourceId: 'soybean', quantity: 9 },
      { resourceId: 'water', quantity: 6 },
      { resourceId: 'sulfur', quantity: 1.5 },
      { resourceId: 'limestone', quantity: 1.5 },
    ],
    outputs: [
      { resourceId: 'tofu', quantity: 12 },
      { resourceId: 'animalFeed', quantity: 4.5 },
    ],
  },
  {
    id: 'mixer-ii-animal-feed-corn',
    name: 'Mixer II (Animal Feed)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    inputs: [{ resourceId: 'corn', quantity: 120 }],
    outputs: [{ resourceId: 'animalFeed', quantity: 144 }],
  },
  {
    // Captain of Industry v0.8.7 game data: 4 Tree Saplings become 4 Biomass
    // every 10 seconds, normalized here to one 60-second production cycle.
    // Forestry reserves its planting demand first; this line shreds only the
    // remaining crop surplus into the Default module's local Biomass belt.
    id: 'shredder-tree-saplings',
    name: 'Shredder (Tree Saplings → Biomass)',
    building: 'Shredder',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'input',
    balanceInputIds: ['treeSapling'],
    allocation: 'surplus',
    allocationPriority: 5,
    inputs: [{ resourceId: 'treeSapling', quantity: 24 }],
    outputs: [{ resourceId: 'biomass', quantity: 24 }],
  },
  {
    id: 'mixer-ii-biomass-compost',
    name: 'Mixer II (Biomass → Compost)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    // This installation is physically fed by the Default-area food processors and
    // Tree Sapling shredder. It cannot accept Biomass exported by other modules.
    balanceInputScope: 'module',
    sharedCapacity: {
      id: 'mixer-ii-biomass-compost-general',
      priority: 1,
    },
    allocation: 'surplus',
    allocationPriority: 10,
    inputs: [{ resourceId: 'biomass', quantity: 24 }],
    outputs: [{ resourceId: 'compost', quantity: 16 }],
  },

  // Fertilizer and Plastic production paths recorded from v0.8.6 game data.
  // Alternative recipes remain available in the database without being active.
  {
    id: 'air-separator-nitrogen',
    name: 'Air Separator',
    building: 'Air Separator',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['nitrogen'],
    inputs: [],
    outputs: [
      { resourceId: 'oxygen', quantity: 36 },
      { resourceId: 'nitrogen', quantity: 36 },
    ],
  },
  {
    id: 'chemical-plant-ii-ammonia',
    name: 'Chemical Plant II (Ammonia)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    // Hydrogen and Nitrogen are supporting inputs produced after the remaining
    // Ammonia deficit is known; Sour Water recovery is the only prior supply.
    balanceInputIds: [],
    allocation: 'fallback',
    allocationPriority: 50,
    inputs: [
      { resourceId: 'hydrogen', quantity: 12 },
      { resourceId: 'nitrogen', quantity: 24 },
    ],
    outputs: [{ resourceId: 'ammonia', quantity: 12 }],
    electricityMultiplier: 2,
  },
  {
    id: 'mixer-ii-organic-fertilizer-compost',
    name: 'Mixer II (Organic Fertilizer — Compost)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'compost', quantity: 72 },
      { resourceId: 'water', quantity: 24 },
    ],
    outputs: [{ resourceId: 'fertilizerOrganic', quantity: 96 }],
  },
  {
    id: 'mixer-ii-organic-fertilizer-dirt',
    name: 'Mixer II (Organic Fertilizer — Dirt)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'compost', quantity: 24 },
      { resourceId: 'dirt', quantity: 48 },
      { resourceId: 'water', quantity: 24 },
    ],
    outputs: [{ resourceId: 'fertilizerOrganic', quantity: 96 }],
  },
  {
    id: 'chemical-plant-ii-fertilizer-i',
    name: 'Chemical Plant II (Fertilizer I)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'ammonia', quantity: 24 },
      { resourceId: 'oxygen', quantity: 36 },
    ],
    outputs: [{ resourceId: 'fertilizerI', quantity: 60 }],
  },
  {
    id: 'chemical-plant-ii-fertilizer-i-organic',
    name: 'Chemical Plant II (Fertilizer I — Organic)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'fertilizerOrganic', quantity: 60 },
      { resourceId: 'ammonia', quantity: 24 },
      { resourceId: 'oxygen', quantity: 36 },
    ],
    outputs: [{ resourceId: 'fertilizerI', quantity: 90 }],
  },
  {
    id: 'mixer-ii-fertilizer-ii',
    name: 'Mixer II (Fertilizer II)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'fertilizerI', quantity: 60 },
      { resourceId: 'limestone', quantity: 12 },
      { resourceId: 'sulfur', quantity: 12 },
    ],
    outputs: [{ resourceId: 'fertilizerII', quantity: 72 }],
  },
  {
    id: 'mixer-ii-dirt-from-compost',
    name: 'Mixer II (Dirt from Compost)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'input',
    // Fertilizer takes Compost first. The remaining Compost is converted to
    // dumpable Dirt instead of accumulating, even after Dirt demand is met.
    balanceInputIds: ['compost'],
    sharedCapacity: {
      id: 'mixer-ii-dirt-from-compost',
      priority: 1,
    },
    allocation: 'surplus',
    allocationPriority: 20,
    inputs: [
      { resourceId: 'gravel', quantity: 48 },
      { resourceId: 'compost', quantity: 48 },
    ],
    outputs: [{ resourceId: 'dirt', quantity: 96 }],
  },
  {
    id: 'polymerization-plant-plastic-naphtha',
    name: 'Polymerization Plant (Plastic — Naphtha)',
    building: 'Polymerization Plant',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'naphtha', quantity: 12 },
      { resourceId: 'chlorine', quantity: 8 },
    ],
    outputs: [
      { resourceId: 'plastic', quantity: 36 },
      { resourceId: 'exhaust', quantity: 24 },
    ],
    balanceOutputIds: ['plastic'],
  },
  {
    id: 'polymerization-plant-plastic-ethanol',
    name: 'Polymerization Plant (Plastic — Ethanol)',
    building: 'Polymerization Plant',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'ethanol', quantity: 12 },
      { resourceId: 'chlorine', quantity: 8 },
    ],
    outputs: [
      { resourceId: 'plastic', quantity: 36 },
      { resourceId: 'exhaust', quantity: 24 },
    ],
    balanceOutputIds: ['plastic'],
  },

  // Medical Supplies. These are the complete single-recipe steps in v0.8.6;
  // Steel, Plastic, and Ethanol each have multiple production paths.
  {
    id: 'assembly-v-medical-supplies-i',
    name: 'Assembly V (Medical Supplies I)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'medicalEquipment', quantity: 48 },
      { resourceId: 'disinfectant', quantity: 48 },
    ],
    outputs: [{ resourceId: 'medicalSupplies', quantity: 96 }],
  },
  {
    id: 'assembly-v-medical-supplies-ii',
    name: 'Assembly V (Medical Supplies II)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'medicalSupplies', quantity: 96 },
      { resourceId: 'antibiotics', quantity: 48 },
    ],
    outputs: [{ resourceId: 'medicalSuppliesII', quantity: 96 }],
  },
  {
    id: 'assembly-v-medical-supplies-iii',
    name: 'Assembly V (Medical Supplies III)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'medicalSuppliesII', quantity: 96 },
      { resourceId: 'anesthetics', quantity: 48 },
      { resourceId: 'morphine', quantity: 48 },
    ],
    outputs: [{ resourceId: 'medicalSuppliesIII', quantity: 96 }],
  },
  {
    id: 'fermentation-tank-antibiotics',
    name: 'Fermentation Tank (Antibiotics)',
    building: 'Fermentation Tank',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['antibiotics'],
    inputs: [
      { resourceId: 'sugar', quantity: 4 },
      { resourceId: 'ammonia', quantity: 1 },
      { resourceId: 'oxygen', quantity: 8 },
    ],
    outputs: [
      { resourceId: 'antibiotics', quantity: 8 },
      { resourceId: 'carbonDioxide', quantity: 4 },
    ],
  },
  {
    id: 'chemical-plant-ii-anesthetics',
    name: 'Chemical Plant II (Anesthetics)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['anesthetics'],
    inputs: [
      { resourceId: 'ammonia', quantity: 6 },
      { resourceId: 'hydrogenFluoride', quantity: 12 },
      { resourceId: 'steel', quantity: 3 },
    ],
    outputs: [{ resourceId: 'anesthetics', quantity: 24 }],
  },
  {
    id: 'settling-tank-hydrogen-fluoride',
    name: 'Settling Tank (Hydrogen Fluoride)',
    building: 'Settling Tank',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    balanceOutputIds: ['hydrogenFluoride'],
    inputs: [
      { resourceId: 'rock', quantity: 12 },
      { resourceId: 'acid', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'hydrogenFluoride', quantity: 12 },
      { resourceId: 'slag', quantity: 3 },
    ],
  },
  {
    id: 'chemical-plant-ii-morphine',
    name: 'Chemical Plant II (Morphine)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'poppy', quantity: 12 },
      { resourceId: 'acid', quantity: 6 },
      { resourceId: 'glass', quantity: 6 },
    ],
    outputs: [{ resourceId: 'morphine', quantity: 24 }],
  },
  {
    id: 'assembly-v-medical-equipment',
    name: 'Assembly V (Medical Equipment)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'steel', quantity: 24 },
      { resourceId: 'plastic', quantity: 24 },
    ],
    outputs: [{ resourceId: 'medicalEquipment', quantity: 24 }],
  },
  {
    id: 'chemical-plant-ii-disinfectant',
    name: 'Chemical Plant II (Disinfectant)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'ethanol', quantity: 9 },
      { resourceId: 'plastic', quantity: 6 },
    ],
    outputs: [{ resourceId: 'disinfectant', quantity: 24 }],
  },

  // Population wastewater support. The selected Filter Media path uses
  // Manufactured Sand; Chlorine comes from Brine electrolysis.
  {
    id: 'mixer-ii-filter-media-manufactured-sand',
    name: 'Mixer II (Filter Media)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'gravel', quantity: 48 },
      { resourceId: 'manufacturedSand', quantity: 24 },
      { resourceId: 'coal', quantity: 6 },
    ],
    outputs: [{ resourceId: 'filterMedia', quantity: 72 }],
  },
  {
    id: 'crusher-large-rock-to-gravel',
    name: 'Rock → Gravel',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [{ resourceId: 'rock', quantity: 144 }],
    outputs: [{ resourceId: 'gravel', quantity: 144 }],
  },
  {
    id: 'crusher-large-gravel-to-manufactured-sand',
    name: 'Gravel → Manufactured Sand',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    inputs: [{ resourceId: 'gravel', quantity: 48 }],
    outputs: [{ resourceId: 'manufacturedSand', quantity: 48 }],
  },
  {
    id: 'crusher-large-quartz',
    name: 'Crusher (Large) — Quartz',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [{ resourceId: 'quartz', quantity: 288 }],
    outputs: [{ resourceId: 'quartzCrushed', quantity: 288 }],
  },
  {
    id: 'crusher-large-quartz-crushed',
    name: 'Crusher (Large) — Quartz Crushed',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    inputs: [{ resourceId: 'quartzCrushed', quantity: 96 }],
    outputs: [{ resourceId: 'sand', quantity: 96 }],
  },
  {
    id: 'coal-maker-wood',
    name: 'Coal Maker (Wood)',
    building: 'Coal Maker',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    inputs: [{ resourceId: 'wood', quantity: 18 }],
    outputs: [
      { resourceId: 'coal', quantity: 7.5 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
    balanceOutputIds: ['coal'],
  },
  {
    id: 'wastewater-treatment-toxic-slurry',
    // Captain of Industry v0.8.6 game-data rate, normalized to 60 seconds.
    name: 'Wastewater Treatment (Toxic Slurry)',
    building: 'Wastewater Treatment',
    group: 'waste',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['toxicSlurry', 'brine'],
    inputPriorities: { brine: 1 },
    inputs: [
      { resourceId: 'toxicSlurry', quantity: 108 },
      { resourceId: 'filterMedia', quantity: 6 },
      { resourceId: 'brine', quantity: 18 },
    ],
    outputs: [
      { resourceId: 'water', quantity: 36 },
      { resourceId: 'slag', quantity: 60 },
    ],
  },
  {
    // Captain of Industry v0.8.6c process-steam cluster, normalized to 60 seconds.
    id: 'shredder-woodchips',
    name: 'Shredder (Woodchips)',
    building: 'Shredder',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    balanceOutputIds: ['woodchips'],
    inputs: [{ resourceId: 'wood', quantity: 24 }],
    outputs: [{ resourceId: 'woodchips', quantity: 24 }],
  },
  {
    id: 'chemical-plant-ii-paper',
    name: 'Chemical Plant II (Paper)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['paper'],
    inputs: [
      { resourceId: 'woodchips', quantity: 12 },
      { resourceId: 'limestone', quantity: 3 },
      { resourceId: 'steamHigh', quantity: 3 },
    ],
    outputs: [{ resourceId: 'paper', quantity: 24 }],
  },
  {
    id: 'sour-water-stripper',
    name: 'Sour Water Stripper',
    building: 'Sour Water Stripper',
    group: 'waste',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['sourWater'],
    // Graphite's coal route is allocated in the fallback pass and creates the
    // Sour Water this line consumes, so defer stripping to the same phase.
    sharedCapacity: {
      id: 'sour-water-stripper',
      priority: 1,
    },
    allocation: 'fallback',
    allocationPriority: 40,
    inputs: [
      { resourceId: 'sourWater', quantity: 36 },
      { resourceId: 'steamHigh', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'sulfur', quantity: 9 },
      { resourceId: 'ammonia', quantity: 9 },
      { resourceId: 'water', quantity: 21 },
    ],
  },
  {
    // Captain of Industry v0.8.7 game-data rate. Primary food production has
    // already consumed its Meat Trimmings before this fallback runs. Keep it
    // immediately before Compost -> Dirt so both byproducts can continue into
    // their lower-priority routes.
    id: 'anaerobic-digester-meat-trimmings',
    name: 'Anaerobic Digester (Meat Trimmings)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['meatTrimmings'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 1,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'meatTrimmings', quantity: 8 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 4 },
      { resourceId: 'compost', quantity: 2 },
    ],
  },
  {
    // Captain of Industry v0.8.7 game-data rate. These digestion recipes share
    // the same two physical buildings and consume only farm surplus.
    id: 'anaerobic-digester-sugar-cane',
    name: 'Anaerobic Digester (Sugar Cane)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['sugarCane'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 2,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'sugarCane', quantity: 12 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 8 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-potato',
    name: 'Anaerobic Digester (Potato)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['potato'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 3,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'potato', quantity: 14 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 8 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-wheat',
    name: 'Anaerobic Digester (Wheat)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['wheat'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 4,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'wheat', quantity: 12 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 12 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-corn',
    name: 'Anaerobic Digester (Corn)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['corn'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 5,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'corn', quantity: 14 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 14 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-fruit',
    name: 'Anaerobic Digester (Fruit)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['fruit'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 6,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'fruit', quantity: 12 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 12 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-soybean',
    name: 'Anaerobic Digester (Soybean)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['soybean'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 7,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'soybean', quantity: 14 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 12 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-vegetables',
    name: 'Anaerobic Digester (Vegetables)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['vegetables'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 8,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'vegetables', quantity: 14 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 8 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    id: 'anaerobic-digester-poppy',
    name: 'Anaerobic Digester (Poppy)',
    building: 'Anaerobic Digester',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'input',
    balanceInputIds: ['poppy'],
    sharedCapacity: {
      id: 'anaerobic-digester-surplus-organics',
      label: 'Anaerobic Digester — Surplus organics',
      priority: 9,
    },
    allocation: 'fallback',
    allocationPriority: 15,
    inputs: [{ resourceId: 'poppy', quantity: 14 }],
    outputs: [
      { resourceId: 'fuelGas', quantity: 8 },
      { resourceId: 'compost', quantity: 1 },
    ],
  },
  {
    // Captain of Industry v0.8.6 game-data rate, normalized from 20 to 60 seconds.
    // This route intentionally consumes only Fuel Gas left after every modeled demand.
    id: 'cracking-unit-fuel-gas-diesel',
    name: 'Cracking Unit (Fuel Gas → Diesel)',
    building: 'Cracking Unit',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['fuelGas'],
    balanceOutputIds: ['diesel'],
    allocation: 'surplus',
    allocationPriority: 100,
    inputs: [
      { resourceId: 'fuelGas', quantity: 36 },
      { resourceId: 'oxygen', quantity: 18 },
    ],
    outputs: [
      { resourceId: 'diesel', quantity: 24 },
      { resourceId: 'water', quantity: 6 },
    ],
  },
  {
    id: 'incineration-plant-waste',
    name: 'Incineration Plant (Waste)',
    building: 'Incineration Plant',
    group: 'waste',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceInputIds: ['waste'],
    balanceOutputIds: ['steamHigh'],
    inputs: [
      { resourceId: 'waste', quantity: 144 },
      { resourceId: 'fuelGas', quantity: 6 },
      { resourceId: 'water', quantity: 18 },
    ],
    outputs: [
      { resourceId: 'exhaust', quantity: 72 },
      { resourceId: 'steamHigh', quantity: 18 },
    ],
  },
  {
    // Captain of Industry v0.8.7 aluminum and titanium chains, normalized to
    // one 60-second production cycle from the installed game assemblies.
    id: 'crusher-large-bauxite',
    name: 'Crusher (Large) — Bauxite',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    balanceOutputIds: ['bauxitePowder'],
    inputs: [{ resourceId: 'bauxite', quantity: 72 }],
    outputs: [{ resourceId: 'bauxitePowder', quantity: 72 }],
  },
  {
    id: 'chemical-plant-ii-bauxite-digestion',
    name: 'Chemical Plant II (Bauxite Digestion)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['hydratedAlumina'],
    inputs: [
      { resourceId: 'bauxitePowder', quantity: 72 },
      { resourceId: 'brine', quantity: 24 },
    ],
    outputs: [
      { resourceId: 'hydratedAlumina', quantity: 36 },
      { resourceId: 'redMud', quantity: 36 },
    ],
  },
  {
    id: 'settling-tank-red-mud-seawater',
    name: 'Settling Tank (Red Mud + Seawater)',
    building: 'Settling Tank',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'input',
    balanceInputIds: ['redMud'],
    allocation: 'surplus',
    allocationPriority: 10,
    sharedCapacity: { id: 'settling-tank-red-mud', priority: 1 },
    inputs: [
      { resourceId: 'redMud', quantity: 18 },
      { resourceId: 'seaWater', quantity: 8 },
      { resourceId: 'limestone', quantity: 2 },
    ],
    outputs: [{ resourceId: 'slag', quantity: 12 }],
  },
  {
    id: 'settling-tank-red-mud-acid',
    name: 'Settling Tank (Red Mud + Acid)',
    building: 'Settling Tank',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'input',
    balanceInputIds: ['redMud'],
    // Recover Crushed Iron Ore before the ordinary crusher backfills the
    // remaining furnace demand.
    allocation: 'fallback',
    allocationPriority: 10,
    sharedCapacity: { id: 'settling-tank-red-mud', priority: 2 },
    inputs: [
      { resourceId: 'redMud', quantity: 18 },
      { resourceId: 'acid', quantity: 12 },
      { resourceId: 'limestone', quantity: 2 },
    ],
    outputs: [
      { resourceId: 'slag', quantity: 8 },
      { resourceId: 'ironOreCrushed', quantity: 4 },
    ],
  },
  {
    id: 'liquid-dump-red-mud',
    name: 'Liquid Dump (Red Mud)',
    building: 'Liquid Dump',
    group: 'sink',
    sinkScope: 'module',
    cycleDurationSeconds: 3,
    balanceBy: 'input',
    balanceInputIds: ['redMud'],
    inputs: [{ resourceId: 'redMud', quantity: 200 }],
    outputs: [{ resourceId: 'pollutedWater', quantity: 200 }],
  },
  {
    id: 'rotary-kiln-alumina-fuel-gas',
    name: 'Rotary Kiln (Hydrated Alumina + Fuel Gas)',
    building: 'Rotary Kiln (gas)',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['alumina'],
    sharedCapacity: { id: 'rotary-kiln-alumina', priority: 1 },
    inputs: [
      { resourceId: 'hydratedAlumina', quantity: 36 },
      { resourceId: 'fuelGas', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'alumina', quantity: 24 },
      { resourceId: 'carbonDioxide', quantity: 6 },
    ],
  },
  {
    id: 'rotary-kiln-alumina-hydrogen',
    name: 'Rotary Kiln (Hydrated Alumina + Hydrogen)',
    building: 'Rotary Kiln (gas)',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['alumina'],
    sharedCapacity: { id: 'rotary-kiln-alumina', priority: 2 },
    inputs: [
      { resourceId: 'hydratedAlumina', quantity: 36 },
      { resourceId: 'hydrogen', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'alumina', quantity: 24 },
      { resourceId: 'steamDepleted', quantity: 12 },
    ],
  },
  {
    id: 'aluminum-cell-electrolysis',
    name: 'Aluminum Cell (Electrolysis)',
    building: 'Aluminum Cell',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    balanceOutputIds: ['moltenAluminum'],
    inputs: [
      { resourceId: 'alumina', quantity: 24 },
      { resourceId: 'graphite', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenAluminum', quantity: 24 },
      { resourceId: 'carbonDioxide', quantity: 18 },
    ],
  },
  {
    id: 'metal-caster-ii-aluminum',
    name: 'Metal Caster II (Aluminum)',
    building: 'Metal Caster II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['aluminum'],
    inputs: [{ resourceId: 'moltenAluminum', quantity: 24 }],
    outputs: [{ resourceId: 'aluminum', quantity: 24 }],
  },
  {
    id: 'arc-furnace-aluminum-scrap',
    name: 'Arc Furnace (Aluminum Scrap)',
    building: 'Arc Furnace',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['aluminumScrap'],
    inputs: [
      { resourceId: 'aluminumScrap', quantity: 24 },
      { resourceId: 'graphite', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'moltenAluminum', quantity: 24 },
      { resourceId: 'exhaust', quantity: 3 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: 'arc-furnace-ii-aluminum-scrap',
    name: 'Arc Furnace II (Aluminum Scrap)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['aluminumScrap'],
    inputs: [
      { resourceId: 'aluminumScrap', quantity: 48 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenAluminum', quantity: 48 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: 'crystallizer-alumina',
    name: 'Crystallizer (Sapphire Wafer)',
    building: 'Crystallizer',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['sapphireWafer'],
    inputs: [{ resourceId: 'alumina', quantity: 8 }],
    outputs: [{ resourceId: 'sapphireWafer', quantity: 8 }],
  },
  {
    id: 'compactor-aluminum-scrap',
    name: 'Compactor (Aluminum Scrap)',
    building: 'Compactor',
    group: 'production',
    cycleDurationSeconds: 5,
    balanceBy: 'input',
    balanceInputIds: ['aluminumScrap'],
    inputs: [{ resourceId: 'aluminumScrap', quantity: 72 }],
    outputs: [{ resourceId: 'aluminumScrapPressed', quantity: 24 }],
  },
  {
    id: 'shredder-aluminum-scrap',
    name: 'Shredder (Aluminum Scrap)',
    building: 'Shredder',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'input',
    balanceInputIds: ['aluminumScrapPressed'],
    inputs: [{ resourceId: 'aluminumScrapPressed', quantity: 24 }],
    outputs: [{ resourceId: 'aluminumScrap', quantity: 72 }],
  },
  {
    // Titanium chain follows Aluminum so Titanium Alloy can request its
    // upstream Molten Aluminum without activating unrelated sapphire/scrap paths.
    // Keep this chain before Brine electrolysis so reduction Chlorine is used
    // before the Electrolyzer II covers any remaining Chlorine demand.
    id: 'crusher-large-titanium',
    name: 'Crusher (Large) — Titanium Ore',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['titaniumOreCrushed'],
    inputs: [{ resourceId: 'titaniumOre', quantity: 96 }],
    outputs: [{ resourceId: 'titaniumOreCrushed', quantity: 96 }],
  },
  {
    id: 'arc-furnace-ii-titanium-ore',
    name: 'Arc Furnace II (Titanium Ore)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['titaniumSlag'],
    inputs: [
      { resourceId: 'titaniumOreCrushed', quantity: 48 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenIron', quantity: 12 },
      { resourceId: 'titaniumSlag', quantity: 36 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 36 },
    ],
  },
  {
    id: 'chemical-plant-ii-titanium-chlorination',
    name: 'Chemical Plant II (Titanium Chlorination)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['titaniumChloride'],
    inputs: [
      { resourceId: 'titaniumSlag', quantity: 36 },
      { resourceId: 'chlorine', quantity: 18 },
      { resourceId: 'graphite', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'titaniumChloride', quantity: 12 },
      { resourceId: 'slag', quantity: 12 },
      { resourceId: 'carbonDioxide', quantity: 12 },
    ],
    electricityMultiplier: 2,
  },
  {
    id: 'distillation-stage-iii-titanium-purification',
    name: 'Distillation Stage III (Titanium Purification)',
    building: 'Distillation (Stage III)',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['titaniumChloridePure'],
    inputs: [
      { resourceId: 'titaniumChloride', quantity: 12 },
      { resourceId: 'steamHigh', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'titaniumChloridePure', quantity: 12 },
      { resourceId: 'steamDepleted', quantity: 3 },
    ],
  },
  {
    id: 'chemical-plant-ii-titanium-reduction',
    name: 'Chemical Plant II (Titanium Chloride Reduction)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    // Chlorine is a byproduct and must never start Titanium production itself.
    balanceOutputIds: ['titaniumSponge'],
    inputs: [
      { resourceId: 'titaniumChloridePure', quantity: 24 },
      { resourceId: 'salt', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'titaniumSponge', quantity: 24 },
      { resourceId: 'chlorine', quantity: 12 },
    ],
    electricityMultiplier: 2,
  },
  {
    id: 'arc-furnace-ii-titanium-sponge',
    name: 'Arc Furnace II (Titanium Sponge)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenTitanium'],
    inputs: [
      { resourceId: 'titaniumSponge', quantity: 48 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenTitanium', quantity: 48 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
  },
  {
    id: 'alloy-mixer-titanium',
    name: 'Alloy Mixer (Titanium Alloy)',
    building: 'Alloy Mixer',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenTitaniumAlloy'],
    inputs: [
      { resourceId: 'moltenTitanium', quantity: 96 },
      { resourceId: 'moltenAluminum', quantity: 12 },
    ],
    outputs: [{ resourceId: 'moltenTitaniumAlloy', quantity: 108 }],
  },
  {
    id: 'cooled-caster-ii-titanium-alloy',
    name: 'Cooled Caster II (Titanium Alloy)',
    building: 'Cooled Caster II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['titaniumAlloy'],
    inputs: [
      { resourceId: 'moltenTitaniumAlloy', quantity: 24 },
      { resourceId: 'water', quantity: 12 },
    ],
    outputs: [{ resourceId: 'titaniumAlloy', quantity: 24 }],
  },
  {
    id: 'electrolyzer-ii-chlorine',
    name: 'Electrolyzer II (Chlorine)',
    building: 'Electrolyzer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    balanceInputIds: ['brine'],
    balanceOutputIds: ['chlorine'],
    inputPriorities: { brine: 2 },
    inputs: [{ resourceId: 'brine', quantity: 72 }],
    outputs: [{ resourceId: 'chlorine', quantity: 48 }],
  },
  {
    id: 'evaporation-pond-heated-salt-brine',
    // Captain of Industry v0.8.7 heated-pond rate, normalized to 60 seconds.
    name: 'Evaporation Pond (Brine → Salt)',
    building: 'Evaporation Pond (Heated)',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceInputIds: ['brine'],
    balanceOutputIds: ['salt'],
    inputPriorities: { brine: 3 },
    inputs: [{ resourceId: 'brine', quantity: 96 }],
    outputs: [{ resourceId: 'salt', quantity: 12 }],
  },
  {
    id: 'general-evaporation-pond-heated-brine-surplus',
    name: 'Evaporation Pond (Brine → Salt — priority)',
    building: 'Evaporation Pond (Heated)',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [{ resourceId: 'brine', quantity: 96 }],
    outputs: [{ resourceId: 'salt', quantity: 12 }],
  },

  // Fixed crop rotations and livestock
  ...cropFarmRecipes,
  {
    id: 'chicken-farm-slaughtering',
    displayName: 'Slaughtering enabled',
    name: 'Chicken Farm (Slaughtering on)',
    building: 'Chicken Farm',
    group: 'production',
    inputs: [
      {
        resourceId: 'animalFeed',
        quantity: chickenFarm.capacity * chickenFarm.feedPerChicken,
      },
      {
        resourceId: 'water',
        quantity: chickenFarm.capacity * chickenFarm.waterPerChicken,
      },
    ],
    outputs: [
      {
        resourceId: 'eggs',
        quantity: chickenFarm.capacity * chickenFarm.eggsPerChicken,
      },
      {
        resourceId: 'chickenCarcass',
        quantity:
          ((chickenFarm.capacity * chickenFarm.birthsPer100Chickens) / 100) *
          chickenFarm.carcassPerSlaughteredChicken,
      },
    ],
    animalPopulationCapacity: chickenFarm.capacity,
    animalPopulationStep: chickenFarm.countStep,
    animalPopulationLabel: 'chickens',
  },
  {
    id: 'chicken-farm-eggs-only',
    displayName: 'Eggs only',
    name: 'Chicken Farm (Slaughtering off)',
    building: 'Chicken Farm',
    group: 'production',
    inputs: [
      {
        resourceId: 'animalFeed',
        quantity: chickenFarm.capacity * chickenFarm.feedPerChicken,
      },
      {
        resourceId: 'water',
        quantity: chickenFarm.capacity * chickenFarm.waterPerChicken,
      },
    ],
    outputs: [
      {
        resourceId: 'eggs',
        quantity: chickenFarm.capacity * chickenFarm.eggsPerChicken,
      },
    ],
    animalPopulationCapacity: chickenFarm.capacity,
    animalPopulationStep: chickenFarm.countStep,
    animalPopulationLabel: 'chickens',
  },
  {
    id: 'food-processor-meat',
    // Captain of Industry v0.8.7 game-data rate, normalized to 60 seconds.
    name: 'Food Processor (Chicken Carcass → Meat + Trimmings)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['meat'],
    inputs: [
      { resourceId: 'chickenCarcass', quantity: 30 },
      { resourceId: 'water', quantity: 9 },
      { resourceId: 'salt', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'meat', quantity: 15 },
      { resourceId: 'meatTrimmings', quantity: 6 },
    ],
  },
  {
    id: 'food-processor-meat-trimmings',
    // Captain of Industry v0.8.7 game-data rate, normalized to 60 seconds.
    name: 'Food Processor (Surplus Chicken Carcass → Trimmings)',
    building: 'Food Processor',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['chickenCarcass'],
    // The dedicated Meat processor runs first. This separate fallback building
    // then consumes every remaining carcass; downstream fallbacks route excess
    // Trimmings to Fuel Gas and excess Fuel Gas to Diesel.
    allocation: 'fallback',
    allocationPriority: 10,
    inputs: [{ resourceId: 'chickenCarcass', quantity: 30 }],
    outputs: [{ resourceId: 'meatTrimmings', quantity: 27 }],
  },

  // Nuclear fuel cycle
  {
    id: 'chemical-plant-uranium',
    name: 'Chemical Plant (Uranium → Core Fuel)',
    building: 'Chemical Plant II',
    group: 'production',
    inputs: [
      { resourceId: 'enrichedUranium20', quantity: 2 },
      { resourceId: 'salt', quantity: 4 },
    ],
    outputs: [{ resourceId: 'coreFuel', quantity: 4 }],
  },
  {
    id: 'chemical-plant-plutonium',
    name: 'Chemical Plant (Plutonium → Core Fuel)',
    building: 'Chemical Plant II',
    group: 'production',
    inputs: [
      { resourceId: 'plutonium', quantity: 1 },
      { resourceId: 'salt', quantity: 4 },
    ],
    outputs: [{ resourceId: 'coreFuel', quantity: 4 }],
  },
  {
    id: 'nuclear-reprocessing',
    name: 'Nuclear Reprocessing (Core Fuel Spent)',
    building: 'Nuclear Reprocessing Plant',
    group: 'production',
    inputs: [
      { resourceId: 'coreFuelSpent', quantity: 16 },
      { resourceId: 'acid', quantity: 2 },
      { resourceId: 'moltenGlass', quantity: 2 },
      { resourceId: 'steel', quantity: 1 },
    ],
    outputs: [
      { resourceId: 'coreFuel', quantity: 12 },
      { resourceId: 'fissionProduct', quantity: 2 },
    ],
  },
  {
    id: 'enrichment-plant',
    name: 'Enrichment Plant (Core Fuel)',
    building: 'Enrichment Plant',
    group: 'production',
    inputs: [{ resourceId: 'blanketFuelEnriched', quantity: 8 }],
    outputs: [
      { resourceId: 'blanketFuel', quantity: 6 },
      { resourceId: 'coreFuel', quantity: 2 },
    ],
  },
  {
    id: 'enrichment-plant-plutonium',
    name: 'Enrichment Plant (Plutonium)',
    building: 'Enrichment Plant',
    group: 'production',
    inputs: [{ resourceId: 'blanketFuelEnriched', quantity: 16 }],
    outputs: [
      { resourceId: 'blanketFuel', quantity: 12 },
      { resourceId: 'plutonium', quantity: 1 },
    ],
  },
  {
    id: 'enrichment-plant-uranium',
    name: 'Enrichment Plant (Enriched Uranium)',
    building: 'Enrichment Plant',
    group: 'production',
    inputs: [{ resourceId: 'blanketFuelEnriched', quantity: 16 }],
    outputs: [
      { resourceId: 'blanketFuel', quantity: 12 },
      { resourceId: 'enrichedUranium20', quantity: 2 },
    ],
  },
  {
    id: 'chemical-plant-enrichment',
    name: 'Chemical Plant (Plutonium → Enriched Uranium 20%)',
    building: 'Chemical Plant',
    group: 'production',
    inputs: [
      { resourceId: 'plutonium', quantity: 3 },
      { resourceId: 'enrichedUranium4', quantity: 3 },
    ],
    outputs: [{ resourceId: 'enrichedUranium20', quantity: 3 }],
  },
  {
    id: 'assembly-v-compact-reactor',
    name: 'Assembly V (Compact Reactor)',
    building: 'Assembly V',
    group: 'production',
    inputs: [
      { resourceId: 'titaniumAlloy', quantity: 12 },
      { resourceId: 'electronicsIv', quantity: 6 },
      { resourceId: 'enrichedUranium20', quantity: 2 },
    ],
    outputs: [{ resourceId: 'compactReactor', quantity: 4 }],
  },

  // Lab Equipment chain on Assembly V, normalized to 60 seconds from v0.8.6c.
  {
    id: 'research-lab-iv',
    name: 'Research Lab IV',
    building: 'Research Lab IV',
    group: 'production',
    inputs: [{ resourceId: 'labEquipmentIv', quantity: 48 }],
    outputs: [{ resourceId: 'recyclables', quantity: 48 }],
  },
  {
    id: 'research-lab-iv-space',
    name: 'Research Lab IV (Space Research)',
    building: 'Research Lab IV',
    group: 'production',
    inputs: [
      { resourceId: 'labEquipmentIv', quantity: 48 },
      { resourceId: 'spaceResearchPoints', quantity: 48 },
    ],
    outputs: [{ resourceId: 'recyclables', quantity: 48 }],
  },
  {
    // Installed v0.8.7 Assembly V binding: 3 Paper + 2 Household Goods
    // + 1 Electronics II -> 6 Office Supplies every 7.5 seconds.
    id: 'assembly-v-office-supplies',
    name: 'Assembly V (Office Supplies)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    balanceOutputIds: ['officeSupplies'],
    inputs: [
      { resourceId: 'paper', quantity: 24 },
      { resourceId: 'householdGoods', quantity: 16 },
      { resourceId: 'electronicsII', quantity: 8 },
    ],
    outputs: [{ resourceId: 'officeSupplies', quantity: 48 }],
  },
  ...officeCatalog.flatMap(office =>
    ([0, 1, 2] as const satisfies readonly OfficeBoostStep[]).map(
      (boostStep): Recipe => ({
        id: getOfficeRecipeId(office.id, boostStep),
        name: `${office.name} (Computing boost ${boostStep})`,
        building: office.name,
        group: 'production',
        cycleDurationSeconds: 60,
        balanceBy: 'input',
        inputs: [
          {
            resourceId: 'officeSupplies',
            quantity: office.officeSuppliesPerCycle,
          },
        ],
        outputs: [
          {
            resourceId: 'recyclables',
            quantity: office.recyclablesPerCycle,
          },
        ],
        computingMultiplier: boostStep ** 2,
      }),
    ),
  ),
  {
    // Installed v0.8.7 Assembly V binding: 8 Composite Panels + 4 Titanium
    // Alloy + 1 Electronics III -> 4 Composite Cores every 30 seconds.
    id: 'assembly-v-composite-core',
    name: 'Assembly V (Composite Core)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['compositeCore'],
    inputs: [
      { resourceId: 'compositePanel', quantity: 16 },
      { resourceId: 'titaniumAlloy', quantity: 8 },
      { resourceId: 'electronicsIII', quantity: 2 },
    ],
    outputs: [{ resourceId: 'compositeCore', quantity: 8 }],
  },
  {
    // Installed v0.8.7 Chemical Plant II binding: 6 Ammonia + 6 Fuel Gas
    // + 4 Aluminum -> 4 Chemical Fuel every 30 seconds.
    id: 'chemical-plant-ii-chemical-fuel',
    name: 'Chemical Plant II (Chemical Fuel)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['chemicalFuel'],
    inputs: [
      { resourceId: 'ammonia', quantity: 12 },
      { resourceId: 'fuelGas', quantity: 12 },
      { resourceId: 'aluminum', quantity: 8 },
    ],
    outputs: [{ resourceId: 'chemicalFuel', quantity: 8 }],
  },
  {
    // Installed v0.8.7 Assembly V binding: 4 Composite Cores + 2 Mono
    // Solar Cells + 1 Chemical Fuel -> 2 Station Parts every 15 seconds.
    id: 'assembly-v-station-parts',
    name: 'Assembly V (Station Parts)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    balanceOutputIds: ['stationParts'],
    inputs: [
      { resourceId: 'compositeCore', quantity: 16 },
      { resourceId: 'solarCellMono', quantity: 8 },
      { resourceId: 'chemicalFuel', quantity: 4 },
    ],
    outputs: [{ resourceId: 'stationParts', quantity: 8 }],
  },
  {
    // Installed v0.8.7 Assembly V binding: 2 Food Packs + 1 Medical
    // Supplies II + 1 Plastic -> 4 Crew Supplies every 15 seconds.
    id: 'assembly-v-crew-supplies',
    name: 'Assembly V (Crew Supplies)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    balanceOutputIds: ['crewSupplies'],
    inputs: [
      { resourceId: 'foodPack', quantity: 8 },
      { resourceId: 'medicalSuppliesII', quantity: 4 },
      { resourceId: 'plastic', quantity: 4 },
    ],
    outputs: [{ resourceId: 'crewSupplies', quantity: 16 }],
  },
  {
    id: 'space-station-operations',
    name: 'Space Station IV Operations',
    building: 'Space Station IV',
    displayGroup: { id: 'space-station', label: 'Space Station IV' },
    group: 'production',
    inputs: [
      {
        resourceId: 'stationParts',
        quantity: defaultSpaceStationLevel.maintenancePartsPerCycle,
      },
      {
        resourceId: 'crewSupplies',
        quantity: defaultSpaceStationLevel.crewSuppliesPerCycle,
      },
    ],
    outputs: [],
  },
  {
    id: 'space-station-orbital-research',
    displayName: 'Orbital Research',
    name: 'Space Station IV Orbital Research',
    building: 'Space Station Orbital Research',
    displayGroup: { id: 'space-station', label: 'Space Station IV' },
    group: 'production',
    tracksPhysicalCapacity: false,
    balanceBy: 'output',
    balanceOutputIds: ['spaceResearchPoints'],
    inputs: [
      {
        resourceId: 'electronicsIv',
        quantity: defaultSpaceStationLevel.researchSuppliesPerCycle,
      },
    ],
    outputs: [
      {
        resourceId: 'spaceResearchPoints',
        quantity: defaultSpaceStationLevel.spaceResearchPointsPerCycle,
      },
    ],
  },
  {
    // Installed v0.8.7 Assembly V recipe, normalized from its 15-second cycle.
    id: 'assembly-v-composite-panel',
    name: 'Assembly V (Composite Panel)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    balanceOutputIds: ['compositePanel'],
    inputs: [
      { resourceId: 'aluminum', quantity: 32 },
      { resourceId: 'steel', quantity: 4 },
      { resourceId: 'plastic', quantity: 8 },
    ],
    outputs: [{ resourceId: 'compositePanel', quantity: 32 }],
  },
  {
    // Rocket II is destroyed after every launch. Its six-cycle build is kept as
    // a real demand-balanced production line; only launch frequency is averaged.
    id: 'rocket-ii-assembly',
    name: 'Rocket Assembly Depot (Rocket II)',
    building: 'Rocket Assembly Depot',
    group: 'production',
    cycleDurationSeconds: 360,
    balanceBy: 'output',
    balanceOutputIds: ['rocketII'],
    inputs: [
      {
        resourceId: 'compositePanel',
        quantity: rocketIiGameData.buildCosts.compositePanel / rocketIiGameData.buildCycles,
      },
      {
        resourceId: 'titaniumAlloy',
        quantity: rocketIiGameData.buildCosts.titaniumAlloy / rocketIiGameData.buildCycles,
      },
      {
        resourceId: 'steel',
        quantity: rocketIiGameData.buildCosts.steel / rocketIiGameData.buildCycles,
      },
      {
        resourceId: 'electronicsIII',
        quantity: rocketIiGameData.buildCosts.electronicsIii / rocketIiGameData.buildCycles,
      },
    ],
    outputs: [{ resourceId: 'rocketII', quantity: 1 / rocketIiGameData.buildCycles }],
  },
  {
    id: 'rocket-ii-launch-amortized',
    name: 'Rocket Launch Pad (Rocket II average)',
    building: 'Rocket Launch Pad',
    group: 'production',
    inputs: [
      {
        resourceId: 'rocketII',
        quantity: defaultRocketIiRecurringLogistics.launchesPerCycle,
        inputModifierId: 'rocketLaunches',
      },
      {
        resourceId: 'water',
        quantity: defaultRocketIiRecurringLogistics.waterPerCycle,
        inputModifierId: 'rocketLaunches',
      },
      {
        resourceId: 'hydrogen',
        quantity: defaultRocketIiRecurringLogistics.hydrogenPerCycle,
        inputModifierId: 'rocketLaunches',
      },
      {
        resourceId: 'oxygen',
        quantity: defaultRocketIiRecurringLogistics.oxygenPerCycle,
        inputModifierId: 'rocketLaunches',
      },
    ],
    outputs: [],
  },
  {
    id: 'assembly-v-lab-equipment-i',
    name: 'Assembly V (Lab Equipment I)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    balanceOutputIds: ['labEquipmentI'],
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 64 },
      { resourceId: 'electronicsI', quantity: 32 },
    ],
    outputs: [{ resourceId: 'labEquipmentI', quantity: 96 }],
  },
  {
    id: 'assembly-v-lab-equipment-ii',
    name: 'Assembly V (Lab Equipment II)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    balanceOutputIds: ['labEquipmentII'],
    inputs: [
      { resourceId: 'labEquipmentI', quantity: 48 },
      { resourceId: 'paper', quantity: 16 },
      { resourceId: 'glass', quantity: 16 },
    ],
    outputs: [{ resourceId: 'labEquipmentII', quantity: 48 }],
  },
  {
    id: 'assembly-v-lab-equipment-iii',
    name: 'Assembly V (Lab Equipment III)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    balanceOutputIds: ['labEquipmentIII'],
    inputs: [
      { resourceId: 'labEquipmentII', quantity: 48 },
      { resourceId: 'electronicsII', quantity: 8 },
    ],
    outputs: [{ resourceId: 'labEquipmentIII', quantity: 48 }],
  },
  {
    id: 'assembly-v-lab-equipment-iv',
    name: 'Assembly V (Lab Equipment IV)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    balanceOutputIds: ['labEquipmentIv'],
    inputs: [
      { resourceId: 'labEquipmentIII', quantity: 32 },
      { resourceId: 'electronicsIII', quantity: 4 },
    ],
    outputs: [{ resourceId: 'labEquipmentIv', quantity: 32 }],
  },

  // Electronics chains
  {
    id: 'assembly-v-electronics-i',
    name: 'Assembly V (Electronics I)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'rubber', quantity: 16 },
      { resourceId: 'copper', quantity: 96 },
    ],
    outputs: [{ resourceId: 'electronicsI', quantity: 96 }],
  },
  {
    id: 'assembly-v-electronics-ii',
    name: 'Assembly V (Electronics II)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'pcb', quantity: 24 },
      { resourceId: 'electronicsI', quantity: 48 },
      { resourceId: 'polySilicon', quantity: 12 },
    ],
    outputs: [{ resourceId: 'electronicsII', quantity: 24 }],
  },
  {
    id: 'assembly-v-pcb',
    name: 'Assembly V (PCB)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'glass', quantity: 12 },
      { resourceId: 'plastic', quantity: 24 },
      { resourceId: 'copper', quantity: 12 },
    ],
    outputs: [{ resourceId: 'pcb', quantity: 48 }],
  },
  {
    id: 'assembly-v-food-pack-eggs',
    name: 'Assembly V (Eggs + Bread)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    balanceInputIds: ['eggs'],
    balanceOutputIds: ['foodPack'],
    demandPriority: -1,
    sharedCapacity: {
      id: 'assembly-v-food-pack',
      label: 'Assembly V — Food Pack',
      priority: 1,
    },
    inputs: [
      { resourceId: 'eggs', quantity: 24 },
      { resourceId: 'bread', quantity: 48 },
    ],
    outputs: [{ resourceId: 'foodPack', quantity: 32 }],
  },
  {
    id: 'assembly-v-food-pack-meat',
    name: 'Assembly V (Meat + Bread)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    // Meat is demand-produced by the carcass processor. Let this recipe create
    // that upstream demand after the higher-priority Eggs recipe takes its share.
    balanceInputIds: [],
    balanceOutputIds: ['foodPack'],
    sharedCapacity: {
      id: 'assembly-v-food-pack',
      label: 'Assembly V — Food Pack',
      priority: 2,
    },
    inputs: [
      { resourceId: 'meat', quantity: 24 },
      { resourceId: 'bread', quantity: 48 },
    ],
    outputs: [{ resourceId: 'foodPack', quantity: 32 }],
  },
  {
    id: 'arc-furnace-ii-silicon',
    name: 'Arc Furnace II (Molten Silicon)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenSilicon'],
    inputs: [
      { resourceId: 'sand', quantity: 60 },
      { resourceId: 'coal', quantity: 12 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenSilicon', quantity: 48 },
      { resourceId: 'slag', quantity: 24 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 36 },
    ],
  },
  {
    id: 'silicon-reactor-poly-silicon',
    name: 'Silicon Reactor (Poly Silicon)',
    building: 'Silicon Reactor',
    group: 'production',
    cycleDurationSeconds: 15,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'moltenSilicon', quantity: 12 },
      { resourceId: 'hydrogen', quantity: 4 },
    ],
    outputs: [{ resourceId: 'polySilicon', quantity: 12 }],
  },
  {
    id: 'assembly-v-solar-cell-mono',
    name: 'Assembly V (Solar Cell Mono)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'steel', quantity: 1.5 },
      { resourceId: 'polySilicon', quantity: 18 },
      { resourceId: 'glass', quantity: 6 },
    ],
    outputs: [{ resourceId: 'solarCellMono', quantity: 12 }],
  },
  {
    id: 'crystallizer-silicon-wafer',
    name: 'Crystallizer (Silicon Wafer)',
    building: 'Crystallizer',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'polySilicon', quantity: 24 },
      { resourceId: 'water', quantity: 4 },
    ],
    outputs: [{ resourceId: 'siliconWafer', quantity: 12 }],
  },
  {
    id: 'microchip-machine-ii-1a',
    name: 'Microchip Machine II (1A: Acid + water)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-a',
      label: 'Microchip Machine II — Stage A',
      priority: 1,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: 'siliconWafer', quantity: 18 },
      { resourceId: 'acid', quantity: 6 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage1A', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-1b',
    name: 'Microchip Machine II (1B: Copper + plastic)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-b',
      label: 'Microchip Machine II — Stage B',
      priority: 1,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: 'microchipStage1A', quantity: 18 },
      { resourceId: 'copper', quantity: 6 },
      { resourceId: 'plastic', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage1B', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-1c',
    name: 'Microchip Machine II (1C: Gold)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-c',
      label: 'Microchip Machine II — Stage C',
      priority: 1,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: 'microchipStage1B', quantity: 18 },
      { resourceId: 'gold', quantity: 3 },
    ],
    outputs: [{ resourceId: 'microchipStage1C', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-2a',
    name: 'Microchip Machine II (2A: Acid + water)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-a',
      label: 'Microchip Machine II — Stage A',
      priority: 2,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: 'microchipStage1C', quantity: 18 },
      { resourceId: 'acid', quantity: 6 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage2A', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-2b',
    name: 'Microchip Machine II (2B: Copper + plastic)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-b',
      label: 'Microchip Machine II — Stage B',
      priority: 2,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: 'microchipStage2A', quantity: 18 },
      { resourceId: 'copper', quantity: 6 },
      { resourceId: 'plastic', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage2B', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-2c',
    name: 'Microchip Machine II (2C: Gold)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-c',
      label: 'Microchip Machine II — Stage C',
      priority: 2,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: 'microchipStage2B', quantity: 18 },
      { resourceId: 'gold', quantity: 3 },
    ],
    outputs: [{ resourceId: 'microchipStage2C', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-3a',
    name: 'Microchip Machine II (3A: Acid + water)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-a',
      label: 'Microchip Machine II — Stage A',
      priority: 3,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: 'microchipStage2C', quantity: 18 },
      { resourceId: 'acid', quantity: 6 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage3A', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-3b',
    name: 'Microchip Machine II (3B: Copper + plastic)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-b',
      label: 'Microchip Machine II — Stage B',
      priority: 3,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: 'microchipStage3A', quantity: 18 },
      { resourceId: 'copper', quantity: 6 },
      { resourceId: 'plastic', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage3B', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-3c',
    name: 'Microchip Machine II (3C: Gold)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-c',
      label: 'Microchip Machine II — Stage C',
      priority: 3,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: 'microchipStage3B', quantity: 18 },
      { resourceId: 'gold', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage3C', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-4a',
    name: 'Microchip Machine II (4A: Acid + water)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-a',
      label: 'Microchip Machine II — Stage A',
      priority: 4,
      displayOrder: 100,
    },
    inputs: [
      { resourceId: 'microchipStage3C', quantity: 18 },
      { resourceId: 'acid', quantity: 6 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage4A', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-4b',
    name: 'Microchip Machine II (4B: Copper + plastic)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-b',
      label: 'Microchip Machine II — Stage B',
      priority: 4,
      displayOrder: 101,
    },
    inputs: [
      { resourceId: 'microchipStage4A', quantity: 18 },
      { resourceId: 'copper', quantity: 6 },
      { resourceId: 'plastic', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchipStage4B', quantity: 18 }],
  },
  {
    id: 'microchip-machine-ii-final',
    name: 'Microchip Machine II (4C: Microchips)',
    building: 'Microchip Machine II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: {
      id: 'microchip-machine-ii-c',
      label: 'Microchip Machine II — Stage C',
      priority: 4,
      displayOrder: 102,
    },
    inputs: [
      { resourceId: 'microchipStage4B', quantity: 18 },
      { resourceId: 'gold', quantity: 6 },
    ],
    outputs: [{ resourceId: 'microchips', quantity: 36 }],
  },
  {
    id: 'assembly-v-electronics-iii',
    name: 'Assembly V (Electronics III)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'microchips', quantity: 6 },
      { resourceId: 'electronicsII', quantity: 12 },
    ],
    outputs: [{ resourceId: 'electronicsIII', quantity: 6 }],
  },
  {
    // Captain of Industry v0.8.7 Electronics IV branch, normalized to one
    // 60-second production cycle from the installed game assemblies.
    id: 'diamond-reactor-synthesis',
    name: 'Diamond Reactor (Synthetic Diamond)',
    building: 'Diamond Reactor',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: ['diamond'],
    inputs: [
      { resourceId: 'graphite', quantity: 2 },
      { resourceId: 'salt', quantity: 2 },
    ],
    outputs: [{ resourceId: 'diamond', quantity: 2 }],
  },
  {
    id: 'chemical-plant-ii-diamond-paste-cooking-oil',
    name: 'Chemical Plant II (Diamond Paste — Cooking Oil)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['diamondPaste'],
    sharedCapacity: { id: 'chemical-plant-ii-diamond-paste', priority: 1 },
    inputs: [
      { resourceId: 'diamond', quantity: 4 },
      { resourceId: 'cookingOil', quantity: 4 },
    ],
    outputs: [{ resourceId: 'diamondPaste', quantity: 16 }],
  },
  {
    id: 'chemical-plant-ii-diamond-paste-heavy-oil',
    name: 'Chemical Plant II (Diamond Paste — Heavy Oil)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['diamondPaste'],
    sharedCapacity: { id: 'chemical-plant-ii-diamond-paste', priority: 2 },
    inputs: [
      { resourceId: 'diamond', quantity: 4 },
      { resourceId: 'heavyOil', quantity: 2 },
    ],
    outputs: [{ resourceId: 'diamondPaste', quantity: 16 }],
  },
  {
    id: 'lens-polisher',
    name: 'Lens Polisher',
    building: 'Lens Polisher',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['lens'],
    inputs: [
      { resourceId: 'sapphireWafer', quantity: 2 },
      { resourceId: 'diamondPaste', quantity: 2 },
      { resourceId: 'ethanol', quantity: 2 },
    ],
    outputs: [{ resourceId: 'lens', quantity: 2 }],
  },
  {
    id: 'assembly-v-electronics-iv',
    name: 'Assembly V (Electronics IV)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    balanceOutputIds: ['electronicsIv'],
    inputs: [
      { resourceId: 'electronicsIII', quantity: 6 },
      { resourceId: 'lens', quantity: 4 },
      { resourceId: 'diamond', quantity: 2 },
    ],
    outputs: [{ resourceId: 'electronicsIv', quantity: 6 }],
  },
  {
    id: 'rubber-maker-naphtha',
    name: 'Rubber Maker I (Naphtha)',
    building: 'Rubber Maker I',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: { id: 'rubber-maker-i', priority: 1 },
    inputs: [
      { resourceId: 'naphtha', quantity: 12 },
      { resourceId: 'sulfur', quantity: 3 },
    ],
    outputs: [{ resourceId: 'rubber', quantity: 24 }],
  },
  {
    id: 'rubber-maker-ethanol',
    name: 'Rubber Maker I (Ethanol)',
    building: 'Rubber Maker I',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    sharedCapacity: { id: 'rubber-maker-i', priority: 2 },
    inputs: [
      { resourceId: 'ethanol', quantity: 12 },
      { resourceId: 'sulfur', quantity: 3 },
    ],
    outputs: [{ resourceId: 'rubber', quantity: 24 }],
  },
  {
    id: 'chemical-plant-ii-ethanol',
    name: 'Chemical Plant II (Ethanol)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['ethanol'],
    inputs: [
      { resourceId: 'hydrogen', quantity: 36 },
      { resourceId: 'carbonDioxide', quantity: 27 },
    ],
    outputs: [
      { resourceId: 'ethanol', quantity: 18 },
      { resourceId: 'water', quantity: 9 },
    ],
  },
  {
    id: 'chemical-plant-ii-graphite',
    name: 'Chemical Plant II (Graphite from CO2)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'input',
    balanceInputIds: ['carbonDioxide'],
    allocation: 'fallback',
    allocationPriority: 20,
    inputs: [{ resourceId: 'carbonDioxide', quantity: 144 }],
    outputs: [{ resourceId: 'graphite', quantity: 6 }],
  },
  {
    // Installed v0.8.7a Chemical Plant II binding: 4 Coal + 12 Chlorine
    // -> 12 Graphite + 4 Sour Water every 30 seconds.
    id: 'chemical-plant-ii-graphite-coal',
    name: 'Chemical Plant II (Graphite from Coal)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    // Coal and Chlorine are demand-produced after fallback allocation; neither
    // is a surplus constraint on this demand-balanced recipe.
    balanceInputIds: [],
    balanceOutputIds: ['graphite'],
    allocation: 'fallback',
    allocationPriority: 30,
    inputs: [
      { resourceId: 'coal', quantity: 8 },
      { resourceId: 'chlorine', quantity: 24 },
    ],
    outputs: [
      { resourceId: 'graphite', quantity: 24 },
      { resourceId: 'sourWater', quantity: 8 },
    ],
    electricityMultiplier: 2,
  },
  {
    id: 'copper-electrolysis-acid',
    displayName: 'Impure Copper + Acid → Copper',
    name: 'Copper Electrolysis (Acid)',
    building: 'Copper Electrolysis',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'impureCopper', quantity: 24 },
      { resourceId: 'acid', quantity: 6 },
    ],
    outputs: [{ resourceId: 'copper', quantity: 24 }],
  },
  {
    id: 'waste-sorting-recyclables',
    name: 'Waste Sorting Plant',
    building: 'Waste Sorting Plant',
    group: 'production',
    balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 144 }],
    // In v0.8.6 the sorter emits the hidden recoverable-material mix carried by
    // its Recyclables input. These placeholders are resolved by the calculator.
    outputs: [
      { resourceId: 'ironScrap', quantity: 0 },
      { resourceId: 'copperScrap', quantity: 0 },
      { resourceId: 'aluminumScrap', quantity: 0 },
      { resourceId: 'goldScrap', quantity: 0 },
      { resourceId: 'brokenGlass', quantity: 0 },
    ],
    sortsRecyclableSources: true,
  },
  {
    id: 'exhaust-scrubber-limestone',
    name: 'Exhaust Scrubber (Limestone)',
    building: 'Exhaust Scrubber',
    group: 'waste',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['exhaust'],
    // Dispatch iteratively against factory-wide Exhaust so downstream
    // byproducts remain available to ordinary demand-balanced recipes.
    inputPriorities: { exhaust: 1 },
    inputs: [
      { resourceId: 'exhaust', quantity: 480 },
      { resourceId: 'water', quantity: 48 },
      { resourceId: 'limestone', quantity: 9 },
    ],
    outputs: [
      { resourceId: 'sulfur', quantity: 12 },
      { resourceId: 'carbonDioxide', quantity: 192 },
      { resourceId: 'steamLow', quantity: 48 },
      { resourceId: 'slag', quantity: 9 },
    ],
  },
  {
    id: 'glass-maker-ii',
    name: 'Glass Maker II',
    building: 'Glass Maker II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['glass'],
    inputs: [{ resourceId: 'moltenGlass', quantity: 24 }],
    outputs: [{ resourceId: 'glass', quantity: 24 }],
  },
  {
    id: 'arc-furnace-ii-glass-broken',
    name: 'Arc Furnace II (Broken Glass - priority 1)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceInputIds: ['brokenGlass'],
    balanceOutputIds: ['moltenGlass'],
    sharedCapacity: { id: 'arc-furnace-ii-glass', priority: 1 },
    inputs: [
      { resourceId: 'brokenGlass', quantity: 72 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenGlass', quantity: 48 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: 'arc-furnace-ii-glass-mix',
    name: 'Arc Furnace II (Glass Mix - priority 2)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenGlass'],
    sharedCapacity: { id: 'arc-furnace-ii-glass', priority: 2 },
    inputs: [
      { resourceId: 'glassMix', quantity: 60 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenGlass', quantity: 48 },
      { resourceId: 'slag', quantity: 24 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 12 },
    ],
  },
  {
    id: 'mixer-ii-glass-mix-acid',
    name: 'Mixer II (Glass Mix with Acid)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    balanceOutputIds: ['glassMix'],
    inputs: [
      { resourceId: 'sand', quantity: 96 },
      { resourceId: 'limestone', quantity: 24 },
      { resourceId: 'salt', quantity: 12 },
      { resourceId: 'acid', quantity: 24 },
    ],
    outputs: [{ resourceId: 'glassMix', quantity: 120 }],
  },
  {
    id: 'mixer-ii-glass-mix-regular',
    name: 'Mixer II (Glass Mix)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    balanceOutputIds: ['glassMix'],
    inputs: [
      { resourceId: 'sand', quantity: 120 },
      { resourceId: 'limestone', quantity: 30 },
      { resourceId: 'salt', quantity: 12 },
    ],
    outputs: [{ resourceId: 'glassMix', quantity: 120 }],
  },
  {
    id: 'assembly-v-household-goods',
    name: 'Assembly V (Household Goods)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'glass', quantity: 32 },
      { resourceId: 'steel', quantity: 16 },
      { resourceId: 'wood', quantity: 32 },
    ],
    outputs: [{ resourceId: 'householdGoods', quantity: 64 }],
  },
  {
    id: 'assembly-v-mechanical-parts',
    name: 'Assembly V (Mechanical Parts)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [{ resourceId: 'steel', quantity: 48 }],
    outputs: [{ resourceId: 'mechanicalParts', quantity: 96 }],
  },
  {
    id: 'assembly-v-vehicle-parts-i',
    name: 'Assembly V (Vehicle Parts I)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 96 },
      { resourceId: 'electronicsI', quantity: 32 },
    ],
    outputs: [{ resourceId: 'vehiclePartsI', quantity: 64 }],
  },
  {
    id: 'assembly-v-vehicle-parts-ii',
    name: 'Assembly V (Vehicle Parts II)',
    building: 'Assembly V',
    group: 'production',
    cycleDurationSeconds: 7.5,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'vehiclePartsI', quantity: 32 },
      { resourceId: 'steel', quantity: 16 },
      { resourceId: 'glass', quantity: 8 },
    ],
    outputs: [{ resourceId: 'vehiclePartsII', quantity: 16 }],
  },
  {
    id: 'cooled-caster-steel',
    name: 'Cooled Caster (Steel)',
    building: 'Cooled Caster',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'input',
    balanceInputIds: ['moltenSteel'],
    balanceInputScope: 'module',
    allocation: 'fallback',
    allocationPriority: 20,
    inputs: [
      { resourceId: 'moltenSteel', quantity: 12 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [{ resourceId: 'steel', quantity: 12 }],
  },
  {
    id: 'cooled-caster-ii-steel',
    name: 'Cooled Caster II (Steel)',
    building: 'Cooled Caster II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'moltenSteel', quantity: 24 },
      { resourceId: 'water', quantity: 12 },
    ],
    outputs: [{ resourceId: 'steel', quantity: 24 }],
  },
  {
    id: 'oxygen-furnace-steel',
    name: 'Oxygen Furnace',
    building: 'Oxygen Furnace',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'input',
    balanceInputIds: ['moltenIron'],
    balanceInputScope: 'module',
    allocation: 'fallback',
    allocationPriority: 10,
    inputs: [
      { resourceId: 'moltenIron', quantity: 24 },
      { resourceId: 'oxygen', quantity: 18 },
    ],
    outputs: [
      { resourceId: 'moltenSteel', quantity: 12 },
      { resourceId: 'exhaust', quantity: 24 },
    ],
  },
  {
    id: 'oxygen-furnace-ii-steel',
    name: 'Oxygen Furnace II',
    building: 'Oxygen Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenSteel'],
    inputs: [
      { resourceId: 'moltenIron', quantity: 48 },
      { resourceId: 'oxygen', quantity: 18 },
    ],
    outputs: [
      { resourceId: 'moltenSteel', quantity: 24 },
      { resourceId: 'exhaust', quantity: 36 },
    ],
  },
  {
    id: 'arc-furnace-ii-iron-scrap',
    name: 'Arc Furnace II (Iron Scrap — priority 1)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['ironScrap'],
    sharedCapacity: { id: 'arc-furnace-ii-iron', priority: 1 },
    inputs: [
      { resourceId: 'ironScrap', quantity: 48 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenIron', quantity: 48 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: 'arc-furnace-ii-iron-ore',
    name: 'Arc Furnace II (Crushed Iron Ore — priority 2)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    // Scrap and unavoidable co-products (notably Titanium Ore's Molten Iron)
    // are allocated first. This ore route fills only the remaining demand and
    // then starts its Crusher support chain in the following fallback step.
    balanceInputIds: [],
    balanceOutputIds: ['moltenIron'],
    allocation: 'fallback',
    allocationPriority: 50,
    sharedCapacity: { id: 'arc-furnace-ii-iron', priority: 2 },
    inputs: [
      { resourceId: 'ironOreCrushed', quantity: 48 },
      { resourceId: 'limestone', quantity: 6 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenIron', quantity: 48 },
      { resourceId: 'slag', quantity: 18 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 12 },
    ],
  },
  {
    id: 'crusher-large-iron',
    name: 'Crusher (Large) — Iron Ore',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    allocation: 'fallback',
    allocationPriority: 60,
    inputs: [{ resourceId: 'ironOre', quantity: 192 }],
    outputs: [{ resourceId: 'ironOreCrushed', quantity: 192 }],
  },
  {
    id: 'arc-furnace-ii-copper-scrap',
    name: 'Arc Furnace II (Copper Scrap — priority 1)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['copperScrap'],
    sharedCapacity: { id: 'arc-furnace-ii-copper', priority: 1 },
    inputs: [
      { resourceId: 'copperScrap', quantity: 48 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenCopper', quantity: 48 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 6 },
    ],
    electricityMultiplier: 0.6,
  },
  {
    id: 'arc-furnace-ii-copper-ore',
    name: 'Arc Furnace II (Crushed Ore — priority 2)',
    building: 'Arc Furnace II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['moltenCopper'],
    sharedCapacity: { id: 'arc-furnace-ii-copper', priority: 2 },
    inputs: [
      { resourceId: 'copperOreCrushed', quantity: 48 },
      { resourceId: 'sand', quantity: 6 },
      { resourceId: 'graphite', quantity: 3 },
      { resourceId: 'water', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'moltenCopper', quantity: 48 },
      { resourceId: 'slag', quantity: 18 },
      { resourceId: 'steamLow', quantity: 6 },
      { resourceId: 'exhaust', quantity: 12 },
    ],
  },
  {
    id: 'metal-caster-ii-copper',
    name: 'Metal Caster II (Copper)',
    building: 'Metal Caster II',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [{ resourceId: 'moltenCopper', quantity: 24 }],
    outputs: [{ resourceId: 'impureCopper', quantity: 24 }],
  },
  {
    id: 'crusher-large-copper',
    name: 'Crusher (Large) — Copper Ore',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 30,
    balanceBy: 'output',
    inputs: [{ resourceId: 'copperOre', quantity: 192 }],
    outputs: [{ resourceId: 'copperOreCrushed', quantity: 192 }],
  },
  {
    id: 'gold-furnace-scrap',
    name: 'Gold Furnace (Gold Scrap — priority 1)',
    building: 'Gold Furnace',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'input',
    balanceInputIds: ['goldScrap'],
    sharedCapacity: { id: 'gold-furnace', priority: 1 },
    inputs: [{ resourceId: 'goldScrap', quantity: 9 }],
    outputs: [{ resourceId: 'gold', quantity: 9 }],
    electricityMultiplier: 0.6,
  },
  {
    id: 'gold-furnace-concentrate',
    name: 'Gold Furnace (Concentrate — priority 2)',
    building: 'Gold Furnace',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['gold'],
    sharedCapacity: { id: 'gold-furnace', priority: 2 },
    inputs: [
      { resourceId: 'goldOreConcentrate', quantity: 18 },
      { resourceId: 'sand', quantity: 3 },
    ],
    outputs: [
      { resourceId: 'gold', quantity: 9 },
      { resourceId: 'exhaust', quantity: 12 },
    ],
  },
  {
    id: 'settling-tank-gold',
    name: 'Settling Tank (Gold Ore Concentrate)',
    building: 'Settling Tank',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    balanceOutputIds: ['goldOreConcentrate'],
    inputs: [
      { resourceId: 'goldOrePowder', quantity: 36 },
      { resourceId: 'acid', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'goldOreConcentrate', quantity: 9 },
      { resourceId: 'toxicSlurry', quantity: 27 },
    ],
  },
  {
    id: 'crusher-large-gold-crushing',
    name: 'Gold Ore Crushing (Gold Ore → Crushed Gold Ore)',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 20,
    balanceBy: 'output',
    inputs: [{ resourceId: 'goldOre', quantity: 144 }],
    outputs: [{ resourceId: 'goldOreCrushed', quantity: 144 }],
  },
  {
    id: 'crusher-large-gold-milling',
    name: 'Gold Ore Milling (Crushed Gold Ore → Gold Ore Powder)',
    building: 'Crusher (Large)',
    group: 'production',
    cycleDurationSeconds: 40,
    balanceBy: 'output',
    inputs: [{ resourceId: 'goldOreCrushed', quantity: 72 }],
    outputs: [{ resourceId: 'goldOrePowder', quantity: 72 }],
  },

  // Static infrastructure. Runtime utilization is not available, so these
  // no-flow rows account for workers while avoiding modeled production flows.
  {
    id: 'static-captain-office-i',
    name: "Captain's office I",
    building: "Captain's office I",
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-captain-office-ii',
    name: "Captain's office II",
    building: "Captain's office II",
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-ore-sorting-plant',
    name: 'Ore sorting plant',
    building: 'Ore sorting plant',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-ore-sorting-plant-large',
    name: 'Ore sorting plant (large)',
    building: 'Ore sorting plant (large)',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-electric-locomotive-ii',
    name: 'Electric locomotive II',
    building: 'Electric locomotive II',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-unit-station-module-electrified',
    name: 'Unit station module (electrified)',
    building: 'Unit station module (electrified)',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-fluid-station-module-electrified',
    name: 'Fluid station module (electrified)',
    building: 'Fluid station module (electrified)',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-loose-station-module-electrified',
    name: 'Loose station module (electrified)',
    building: 'Loose station module (electrified)',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-molten-station-module-electrified',
    name: 'Molten station module (electrified)',
    building: 'Molten station module (electrified)',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-stacker-tower',
    name: 'Stacker tower',
    building: 'Stacker tower',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-train-depot',
    name: 'Train depot',
    building: 'Train depot',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-vehicles-depot',
    name: 'Vehicles depot',
    building: 'Vehicles depot',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-vehicles-depot-ii',
    name: 'Vehicles depot II',
    building: 'Vehicles depot II',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-vehicles-depot-iii',
    name: 'Vehicles depot III',
    building: 'Vehicles depot III',
    group: 'production',
    inputs: [],
    outputs: [],
    electricityMultiplier: 0,
  },
  {
    id: 'static-vehicles',
    name: 'Vehicles',
    building: 'Vehicles',
    group: 'production',
    inputs: [],
    outputs: [],
  },
  // Maintenance
  {
    id: maintenanceStatue.id,
    name: maintenanceStatue.name,
    building: maintenanceStatue.name,
    group: 'production',
    cycleDurationSeconds: 30,
    inputs: [{ resourceId: 'fuelGas', quantity: maintenanceStatue.fuelGasPerCycle }],
    outputs: [],
  },
  {
    id: 'maintenance-i-basic',
    name: 'Maintenance I (Basic)',
    building: 'Maintenance Depot (Basic)',
    group: 'production',
    cycleDurationSeconds: 30,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 12 },
      { resourceId: 'electronicsI', quantity: 6 },
    ],
    outputs: [{ resourceId: 'maintenanceI', quantity: 220, outputModifierId: 'maintenanceOutput' }],
  },
  {
    id: 'maintenance-i',
    name: 'Maintenance I',
    building: 'Maintenance Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 24 },
      { resourceId: 'electronicsI', quantity: 12 },
    ],
    outputs: [{ resourceId: 'maintenanceI', quantity: 480, outputModifierId: 'maintenanceOutput' }],
  },
  {
    id: 'maintenance-i-recycling',
    name: 'Maintenance I (Recycling)',
    building: 'Maintenance Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 24 },
      { resourceId: 'electronicsI', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'maintenanceI', quantity: 480, outputModifierId: 'maintenanceOutput' },
      { resourceId: 'recyclables', quantity: 18 },
    ],
  },
  {
    id: 'maintenance-ii',
    name: 'Maintenance II',
    building: 'Maintenance II Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 18 },
      { resourceId: 'electronicsII', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'maintenanceII', quantity: 480, outputModifierId: 'maintenanceOutput' },
    ],
  },
  {
    id: 'maintenance-ii-recycling',
    name: 'Maintenance II (Recycling)',
    building: 'Maintenance II Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 18 },
      { resourceId: 'electronicsII', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'maintenanceII', quantity: 480, outputModifierId: 'maintenanceOutput' },
      { resourceId: 'recyclables', quantity: 24 },
    ],
  },
  {
    id: 'maintenance-iii',
    name: 'Maintenance III',
    building: 'Maintenance III Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 9 },
      { resourceId: 'electronicsIII', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'maintenanceIII', quantity: 240, outputModifierId: 'maintenanceOutput' },
    ],
  },
  {
    id: 'maintenance-iii-recycling',
    name: 'Maintenance III (Recycling)',
    building: 'Maintenance III Depot',
    group: 'production',
    cycleDurationSeconds: 20,
    inputs: [
      { resourceId: 'mechanicalParts', quantity: 9 },
      { resourceId: 'electronicsIII', quantity: 6 },
    ],
    outputs: [
      { resourceId: 'maintenanceIII', quantity: 240, outputModifierId: 'maintenanceOutput' },
      { resourceId: 'recyclables', quantity: 24 },
    ],
  },
  {
    id: 'chemical-plant-mox-rod',
    name: 'Chemical Plant (Plutonium → MOX Rod)',
    building: 'Chemical Plant II',
    group: 'production',
    inputs: [
      { resourceId: 'plutonium', quantity: 1 },
      { resourceId: 'depletedUranium', quantity: 4 },
    ],
    outputs: [{ resourceId: 'moxRod', quantity: 2 }],
  },
  {
    id: 'chemical-plant-blanket-enriched',
    name: 'Chemical Plant (Enriched → Blanket Fuel)',
    building: 'Chemical Plant II',
    group: 'production',
    inputs: [
      { resourceId: 'blanketFuelEnriched', quantity: 2 },
      { resourceId: 'depletedUranium', quantity: 10 },
      { resourceId: 'salt', quantity: 4 },
    ],
    outputs: [{ resourceId: 'blanketFuel', quantity: 4 }],
  },
  {
    id: 'chemical-plant-yellowcake',
    name: 'Chemical Plant (Yellowcake → Blanket Fuel)',
    building: 'Chemical Plant II',
    group: 'production',
    balanceBy: 'output',
    inputs: [
      { resourceId: 'yellowcake', quantity: 6 },
      { resourceId: 'salt', quantity: 2 },
    ],
    outputs: [{ resourceId: 'blanketFuel', quantity: 2 }],
  },
  {
    id: 'nuclear-reprocessing-spent-fuel',
    name: 'Nuclear Reprocessing (Spent Fuel)',
    building: 'Nuclear Reprocessing Plant',
    group: 'production',
    inputs: [
      { resourceId: 'spentFuel', quantity: 2 },
      { resourceId: 'acid', quantity: 2 },
      { resourceId: 'moltenGlass', quantity: 2 },
      { resourceId: 'salt', quantity: 2 },
    ],
    outputs: [
      { resourceId: 'blanketFuel', quantity: 2 },
      { resourceId: 'fissionProduct', quantity: 2 },
    ],
  },
  {
    id: 'nuclear-reprocessing-spent-mox',
    name: 'Nuclear Reprocessing (Spent MOX)',
    building: 'Nuclear Reprocessing Plant',
    group: 'production',
    inputs: [
      { resourceId: 'spentMox', quantity: 2 },
      { resourceId: 'acid', quantity: 2 },
      { resourceId: 'moltenGlass', quantity: 2 },
      { resourceId: 'salt', quantity: 2 },
    ],
    outputs: [
      { resourceId: 'blanketFuel', quantity: 2 },
      { resourceId: 'fissionProduct', quantity: 2 },
    ],
  },
  {
    id: 'radioactive-waste-storage',
    name: 'Radioactive Waste Storage (Fission Product)',
    building: 'Radioactive Waste Storage',
    group: 'waste',
    inputs: [{ resourceId: 'fissionProduct', quantity: radioactiveWasteStorageThroughput }],
    outputs: [{ resourceId: 'retiredWaste', quantity: radioactiveWasteStorageThroughput }],
    decayStorage: {
      capacity: radioactiveWasteStorageCapacity,
      decayCycles: fissionProductDecayCycles,
    },
    balanceBy: 'input',
  },
  {
    id: 'shredder-retired-waste',
    name: 'Shredder (Retired Waste)',
    building: 'Shredder',
    group: 'waste',
    inputs: [{ resourceId: 'retiredWaste', quantity: 6 }],
    outputs: [{ resourceId: 'recyclables', quantity: 6 }],
    // Preserve the recoverable source materials carried by Retired Waste.
    appliesRecyclingEfficiency: false,
    balanceBy: 'input',
  },

  // Uranium processing
  {
    id: 'mixer-ii-acid',
    name: 'Mixer II (Acid)',
    building: 'Mixer II',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    inputs: [
      { resourceId: 'sulfur', quantity: 12 },
      { resourceId: 'water', quantity: 60 },
    ],
    outputs: [{ resourceId: 'acid', quantity: 72 }],
  },
  {
    id: 'crusher',
    name: 'Crusher (Uranium Ore)',
    building: 'Crusher',
    group: 'production',
    inputs: [{ resourceId: 'uraniumOre', quantity: 12 }],
    outputs: [{ resourceId: 'uraniumOrePowder', quantity: 12 }],
  },
  {
    id: 'crusher-large',
    name: 'Crusher (Large) — Uranium Ore',
    building: 'Crusher (Large)',
    group: 'production',
    balanceBy: 'output',
    inputs: [{ resourceId: 'uraniumOre', quantity: 72 }],
    outputs: [{ resourceId: 'uraniumOrePowder', quantity: 72 }],
  },
  {
    id: 'settling-tank',
    name: 'Settling Tank (Yellowcake)',
    building: 'Settling Tank',
    group: 'production',
    balanceBy: 'output',
    balanceOutputIds: ['yellowcake'],
    inputs: [
      { resourceId: 'uraniumOrePowder', quantity: 36 },
      { resourceId: 'acid', quantity: 12 },
    ],
    outputs: [
      { resourceId: 'yellowcake', quantity: 6 },
      { resourceId: 'toxicSlurry', quantity: 36 },
    ],
  },
  {
    id: 'enrichment-plant-eu4',
    name: 'Enrichment Plant (Yellowcake → EU4)',
    building: 'Enrichment Plant',
    group: 'production',
    inputs: [
      { resourceId: 'yellowcake', quantity: 3 },
      { resourceId: 'hydrogenFluoride', quantity: 1 },
    ],
    outputs: [
      { resourceId: 'enrichedUranium4', quantity: 0.5 },
      { resourceId: 'depletedUranium', quantity: 2.5 },
    ],
  },
  {
    id: 'enrichment-plant-eu20',
    name: 'Enrichment Plant (EU4 → EU20)',
    building: 'Enrichment Plant',
    group: 'production',
    inputs: [
      { resourceId: 'enrichedUranium4', quantity: 2.5 },
      { resourceId: 'hydrogenFluoride', quantity: 1 },
    ],
    outputs: [
      { resourceId: 'enrichedUranium20', quantity: 0.5 },
      { resourceId: 'depletedUranium', quantity: 2 },
    ],
  },

  // Water & hydrogen
  {
    id: 'hydrogen-reformer-super',
    name: 'Hydrogen Reformer (Super Steam)',
    building: 'Hydrogen Reformer',
    group: 'production',
    inputs: [
      { resourceId: 'water', quantity: 16 },
      { resourceId: 'steamSuper', quantity: 12 },
    ],
    // Produce the factory's requested Hydrogen, then leave remaining reactor
    // steam for desalination instead of manufacturing an unused H2 surplus.
    balanceBy: 'output',
    balanceOutputIds: ['hydrogen'],
    outputs: [
      { resourceId: 'hydrogen', quantity: 32 },
      { resourceId: 'oxygen', quantity: 32 },
      { resourceId: 'steamDepleted', quantity: 12 },
    ],
  },
  {
    id: 'thermal-desalinator-depleted',
    name: 'Thermal Desalinator (Depleted Steam)',
    building: 'Thermal Desalinator',
    group: 'production',
    inputs: [
      { resourceId: 'seaWater', quantity: 15 },
      { resourceId: 'steamDepleted', quantity: 24 },
    ],
    // Recover useful Water and Brine first, but do not desalinate merely to
    // consume steam. Any Depleted Steam left after real demand is routed to
    // cooling towers as the final sink.
    balanceBy: 'output',
    balanceInputIds: ['steamDepleted'],
    balanceOutputIds: ['water', 'brine'],
    allocation: 'fallback',
    allocationPriority: 0,
    outputs: [
      { resourceId: 'water', quantity: 33 },
      { resourceId: 'brine', quantity: 6 },
    ],
  },
  {
    // Captain of Industry v0.8.7 game-data rate, normalized from 10 to 60 seconds.
    // Keep Low Steam desalination as a secondary option. It can sacrifice the
    // last turbine stage for Water/Brine only after the ordinary depleted- and
    // super-steam desalination paths cannot satisfy demand.
    id: 'thermal-desalinator-low',
    name: 'Thermal Desalinator (Low Steam)',
    building: 'Thermal Desalinator',
    group: 'production',
    cycleDurationSeconds: 10,
    balanceBy: 'output',
    balanceInputIds: ['steamLow'],
    balanceOutputIds: ['water', 'brine'],
    allocation: 'fallback',
    allocationPriority: 80,
    inputs: [
      { resourceId: 'seaWater', quantity: 72 },
      { resourceId: 'steamLow', quantity: 24 },
    ],
    outputs: [
      { resourceId: 'water', quantity: 72 },
      { resourceId: 'brine', quantity: 24 },
    ],
  },
  {
    id: 'thermal-desalinator-super',
    name: 'Thermal Desalinator (Super Steam)',
    building: 'Thermal Desalinator',
    group: 'production',
    inputs: [
      { resourceId: 'seaWater', quantity: 108 },
      { resourceId: 'steamSuper', quantity: 6 },
    ],
    // Cover Water demand with reactor steam left after electricity and H2;
    // the resulting Brine then feeds wastewater, Chlorine, and Salt in order.
    // The explicit steam balance prevents desalination from overdrawing the
    // single FBR when both output-balanced consumers run in the same pass.
    balanceBy: 'output',
    balanceInputIds: ['steamSuper'],
    balanceOutputIds: ['water', 'brine'],
    allocation: 'fallback',
    allocationPriority: 10,
    outputs: [
      { resourceId: 'water', quantity: 72 },
      { resourceId: 'brine', quantity: 42 },
    ],
  },

  // Sinks
  {
    id: 'cooling-tower-large-depleted',
    name: 'Cooling Tower Large (Depleted)',
    building: 'Cooling Tower (Large)',
    group: 'sink',
    sharedCapacity: {
      id: 'cooling-tower-large-steam',
      label: 'Cooling Tower (Large)',
      priority: 1,
    },
    inputs: [{ resourceId: 'steamDepleted', quantity: 96 }],
    outputs: [{ resourceId: 'water', quantity: 72 }],
  },
  {
    // Captain of Industry v0.8.7 game data: 16 Low Steam becomes 12 Water
    // every 10 seconds, normalized here to one 60-second production cycle.
    id: 'cooling-tower-large-low',
    name: 'Cooling Tower Large (Low)',
    building: 'Cooling Tower (Large)',
    group: 'sink',
    sharedCapacity: {
      id: 'cooling-tower-large-steam',
      label: 'Cooling Tower (Large)',
      priority: 2,
    },
    inputs: [{ resourceId: 'steamLow', quantity: 96 }],
    outputs: [{ resourceId: 'water', quantity: 72 }],
  },
  {
    id: 'cooling-tower-large-super',
    name: 'Cooling Tower Large (Super)',
    building: 'Cooling Tower (Large)',
    group: 'sink',
    sharedCapacity: {
      id: 'cooling-tower-large-steam',
      label: 'Cooling Tower (Large)',
      priority: 3,
    },
    inputs: [{ resourceId: 'steamSuper', quantity: 96 }],
    outputs: [{ resourceId: 'water', quantity: 48 }],
  },
  {
    // Captain of Industry v0.8.7: each Liquid Dump handles 200 fluid per
    // production cycle. It consumes only Water left after useful consumers.
    id: 'nuclear-liquid-dump-water',
    name: 'Liquid Dump (Water)',
    building: 'Liquid Dump',
    group: 'sink',
    inputs: [{ resourceId: 'water', quantity: 200 }],
    outputs: [],
  },
  {
    // Captain of Industry v0.8.7: each Liquid Dump handles 200 fluid per
    // production cycle. It consumes only Brine left after useful consumers.
    id: 'nuclear-liquid-dump-brine',
    name: 'Liquid Dump (Brine)',
    building: 'Liquid Dump',
    group: 'sink',
    sinkScope: 'module',
    inputs: [{ resourceId: 'brine', quantity: 200 }],
    outputs: [],
  },
  {
    // Captain of Industry v0.8.7: the Large Smoke Stack runs the 20 Oxygen / 20s
    // disposal recipe at 15x throughput, or 900 Oxygen per production cycle.
    // As a sink, it exports Oxygen to regular factory consumers first and vents
    // only the final factory-wide remainder.
    id: 'nuclear-smoke-stack-large-oxygen',
    name: 'Smoke stack (large) (Oxygen)',
    building: 'Smoke stack (large)',
    group: 'sink',
    inputs: [{ resourceId: 'oxygen', quantity: 900 }],
    outputs: [],
  },
]

export const createGroundwaterPumpRecipe = (
  recipeId: 'groundwater-pump' | 'groundwater-pump-factory-reserve',
  constraint: GroundwaterSourceConstraint,
): Recipe => {
  const recipe = recipes.find(candidate => candidate.id === recipeId)

  if (!recipe) throw new Error(`Missing groundwater recipe: ${recipeId}`)

  const outputPerPump =
    constraint.projectedPumpCount > 0
      ? constraint.sustainableOutputPerCycle / constraint.projectedPumpCount
      : 0

  return {
    ...recipe,
    outputs: recipe.outputs.map(output =>
      output.resourceId === 'water' ? { ...output, quantity: outputPerPump } : output,
    ),
    groundwaterConstraint: constraint,
  }
}
