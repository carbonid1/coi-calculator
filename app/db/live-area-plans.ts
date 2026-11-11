import { type ChickenFarmSettings } from './chicken-farm'
import { type ComputingConfig } from './computing'
import { activeCropFarmGroups, thirdFbrCropFarmGroups } from './crop-farm-plans'
import { type CropFarmGroup } from './crop-farming'
import { type LiveAreaProductionTarget } from './modules/production-targets'
import { plannedOfficePlan, type OfficeConfigurationCount } from './offices'
import { type ResourceProcessingPriorities } from './resource-supply'
import { type ResourceId } from './resources'

interface LiveAreaPlan {
  householdAppliances?: boolean
  productionTargets?: readonly LiveAreaProductionTarget[]
  cropFarms?: readonly CropFarmGroup[]
  chickenFarms?: ChickenFarmSettings
  foodPackProduction?: Partial<Record<'eggs' | 'meat', number>>
  thirdFbr?: Pick<LiveAreaPlan, 'cropFarms' | 'chickenFarms' | 'foodPackProduction'>
  resourceProcessingPriorities?: ResourceProcessingPriorities
  /** Minimum running computing inventory, including installed server racks. */
  computing?: ComputingConfig
  /** Minimum running Office configurations; completed construction satisfies the target. */
  offices?: readonly OfficeConfigurationCount[]
  /** Solve with the factory pool. Omitted areas solve locally before exchanging their boundary flows. */
  resourcePool?: 'factory'
  requestedImports?: Partial<Record<ResourceId, number>>
  requestedExports?: Partial<Record<ResourceId, number>>
}

export type LiveAreaPlans = Readonly<Record<number, LiveAreaPlan>>

/** Save-scoped operating requests. Area names are labels and never identity. */
const liveAreaPlansBySave: Readonly<Record<string, LiveAreaPlans>> = {
  'Last-Stop Waters': {
    [-1]: {
      productionTargets: [
        { buildingId: 'AssemblyRoboticT2', recipeId: 'ElectronicsAssembly', building: 'Assembly V',
          product: 'electronicsI', target: 4 },
        { buildingId: 'AssemblyRoboticT2', recipeId: 'Electronics2Assembly', building: 'Assembly V',
          product: 'electronicsII', target: 5 },
        { buildingId: 'AssemblyRoboticT2', recipeId: 'PCBAssembly', building: 'Assembly V',
          product: 'pcb', target: 3 },
        { buildingId: 'ChemicalPlant2', recipeId: 'CarbonToEthanolProduction', building: 'Chemical plant II',
          product: 'ethanol', target: 5 },
        { buildingId: 'CrusherLarge', recipeId: 'CopperOreCrushing', building: 'Crusher (large)',
          product: 'copperOreCrushed', target: 2 },
        { buildingId: 'VacuumDistillationTower', recipeId: 'RubberProductionEthanol', building: 'Rubber maker',
          product: 'rubber', target: 3 },
      ],
    },
    10: { cropFarms: activeCropFarmGroups, thirdFbr: { cropFarms: thirdFbrCropFarmGroups } },
    12: {
      resourceProcessingPriorities: { brine: 'local-first' },
    },
    13: {
      computing: { dataCenterCount: 8, rackCount: 369, waterChillers: 8 },
    },
    14: { householdAppliances: true },
    16: {
      resourcePool: 'factory',
      productionTargets: [
        { buildingId: 'ArcFurnace2', recipeId: 'CopperSmeltingArc', building: 'Arc furnace II',
          product: 'moltenCopper', target: 7 },
        { buildingId: 'CasterT2', recipeId: 'CopperCasting', building: 'Metal caster II',
          pluralName: 'Metal casters II', product: 'impureCopper', target: 14 },
        { buildingId: 'CopperElectrolysis', recipeId: 'CopperElectrolysisProcess', building: 'Copper electrolysis',
          pluralName: 'copper electrolysis units', product: 'copper', target: 14 },
      ],
    },
    21: {
      resourcePool: 'factory',
    },
    23: {
      offices: [{ tierId: 'officeIII', ...plannedOfficePlan.offices.officeIII }],
    },
    26: { thirdFbr: {
      chickenFarms: { totalChickenCount: 3_850, slaughtering: true },
      foodPackProduction: { eggs: 41.499, meat: 19.201 },
    } },
    28: {
      resourcePool: 'factory',
      productionTargets: [
        { buildingId: 'AssemblyRoboticT2', recipeId: 'HouseholdAppliancesAssembly', building: 'Assembly V',
          pluralName: 'Assembly V machines', product: 'householdAppliances', target: 2 },
      ],
    },
  },
}

export const getLiveAreaPlans = (saveId: string | null | undefined): LiveAreaPlans => (
  saveId ? liveAreaPlansBySave[saveId] ?? {} : {}
)
