import { type GroundwaterSourceConstraint } from '../helpers/groundwater/calculate-groundwater-production'
import { type RecyclingSources } from '../helpers/recycling/recycling'
import { chickenFarm } from './chicken-farm'
import { computingRecipeIds, dataCenter } from './computing'
import {
  calculateCropFarmGroupRates,
  cropFarmTiers,
  fertilizers,
  type CropFarmGroup,
} from './crop-farming'
import { activeHousingType, housingTypes } from './housing'
import { maintenanceStatue } from './maintenance-statue'
import { getOfficeRecipeId, officeCatalog, type OfficeBoostStep } from './offices'
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
export type SourceKind = 'groundwater' | 'terrain-mine' | 'virtual-provision' | 'world-mine'
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
  /** Keep intermittent capacity available without inventing demand or suggesting it can pause. */
  keepReady?: boolean
  id: string
  /** Exact stable prototype ID exported by the game for an in-game building. */
  gameBuildingId?: string
  /** Exact stable ID exported by the game for an in-game selectable recipe. */
  gameRecipeId?: string
  /** Placement section for a synced train-station module card. */
  stationRole?: 'input' | 'export'
  /** Optional concise label used when the building name is already visible. */
  displayName?: string
  /** Actual setting shown below the building name; recipe descriptions belong in tooltips. */
  configurationLabel?: string
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
  /** Output-balanced recipes can serve only demand created inside their physical module. */
  balanceOutputScope?: 'module'
  /** Lower values allocate demand-balanced recipes first when planned outputs compete. */
  demandPriority?: number
  /** Fallback recipes run after ordinary production; surplus recipes run last. */
  allocation?: RecipeAllocation
  /** Lower values run first within the same non-primary allocation pass. */
  allocationPriority?: number
  /** Yield inputs to final surplus routes, then refill outputs using feasible fallback production. */
  yieldToSurplus?: boolean
  /** Inputs whose remaining surplus may drive additional utilization after ordinary demand. */
  consumeSurplusInputIds?: ResourceId[]
  /** Extra output must be consumed by downstream surplus routes in the same allocation. */
  consumeSurplusOutputIds?: ResourceId[]
  /** Limits additional surplus consumption to production inside the same physical module. */
  consumeSurplusInputScope?: 'module'
  /** Lower values receive a shared surplus resource first. */
  surplusConsumptionPriority?: number
  /** Preferred conversion runs before fallbacks; residual conversion runs before disposal. */
  surplusConsumptionPhase?: 'before-fallback' | 'before-disposal'
  /** Input-balanced recipes can consume only net production from their own physical module. */
  balanceInputScope?: 'module'
  /** Inputs supplied only inside this module, independently of utilization limits. */
  moduleInputIds?: ResourceId[]
  sharedCapacity?: SharedCapacity
  cycleDurationSeconds?: number
  /** Special game output computed from consumed products, with no fixed quantity. */
  recyclesInputs?: boolean
  /** Scrap produced per cycle after applying the current recycling context. */
  recyclingSources?: RecyclingSources
  /** Observed scrap units per recyclable received by this sorting plant. */
  recyclingInputSources?: RecyclingSources
  /** Emits the recoverable material composition carried by Recyclables. */
  sortsRecyclableSources?: boolean
  /** Demand sources cover deficits; module variants remain owned by one physical area. */
  sourceMode?: SourceMode
  /** Primary sources satisfy demand before ordinary production; sources default to fallback. */
  sourceAllocation?: 'primary'
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
  /** A fixed operation is shared across every active building instead of repeated by each one. */
  fixedTotalOperation?: boolean
}

export const getGameRecipeKey = (buildingId: string, recipeId: string) => (
  `${buildingId}:${recipeId}`
)

export const matchesGameRecipe = (
  recipe: Pick<Recipe, 'gameBuildingId' | 'gameRecipeId'>,
  buildingId: string,
  recipeId: string,
) => recipe.gameBuildingId === buildingId && recipe.gameRecipeId === recipeId

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
    configurationLabel: group.name,
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

