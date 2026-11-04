import { officeCatalog } from '../../db/office-catalog';
import { type Recipe } from '../../db/recipes';
import { getOfficeDefinition, type OfficeFocusDefinitions } from '../../office-focus-state';
import { resolveSyncedResourceId } from '../synced-resources/synced-resources';

export const withOfficeDefinition = (recipe: Recipe, definitions?: OfficeFocusDefinitions): Recipe => {
  if (!recipe.officeConfiguration) return recipe;
  const { tierId, boostStep } = recipe.officeConfiguration;
  const binding = officeCatalog.find(office => office.id === tierId);

  if (!definitions || !binding || !recipe.buildingData) throw new Error(`Office definition unavailable for ${recipe.id}`);
  const office = getOfficeDefinition(definitions, binding.prototypeId);
  const boost = office.boosts[boostStep];
  const resourceId = resolveSyncedResourceId({ productId: office.suppliesProductId, name: office.suppliesProductId });

  if (!boost || !resourceId) throw new Error(`Office configuration unavailable for ${recipe.id}`);
  return { ...recipe,
    officeConfiguration: undefined,
    inputs: [{ resourceId, quantity: office.suppliesPerCycle }],
    computingMultiplier: 1,
    buildingData: { ...recipe.buildingData, computingTflops: boost.computingTflops },
  };
};
