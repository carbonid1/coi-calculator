import { getCropFarmingData, type CropFarmingDefinitions } from '../../crop-farming-state'
import { allocateCropFarmPlan, type PlannedCropFarmInventory } from '../../helpers/crop-farm-plan/crop-farm-plan'
import { type GroundwaterSourceConstraint } from '../../helpers/groundwater/calculate-groundwater-production'
import {
  crops,
  cropFarmTiers,
  isCropSchedule,
  type CropFarmGroup,
  type CropSchedule,
  type CurrentCropFarmEntity,
} from '../crop-farming'
import {
  applyGroundwaterSourceConstraint,
  createCropFarmRecipe,
  type Recipe,
} from '../recipes'
import { type Module, type Preset } from './modules'

const cropFarmPrototypeIds = new Set(['FarmT3', 'FarmT4'])

const liveAreaModuleId = (zoneId: number) => zoneId === -1
  ? 'general'
  : `live-area-${zoneId}`

export const getCropFarmGroundwaterRecipeId = (zoneId: number) => (
  `${liveAreaModuleId(zoneId)}:LandWaterPump:LandWaterPumping`
)
export const getCropFarmGroundwaterClaimId = (zoneId: number) => (
  `${liveAreaModuleId(zoneId)}:groundwater`
)

const namedZones = (entity: CurrentCropFarmEntity) => (
  (entity.zones ?? []).filter(zone => Boolean(zone.name))
)

export const getCropFarmOwnerZone = (entity: CurrentCropFarmEntity) => (
  namedZones(entity).toSorted((left, right) => left.id - right.id)[0] ?? null
)

export const getCropFarmRelatedZoneIds = (
  entities: readonly CurrentCropFarmEntity[],
) => new Set(entities.flatMap(entity => namedZones(entity).map(zone => zone.id)))

export const getCropFarmOwnerZones = (
  entities: readonly CurrentCropFarmEntity[],
) => [...new Map(entities.flatMap(entity => {
  const owner = getCropFarmOwnerZone(entity)

  return owner ? [[owner.id, owner] as const] : []
})).values()]

const cropFarmGroupId = (
  moduleId: string,
  entity: CurrentCropFarmEntity,
  schedule: CropSchedule,
) => [
  moduleId,
  'crop-farm',
  entity.tierId,
  schedule.join('-'),
  `fertility-${entity.fertilityTargetPercent}`,
  `fertilizer-${entity.fertilizerId ?? 'none'}`,
].join(':')

const cropFarmGroupKey = (
  entity: CurrentCropFarmEntity,
  schedule: CropSchedule,
) => [
  entity.tierId,
  schedule.join('/'),
  entity.fertilityTargetPercent,
  entity.fertilizerId,
].join('|')

const withoutGenericCropFarmIssues = (module: Module) => module.liveArea
  ? {
      ...module.liveArea,
      issues: module.liveArea.issues.filter(issue => (
        ![...cropFarmPrototypeIds].some(prototypeId => (
          issue.id.startsWith(`${prototypeId}:`)
        ))
      )),
    }
  : undefined

type CropFarmGroupInventory = Pick<PlannedCropFarmInventory, 'group' | 'built' | 'running'>
  & Partial<Pick<PlannedCropFarmInventory, 'currentActive' | 'source' | 'mismatch'>>

type CropFarmStatus = 'unconfigured' | 'unsupported-crop'

interface CropFarmStatusInventory {
  recipe: Recipe
  built: number
  running: number
}

const cropFarmStatusRecipe = (
  moduleId: string,
  entity: CurrentCropFarmEntity,
  status: CropFarmStatus,
): Recipe => ({
  id: `${moduleId}:crop-farm-status:${entity.tierId}:${status}`,
  name: status === 'unconfigured'
    ? 'No crop rotation'
    : 'Unsupported crop rotation',
  building: cropFarmTiers[entity.tierId].name,
  group: 'production',
  inputs: [],
  outputs: [],
})

