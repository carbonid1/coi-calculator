import { type Module } from "./modules";

export const nuclearStation: Module = {
  id: "nuclear-station",
  name: "Nuclear Station",
  description: "FBR power generation with hydrogen production and desalination",
  builtBuildings: {
    "seawater-pump": 4,
    "fbr": 1,
    "turbine-super": 2,
    "turbine-high": 2,
    "turbine-low": 2,
    "thermal-desalinator-depleted": 2,
    "thermal-desalinator-super": 6,
    "hydrogen-reformer-super": 2,
    "cooling-tower-large-depleted": 1,
    "cooling-tower-large-super": 1,
  },
  presets: [
    {
      id: "hydrogen",
      name: "Hydrogen Mode",
      description: "1 turbine active per tier, super steam → hydrogen + desalination",
      activeBuildings: {
        "turbine-super": 1,
        "turbine-high": 1,
        "turbine-low": 1,
      },
      fixed: ["fbr", "turbine-super", "turbine-high", "turbine-low"],
    },
    {
      id: "hydrogen-full",
      name: "Hydrogen Full",
      description: "Turbines idle, H2 full, excess super steam → cooling tower",
      activeBuildings: {
        "turbine-super": 1,
        "turbine-high": 1,
        "turbine-low": 1,
        "hydrogen-reformer-super": 0,
      },
      fixed: ["fbr", "turbine-super", "turbine-high", "turbine-low", "hydrogen-reformer-super"],
    },
    {
      id: "max-electricity",
      name: "Max Electricity",
      description: "Turbines full, all super steam → shaft → depleted",
      activeBuildings: {
        "thermal-desalinator-super": 0,
        "hydrogen-reformer-super": 0,
      },
      fixed: ["fbr", "turbine-super", "turbine-high", "turbine-low"],
    },
  ],
  defaultPresetId: "hydrogen",
};
