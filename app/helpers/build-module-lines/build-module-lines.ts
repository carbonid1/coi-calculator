import { getBuildingData } from '../../db/buildings';
import { type Module, type Preset } from "../../db/modules/modules";
import { recipes } from "../../db/recipes";
import { getConnectionOnlyResourceIds, getFactoryResourceRequests } from "../../db/resource-supply";
import { settlementRecipeIds } from '../../db/settlement';
import { type ProductionLine } from "../calculate/calculate";
import { getRecipeOutputQuantity, withRecipeRecycling, type RecipeModifierMultipliers } from "../modifiers/recipe-output";
import { withOfficeDefinition } from '../office-recipes/office-recipes';
import { withFactoryDefinition } from '../planning-recipes/factory-recipes';
import { withPlanningDefinition } from '../planning-recipes/planning-recipes';
import { withModuleInputLimits } from "../recipe-input-scope/recipe-input-scope";
import { canPrioritizeProcessing } from "../resource-priorities/resource-priorities";

export const buildModuleLines = (
  mod: Module,
  preset: Preset | null,
  outputModifiers: RecipeModifierMultipliers = {},
): { lines: ProductionLine[] } => {
  const builtBuildings = preset?.builtBuildings ?? mod.builtBuildings;
  const availableRecipes = [...new Map(
    [...recipes, ...(mod.recipes ?? [])].map(recipe => [recipe.id, recipe]),
  ).values()];
  const visibleRecipes = availableRecipes.filter((recipe) => (
    recipe.id in builtBuildings
    || Boolean(preset && recipe.id in preset.activeBuildings)
  ));
  const requestedImportIds = new Set(
    Object.entries(getFactoryResourceRequests(preset?.requestedImports))
      .filter(([, quantity]) => (quantity ?? 0) > 0)
      .map(([resourceId]) => resourceId),
  );
  const fixedIds = preset ? new Set(preset.fixed) : new Set<string>();

  const lines: ProductionLine[] = visibleRecipes.map((templateRecipe) => {
    const unmodifiedRecipe = withFactoryDefinition(withPlanningDefinition(templateRecipe, outputModifiers.planningDefinitions), outputModifiers.planningDefinitions, outputModifiers.spaceResearch);
    const isResident = unmodifiedRecipe.id === settlementRecipeIds.residents || unmodifiedRecipe.id === settlementRecipeIds.residentsII;
    const buildingData = (isResident ? unmodifiedRecipe.buildingData : undefined) ?? (outputModifiers.buildingDefinitions
      ? getBuildingData(unmodifiedRecipe.building, outputModifiers.buildingDefinitions, unmodifiedRecipe.gameBuildingId)
      : undefined) ?? unmodifiedRecipe.buildingData;

    if (outputModifiers.buildingDefinitions && !buildingData) {
      throw new Error(`Building requirements unavailable for ${unmodifiedRecipe.gameBuildingId ?? unmodifiedRecipe.building}`);
    }
    const originalRecipe = withRecipeRecycling(withOfficeDefinition(buildingData
      ? { ...unmodifiedRecipe, buildingData } : unmodifiedRecipe, outputModifiers.officeFocusDefinitions), outputModifiers);
    // Apply routing to static presets as well as recipes generated from a snapshot.
    const localInputIds = getConnectionOnlyResourceIds(originalRecipe.inputs.map(input => input.resourceId));
    const scopedRecipe = withModuleInputLimits(originalRecipe, localInputIds);
    const localFirstInputIds = originalRecipe.inputs.map(input => input.resourceId).filter(resourceId => (
      preset?.resourceProcessingPriorities?.[resourceId] === "local-first"
      && canPrioritizeProcessing(originalRecipe, resourceId)
      && !fixedIds.has(originalRecipe.id)
      && !localInputIds.includes(resourceId)
    ));
    const recipe = localFirstInputIds.length > 0 ? {
      ...scopedRecipe,
      inputPriorities: {
        ...scopedRecipe.inputPriorities,
        ...Object.fromEntries(localFirstInputIds.map(resourceId => [
          resourceId, scopedRecipe.inputPriorities?.[resourceId] ?? -1,
        ])),
      },
    } : scopedRecipe;
    const built = builtBuildings[recipe.id] ?? 0;
    const speedLevel = preset?.speedLevels?.[recipe.id] ?? 1;
    const active = Math.max(
      0,
      preset && recipe.id in preset.activeBuildings
        ? (preset.activeBuildings[recipe.id] ?? built)
        : built,
    );
    const targetRatios = recipe.outputs.flatMap((output) => {
      const target = preset?.recipeOutputTargets?.[recipe.id]?.[output.resourceId]
        ?? preset?.outputTargets?.[output.resourceId];

      if (target == null) return [];

      const outputCapacity = getRecipeOutputQuantity(recipe, output, outputModifiers) * speedLevel;

      return outputCapacity > 0 ? [target / outputCapacity] : [];
    });
    const fixedTotalOperationRatio = (
      fixedIds.has(recipe.id)
      && recipe.fixedTotalOperation
      && active > 0
    ) ? 1 / active : undefined;
    const allocationRatio = fixedTotalOperationRatio ?? (
      targetRatios.length > 0 && active > 0
        ? Math.min(1, Math.max(...targetRatios) / active)
        : undefined
    );
    const capacityPool = recipe.sharedCapacity
      ? preset?.capacityPools?.[recipe.sharedCapacity.id]
      : undefined;
    const constructionGhosts = preset?.constructionGhosts?.[recipe.id] ?? 0;
    const unplacedPlannedBuildings = preset?.unplacedPlannedBuildings?.[recipe.id] ?? 0;
    const plannedCurrent = preset?.planMismatches?.find(mismatch => (
      mismatch.recipeId === recipe.id && mismatch.format === "count"
    ))?.current;
    const currentActive = Math.max(0, Math.min(
      built,
      preset?.currentActiveBuildings?.[recipe.id]
        ?? plannedCurrent
        ?? active - constructionGhosts - unplacedPlannedBuildings,
    ));
    const drivingInputIds = recipe.inputs
      .map(input => input.resourceId)
      .filter(resourceId => requestedImportIds.has(resourceId));
    const processingLink = mod.processingLinks?.find(link => link.targetRecipeId === recipe.id);

    return {
      recipe,
      processingInput: processingLink ? {
        id: processingLink.id, sourceRecipeId: processingLink.sourceRecipeId, resourceId: processingLink.resourceId,
      } : undefined,
      localFirstInputIds,
      moduleId: mod.id,
      dataSource: preset?.dataSources?.[recipe.id],
      capacityPoolId: recipe.sharedCapacity
        ? `${mod.id}:${recipe.sharedCapacity.id}`
        : undefined,
      capacityPoolActiveBuildings: capacityPool?.active,
      capacityPoolBuiltBuildings: capacityPool?.built,
      capacityPoolCurrentActiveBuildings: capacityPool?.currentActive,
      capacityPoolConstructionGhosts: capacityPool?.constructionGhosts,
      capacityPoolUnplacedPlannedBuildings: capacityPool?.unplacedPlanned,
      activeBuildings: active,
      currentActiveBuildings: currentActive,
      builtBuildings: built,
      constructionGhosts,
      unplacedPlannedBuildings,
      speedLevel,
      operatingMode: fixedIds.has(recipe.id) ? "fixed" : "balanced",
      allocationRatio,
      autoBalanceOffBuildings: preset?.autoBalanceOffBuildings?.[recipe.id],
      hasOutputTarget: targetRatios.length > 0 && allocationRatio != null,
      drivingInputIds: drivingInputIds.length > 0 ? drivingInputIds : undefined,
    };
  });

  return { lines };
};
