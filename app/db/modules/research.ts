import { type Module } from "./modules";

export const RESEARCH_MODULE_ID = "research";

export interface ResearchModuleConfig {
  activeResearchLabIvCount: number;
  mode: "standard" | "space";
}

export const defaultResearchModuleConfig: ResearchModuleConfig = {
  activeResearchLabIvCount: 2,
  mode: "standard",
};

export const createResearchModule = (config: ResearchModuleConfig): Module => {
  const activeResearchLabIvCount = Math.max(0, Math.trunc(config.activeResearchLabIvCount));
  const researchRecipeId = config.mode === "space"
    ? "research-lab-iv-space"
    : "research-lab-iv";
  const builtBuildings = {
    [researchRecipeId]: activeResearchLabIvCount,
    "assembly-v-lab-equipment-i": 1,
    "assembly-v-lab-equipment-ii": 2,
    "assembly-v-lab-equipment-iii": 2,
    "assembly-v-lab-equipment-iv": 3,
  };

  return {
    id: RESEARCH_MODULE_ID,
    name: "Research",
    description: "Research production and active labs",
    builtBuildings,
    presets: [
      {
        id: "planning-baseline",
        name: "Planning baseline",
        description: "Two active labs with a dedicated Lab Equipment I–IV chain",
        activeBuildings: builtBuildings,
        fixed: [researchRecipeId],
      },
    ],
    defaultPresetId: "planning-baseline",
  };
};

export const research = createResearchModule(defaultResearchModuleConfig);
