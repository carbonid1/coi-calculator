import { type Module } from "./modules";

export const RESEARCH_MODULE_ID = "research";

export interface ResearchModuleConfig {
  activeResearchLabIvCount: number;
}

export const defaultResearchModuleConfig: ResearchModuleConfig = {
  activeResearchLabIvCount: 2,
};

export const createResearchModule = (config: ResearchModuleConfig): Module => {
  const activeResearchLabIvCount = Math.max(0, Math.trunc(config.activeResearchLabIvCount));
  const builtBuildings = {
    "research-lab-iv": activeResearchLabIvCount,
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
        fixed: ["research-lab-iv"],
      },
    ],
    defaultPresetId: "planning-baseline",
  };
};

export const research = createResearchModule(defaultResearchModuleConfig);
