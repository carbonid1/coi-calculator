import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  getOfficeRecipeId,
  officeCatalog,
  type OfficePlan,
  resolvedCurrentOfficePlan,
  resolvedOfficePlan,
} from "../offices";
import { type Module } from "./modules";

export const OFFICES_MODULE_ID = "offices";

export const createOfficesModule = (
  plan: OfficePlan,
  builtPlan: OfficePlan = plan,
  dataSource: ValueSource = "modeled",
): Module => {
  const officeRecipeIds = officeCatalog.map((office) => {
    const tierPlan = plan.offices[office.id];

    return {
      count: Math.max(0, Math.trunc(tierPlan.count)),
      recipeId: getOfficeRecipeId(office.id, tierPlan.computingBoostStep),
      tierId: office.id,
    };
  });
  const officeSuppliesAssemblyVCount = Math.max(
    0,
    Math.trunc(plan.officeSuppliesAssemblyVCount),
  );
  const plannedBuildings = {
    "assembly-v-office-supplies": officeSuppliesAssemblyVCount,
    ...Object.fromEntries(officeRecipeIds.map(({ count, recipeId }) => [recipeId, count])),
  };
  const builtBuildings = {
    "assembly-v-office-supplies": Math.max(
      0,
      Math.trunc(builtPlan.officeSuppliesAssemblyVCount),
    ),
    ...Object.fromEntries(officeRecipeIds.map(({ recipeId, tierId }) => [
      recipeId,
      Math.max(0, Math.trunc(builtPlan.offices[tierId].count)),
    ])),
  };

  return {
    id: OFFICES_MODULE_ID,
    name: "Offices",
    description: "Office capacity, recurring supplies, and Focus allocation",
    builtBuildings,
    presets: [
      {
        id: "planned-offices",
        name: "Office configuration",
        description: "Office buildings, supplies, and Focus settings",
        activeBuildings: plannedBuildings,
        dataSources: Object.fromEntries(
          Object.keys(plannedBuildings).map((recipeId) => [recipeId, dataSource]),
        ),
        fixed: officeRecipeIds.map(({ recipeId }) => recipeId),
      },
    ],
    defaultPresetId: "planned-offices",
  };
};

export const offices = createOfficesModule(
  resolvedOfficePlan.value,
  resolvedCurrentOfficePlan.value,
  resolvedOfficePlan.source,
);
