import {
  getOfficeRecipeId,
  officeCatalog,
  type OfficePlan,
  resolvedOfficePlan,
} from "../offices";
import { type Module } from "./modules";

export const OFFICES_MODULE_ID = "offices";

export const createOfficesModule = (plan: OfficePlan): Module => {
  const officeRecipeIds = officeCatalog.map((office) => {
    const tierPlan = plan.offices[office.id];

    return {
      count: Math.max(0, Math.trunc(tierPlan.count)),
      recipeId: getOfficeRecipeId(office.id, tierPlan.computingBoostStep),
    };
  });
  const officeSuppliesAssemblyVCount = Math.max(
    0,
    Math.trunc(plan.officeSuppliesAssemblyVCount),
  );
  const builtBuildings = {
    "assembly-v-office-supplies": officeSuppliesAssemblyVCount,
    ...Object.fromEntries(officeRecipeIds.map(({ count, recipeId }) => [recipeId, count])),
  };

  return {
    id: OFFICES_MODULE_ID,
    name: "Offices",
    description: "Office capacity, recurring supplies, and Focus allocation",
    builtBuildings,
    presets: [
      {
        id: "planned-offices",
        name: "Planned Offices",
        description: "Calculator-owned Office and Focus target",
        activeBuildings: builtBuildings,
        fixed: officeRecipeIds.map(({ recipeId }) => recipeId),
      },
    ],
    defaultPresetId: "planned-offices",
  };
};

export const offices = createOfficesModule(resolvedOfficePlan.value);
