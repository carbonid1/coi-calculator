import {
  type Module,
  type PlanMismatchAction,
} from "../../db/modules/modules";
import { type BuildingDiagnostic } from "../building-diagnostics/building-diagnostics";

export interface PlannedBuildSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  built: number;
  target: number;
  count: number;
  diagnostic: BuildingDiagnostic;
}

export interface PlannedConfigurationSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  count: number;
  diagnostic: BuildingDiagnostic;
}

export interface PlannedFollowUpSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  action: "pause";
  count: number;
  note: string;
  diagnostic: BuildingDiagnostic;
}

export interface PlanMismatchSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  recipeName: string;
  current: number;
  currentSource: "default" | "modeled" | "synced";
  target: number;
  direction: "at-least" | "at-most";
  format: "count" | "level" | "animals" | "configuration";
  currentLabel?: string;
  targetLabel?: string;
  actions: PlanMismatchAction[];
  diagnostic: BuildingDiagnostic;
}

const EPSILON = 0.001;

export const getPlannedBuildSummaries = (
  diagnostics: BuildingDiagnostic[],
): PlannedBuildSummary[] => diagnostics.flatMap((diagnostic) => {
  if (
    !diagnostic.plannedCapacity
    || diagnostic.active <= diagnostic.built + EPSILON
  ) return [];

  const count = Math.ceil(diagnostic.active - diagnostic.built - EPSILON);

  return [{
    key: diagnostic.key,
    moduleName: diagnostic.moduleName,
    buildingName: diagnostic.buildingName,
    recipeName: diagnostic.recipeName,
    built: diagnostic.built,
    target: diagnostic.built + count,
    count,
    diagnostic,
  }];
}).toSorted((a, b) => (
    a.moduleName.localeCompare(b.moduleName)
    || a.buildingName.localeCompare(b.buildingName)
    || a.recipeName.localeCompare(b.recipeName)
  ));

export const getPlannedConfigurationSummaries = (
  diagnostics: BuildingDiagnostic[],
): PlannedConfigurationSummary[] => diagnostics.flatMap((diagnostic) => {
  if (
    !diagnostic.plannedCapacity
    || diagnostic.active <= EPSILON
    || diagnostic.active > diagnostic.built + EPSILON
  ) return [];

  return [{
    key: diagnostic.key,
    moduleName: diagnostic.moduleName,
    buildingName: diagnostic.buildingName,
    recipeName: diagnostic.recipeName,
    count: Math.ceil(diagnostic.active - EPSILON),
    diagnostic,
  }];
}).toSorted((a, b) => (
    a.moduleName.localeCompare(b.moduleName)
    || a.buildingName.localeCompare(b.buildingName)
    || a.recipeName.localeCompare(b.recipeName)
  ));

export const getPlannedFollowUpSummaries = (
  modules: Module[],
  diagnostics: BuildingDiagnostic[],
): PlannedFollowUpSummary[] => modules.flatMap((module) => {
  if (!module.defaultPresetId || module.includedInFactoryTotals === false) return [];

  const preset = module.presets.find(({ id }) => id === module.defaultPresetId);

  return (preset?.plannedFollowUps ?? []).flatMap((followUp) => {
    const diagnostic = diagnostics.find((candidate) => (
      candidate.key === `${module.id}:${followUp.recipeId}`
    ));

    if (!diagnostic) return [];

    return [{
      key: `${module.id}:${followUp.id}`,
      moduleName: module.name,
      buildingName: diagnostic.buildingName,
      recipeName: diagnostic.recipeName,
      action: followUp.action,
      count: followUp.count,
      note: followUp.note,
      diagnostic,
    }];
  });
}).toSorted((a, b) => (
  a.moduleName.localeCompare(b.moduleName)
  || a.buildingName.localeCompare(b.buildingName)
  || a.recipeName.localeCompare(b.recipeName)
));

export const getPlanMismatchSummaries = (
  modules: Module[],
  diagnostics: BuildingDiagnostic[],
): PlanMismatchSummary[] => modules.flatMap((module) => {
  if (!module.defaultPresetId || module.includedInFactoryTotals === false) return [];

  const preset = module.presets.find(({ id }) => id === module.defaultPresetId);

  return (preset?.planMismatches ?? []).flatMap((mismatch) => {
    const key = `${module.id}:${mismatch.recipeId}`;
    const diagnostic = diagnostics.find((candidate) => candidate.key === key);

    if (!diagnostic) return [];

    return [{
      key,
      moduleName: module.name,
      buildingName: diagnostic.buildingName,
      recipeName: diagnostic.recipeName,
      ...mismatch,
      diagnostic,
    }];
  });
}).toSorted((a, b) => (
  a.moduleName.localeCompare(b.moduleName)
  || a.buildingName.localeCompare(b.buildingName)
  || a.recipeName.localeCompare(b.recipeName)
));