export const recipes: Recipe[] = [
  // Sources
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
  ...reserveResourceCatalog.map(
    ({ name, recipeId, resourceId, sourceAllocation }): Recipe => ({
      id: recipeId,
      name: `${name} (Synced Reserve)`,
      building: 'Eligible Storage',
      group: 'source',
      inputs: [],
      outputs: [{ resourceId, quantity: 0 }],
      sourceMode: 'demand',
      sourceAllocation: sourceAllocation === 'primary' ? 'primary' : undefined,
      sourceKind: 'virtual-provision',
    }),
  ),
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
    configurationLabel: '1× enrichment',
    gameBuildingId: 'FastBreederReactor',
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
    configurationLabel: '0× enrichment',
    gameBuildingId: 'FastBreederReactor',
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
    configurationLabel: '3× enrichment',
    gameBuildingId: 'FastBreederReactor',
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
    // Residents consume as population, not as machines: more housing is
    // never the fix for a surplus they leave behind.
    tracksPhysicalCapacity: false,
    inputs: housingPopulationFlows.inputs,
    outputs: housingPopulationFlows.outputs,
    recyclesInputs: true,
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
    tracksPhysicalCapacity: false,
    inputs: housingIiPopulationFlows.inputs,
    outputs: housingIiPopulationFlows.outputs,
    recyclesInputs: true,
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
  {
    // Installed v0.8.7 Ethanol Cooking Oil Reforming binding, normalized to
    // one 60-second production cycle. An empty output-demand list prevents
    // Diesel demand from starting this disposal route; Cooking Oil surplus is
    // its only driver, with Ethanol demand-propagated as supporting production.
    // Fuel is the last claimant on shared inputs: the route runs in the final
    // surplus pass so Hydrogen serves every other recipe, fallback Ammonia
    // included, before Ethanol for Diesel.
    id: 'chemical-plant-ii-cooking-oil-diesel',
    gameBuildingId: 'ChemicalPlant2',
    gameRecipeId: 'EthanolCookingOilReforming',
    name: 'Chemical Plant II (Cooking Oil → Diesel)',
    building: 'Chemical Plant II',
    group: 'production',
    cycleDurationSeconds: 60,
    balanceBy: 'output',
    balanceOutputIds: [],
    consumeSurplusInputIds: ['cookingOil'],
    surplusConsumptionPriority: 110,
    inputs: [
      { resourceId: 'ethanol', quantity: 15 },
      { resourceId: 'cookingOil', quantity: 30 },
    ],
    outputs: [{ resourceId: 'diesel', quantity: 54 }],
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

  // Fixed crop rotations and livestock
  {
    id: 'chicken-farm-slaughtering',
    configurationLabel: 'Slaughtering enabled',
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
    configurationLabel: 'Slaughtering disabled',
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

  // Lab Equipment chain on Assembly V, normalized to 60 seconds from v0.8.6c.
  {
    id: 'research-lab-iv',
    gameBuildingId: 'ResearchLab4',
    name: 'Research Lab IV',
    building: 'Research Lab IV',
    showConfigurationSummary: false,
    group: 'production',
    inputs: [{ resourceId: 'labEquipmentIv', quantity: 48 }],
    recyclesInputs: true,
    outputs: [{ resourceId: 'recyclables', quantity: 0 }],
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
        configurationLabel: `Computing boost ${boostStep}`,
        building: office.name,
        group: 'production',
        cycleDurationSeconds: 60,
        balanceBy: 'input',
        recyclesInputs: true,
        inputs: [
          {
            resourceId: 'officeSupplies',
            quantity: office.officeSuppliesPerCycle,
          },
        ],
        outputs: [
          {
            resourceId: 'recyclables',
            quantity: 0,
          },
        ],
        computingMultiplier: boostStep ** 2,
      }),
    ),
  ),
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
    fixedTotalOperation: true,
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
    recyclesInputs: true,
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
      { resourceId: 'recyclables', quantity: 0 },
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
    recyclesInputs: true,
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
      { resourceId: 'recyclables', quantity: 0 },
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
    recyclesInputs: true,
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
      { resourceId: 'recyclables', quantity: 0 },
    ],
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
    recyclesInputs: true,
    name: 'Shredder (Retired Waste)',
    building: 'Shredder',
    group: 'waste',
    inputs: [{ resourceId: 'retiredWaste', quantity: 6 }],
    outputs: [{ resourceId: 'recyclables', quantity: 0 }],
    // Preserve the recoverable source materials carried by Retired Waste.
    balanceBy: 'input',
  },
  {
    id: 'crusher',
    name: 'Crusher (Uranium Ore)',
    building: 'Crusher',
    group: 'production',
    inputs: [{ resourceId: 'uraniumOre', quantity: 12 }],
    outputs: [{ resourceId: 'uraniumOrePowder', quantity: 12 }],
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
    // Nuclear electrolysis is the factory's shared source for both products.
    // Run for whichever requested product needs more throughput; the paired
    // output remains visible as a real co-product surplus.
    balanceBy: 'output',
    balanceOutputIds: ['hydrogen', 'oxygen'],
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
    sinkScope: 'module',
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

  return applyGroundwaterSourceConstraint(recipe, constraint)
}

export const applyGroundwaterSourceConstraint = (
  recipe: Recipe,
  constraint: GroundwaterSourceConstraint,
): Recipe => {
  if (!recipe.outputs.some(output => output.resourceId === 'water')) {
    throw new Error(`Groundwater recipe does not produce Water: ${recipe.id}`)
  }

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
