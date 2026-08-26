import { type BuildingDiagnostic } from "../building-diagnostics/building-diagnostics";

export interface PlannedBuildSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  built: number;
  target: number;
  count: number;
  diagnostic: BuildingDiagnostic;
}

export interface PlannedConfigurationSummary {
  key: string;
  moduleName: string;
  buildingName: string;
  count: number;
  diagnostic: BuildingDiagnostic;
}

const EPSILON = 0.001;

export const getPlannedBuildSummaries = (
  diagnostics: BuildingDiagnostic[],
): PlannedBuildSummary[] => {
  const summaries = new Map<string, PlannedBuildSummary>();

  for (const diagnostic of diagnostics) {
    if (
      !diagnostic.plannedCapacity
      || diagnostic.active <= diagnostic.built + EPSILON
    ) continue;

    const key = `${diagnostic.moduleId}:${diagnostic.buildingName}`;
    const count = Math.ceil(diagnostic.active - diagnostic.built - EPSILON);
    const current = summaries.get(key);

    summaries.set(key, {
      key,
      moduleName: diagnostic.moduleName,
      buildingName: diagnostic.buildingName,
      built: (current?.built ?? 0) + diagnostic.built,
      target: (current?.target ?? 0) + diagnostic.built + count,
      count: (current?.count ?? 0) + count,
      diagnostic: current?.diagnostic ?? diagnostic,
    });
  }

  return [...summaries.values()].toSorted((a, b) => (
    a.moduleName.localeCompare(b.moduleName)
    || a.buildingName.localeCompare(b.buildingName)
  ));
};

export const getPlannedConfigurationSummaries = (
  diagnostics: BuildingDiagnostic[],
): PlannedConfigurationSummary[] => {
  const summaries = new Map<string, PlannedConfigurationSummary>();

  for (const diagnostic of diagnostics) {
    if (
      !diagnostic.plannedCapacity
      || diagnostic.active <= EPSILON
      || diagnostic.active > diagnostic.built + EPSILON
    ) continue;

    const key = `${diagnostic.moduleId}:${diagnostic.buildingName}`;
    const current = summaries.get(key);

    summaries.set(key, {
      key,
      moduleName: diagnostic.moduleName,
      buildingName: diagnostic.buildingName,
      count: (current?.count ?? 0) + Math.ceil(diagnostic.active - EPSILON),
      diagnostic: current?.diagnostic ?? diagnostic,
    });
  }

  return [...summaries.values()].toSorted((a, b) => (
    a.moduleName.localeCompare(b.moduleName)
    || a.buildingName.localeCompare(b.buildingName)
  ));
};