const attachCropFarms = (
  module: Module,
  allEntities: readonly CurrentCropFarmEntity[],
  definitions: CropFarmingDefinitions,
  ownerZoneId: number | null,
  groundwaterConstraint?: GroundwaterSourceConstraint,
  plan?: readonly CropFarmGroup[],
): Module => {
  const ownsEntity = (entity: CurrentCropFarmEntity) => (
    getCropFarmOwnerZone(entity)?.id ?? null
  ) === ownerZoneId
  const ownedEntities = allEntities.filter(ownsEntity)
  const inventoryPreset = module.presets.find(preset => preset.id === module.defaultPresetId)
    ?? module.presets[0]
  const planned = allocateCropFarmPlan(module.id, ownedEntities, plan ?? [], {
    greenhouse: inventoryPreset?.capacityPools?.FarmT3?.constructionGhosts ?? 0,
    greenhouseII: inventoryPreset?.capacityPools?.FarmT4?.constructionGhosts ?? 0,
  })
  const entities = planned.remaining
  const liveArea = withoutGenericCropFarmIssues(module)

  const grouped = new Map<string, CropFarmGroupInventory>()
  const statuses = new Map<string, CropFarmStatusInventory>()
  const issueCounts = {
    fertilizerLimit: 0,
    overlappingAreas: 0,
    unidentifiedFertilizer: 0,
    unsupportedCrop: 0,
  }

  const recordStatus = (
    entity: CurrentCropFarmEntity,
    status: CropFarmStatus,
  ) => {
    if (liveArea) return

    const recipe = cropFarmStatusRecipe(module.id, entity, status)
    const existing = statuses.get(recipe.id)

    if (existing) {
      existing.built++
      existing.running += Number(entity.running)
    } else {
      statuses.set(recipe.id, {
        recipe,
        built: 1,
        running: Number(entity.running),
      })
    }
  }

  for (const entity of entities) {
    const schedule = entity.schedule

    if (schedule.length === 0) {
      recordStatus(entity, 'unconfigured')
      continue
    }
    if (!isCropSchedule(schedule)) {
      issueCounts.unsupportedCrop++
      recordStatus(entity, 'unsupported-crop')
      continue
    }

    if (namedZones(entity).length > 1) issueCounts.overlappingAreas++
    if (entity.fertilityTargetPercent > 0 && !entity.fertilizerId) {
      issueCounts.unidentifiedFertilizer++
    }
    if (
      entity.fertilizerId
      && entity.fertilityTargetPercent
        > getCropFarmingData(definitions).fertilizer(entity.fertilizerId).maximumFertilityPercent
    ) {
      issueCounts.fertilizerLimit++
    }

    const key = cropFarmGroupKey(entity, schedule)
    const existing = grouped.get(key)

    if (existing) {
      existing.built++
      existing.running += Number(entity.running)
      if (entity.running && entity.runtime) existing.group.currentFarms?.push({ schedule, runtime: entity.runtime })
      continue
    }

    const fertilizer = entity.fertilizerId && entity.fertilityTargetPercent > 0
      ? {
          id: entity.fertilizerId,
          targetFertilityPercent: entity.fertilityTargetPercent,
        }
      : null
    const name = schedule.map(cropId => crops[cropId].name).join(' / ')

    grouped.set(key, {
      group: {
        id: cropFarmGroupId(module.id, entity, schedule),
        name,
        farmCount: 1,
        tierId: entity.tierId,
        schedule,
        fertilizer,
        currentFarms: entity.running && entity.runtime ? [{ schedule, runtime: entity.runtime }] : [],
      },
      built: 1,
      running: Number(entity.running),
    })
  }

  for (const inventory of planned.inventories) grouped.set(inventory.group.id, inventory)

  const farmRecipes = [...grouped.values()].map(inventory => {
    inventory.group.farmCount = Math.max(inventory.built, inventory.running)

    return createCropFarmRecipe(inventory.group, definitions)
  })
  const statusRecipes = [...statuses.values()].map(inventory => inventory.recipe)
  const addedRecipes = [...farmRecipes, ...statusRecipes]
  const recipeIds = addedRecipes.map(recipe => recipe.id)
  const builtBuildings = Object.fromEntries(
    [
      ...[...grouped.values()].map(inventory => [
        inventory.group.id,
        inventory.built,
      ] as const),
      ...[...statuses.values()].map(inventory => [
        inventory.recipe.id,
        inventory.built,
      ] as const),
    ],
  )
  const activeBuildings = Object.fromEntries(
    [
      ...[...grouped.values()].map(inventory => [
        inventory.group.id,
        inventory.running,
      ] as const),
      ...[...statuses.values()].map(inventory => [
        inventory.recipe.id,
        inventory.running,
      ] as const),
    ],
  )
  const dataSources = Object.fromEntries(recipeIds.map(recipeId => [
    recipeId,
    grouped.get(recipeId)?.source ?? 'synced' as const,
  ])) satisfies NonNullable<Preset['dataSources']>
  const currentActiveBuildings = {
    ...activeBuildings,
    ...Object.fromEntries(planned.inventories.map(inventory => [
      inventory.group.id, inventory.currentActive,
    ])),
  }
  const recipes = [...new Map([
    ...(module.recipes ?? []).map(recipe => [recipe.id, recipe] as const),
    ...addedRecipes.map(recipe => [recipe.id, recipe] as const),
  ]).values()].map(recipe => {
    if (recipe.id !== getCropFarmGroundwaterRecipeId(ownerZoneId ?? -1)) return recipe

    const groundwaterRecipe = {
      ...recipe,
      group: 'source' as const,
      sourceMode: 'module-demand-capped' as const,
      sourceKind: 'groundwater' as const,
    }

    return groundwaterConstraint
      ? applyGroundwaterSourceConstraint(groundwaterRecipe, groundwaterConstraint)
      : groundwaterRecipe
  })
  const issues = liveArea ? [
    ...liveArea.issues,
    ...(issueCounts.unsupportedCrop > 0 ? [{
      id: 'crop-farms:unsupported-crop',
      building: 'Crop farms',
      count: issueCounts.unsupportedCrop,
      message: 'The configured crop is not supported.',
    }] : []),
    ...(issueCounts.unidentifiedFertilizer > 0 ? [{
      id: 'crop-farms:unidentified-fertilizer',
      building: 'Crop farms',
      count: issueCounts.unidentifiedFertilizer,
      message: 'The supplied fertilizer is not identified.',
    }] : []),
    ...(issueCounts.fertilizerLimit > 0 ? [{
      id: 'crop-farms:fertilizer-limit',
      building: 'Crop farms',
      count: issueCounts.fertilizerLimit,
      message: 'The supplied fertilizer cannot reach the configured fertility target.',
    }] : []),
    ...(issueCounts.overlappingAreas > 0 ? [{
      id: 'crop-farms:overlapping-areas',
      building: 'Crop farms',
      count: issueCounts.overlappingAreas,
      message: 'These farms overlap multiple vehicle areas.',
    }] : []),
  ] : []

  return {
    ...module,
    includedInFactoryTotals: true,
    builtBuildings: {
      ...module.builtBuildings,
      ...builtBuildings,
    },
    recipes,
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: {
        ...preset.builtBuildings,
        ...builtBuildings,
      },
      activeBuildings: {
        ...preset.activeBuildings,
        ...activeBuildings,
      },
      currentActiveBuildings: {
        ...preset.currentActiveBuildings,
        ...currentActiveBuildings,
      },
      dataSources: {
        ...preset.dataSources,
        ...dataSources,
      },
      fixed: [...new Set([...preset.fixed, ...recipeIds])],
      planMismatches: [
        ...(preset.planMismatches ?? []),
        ...planned.inventories.flatMap(inventory => inventory.mismatch ? [inventory.mismatch] : []),
      ],
      unplacedPlannedBuildings: {
        ...preset.unplacedPlannedBuildings,
        ...Object.fromEntries(planned.inventories.flatMap(inventory => (
          inventory.running > inventory.built + inventory.constructionGhosts
            ? [[inventory.group.id, inventory.running - inventory.built - inventory.constructionGhosts]]
            : []
        ))),
      },
      constructionGhosts: {
        ...preset.constructionGhosts,
        ...Object.fromEntries(planned.inventories.filter(inventory => inventory.constructionGhosts > 0)
          .map(inventory => [inventory.group.id, inventory.constructionGhosts])),
      },
    })),
    liveArea: liveArea ? { ...liveArea, issues } : undefined,
  }
}

export const createCropFarmAreaModule = (
  generatedArea: Module,
  entities: readonly CurrentCropFarmEntity[],
  definitions: CropFarmingDefinitions,
  groundwaterConstraint?: GroundwaterSourceConstraint,
  plan?: readonly CropFarmGroup[],
) => {
  const zoneId = generatedArea.liveArea?.zoneId

  return zoneId === undefined
    ? generatedArea
    : attachCropFarms(generatedArea, entities, definitions, zoneId, groundwaterConstraint, plan)
}

export const createDefaultCropFarmModule = (
  defaultModule: Module,
  entities: readonly CurrentCropFarmEntity[],
  definitions: CropFarmingDefinitions,
  groundwaterConstraint?: GroundwaterSourceConstraint,
) => attachCropFarms(defaultModule, entities, definitions, null, groundwaterConstraint)
