import { type Recipe } from "../../db/recipes";
import { type ResourceId, resources } from "../../db/resources";
import { typedEntries } from "../typed-entries/typed-entries";

export interface ProductionLine {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
}

export interface ResourceFlow {
  resourceId: ResourceId;
  name: string;
  consumed: number;
  produced: number;
  net: number;
}

export interface RegularResult {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
  pinned: boolean;
  supplyRatio: number;
}

export interface PassiveResult {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
  actualInputs: { resourceId: ResourceId; quantity: number }[];
  actualOutputs: { resourceId: ResourceId; quantity: number }[];
}

type FlowMap = Map<ResourceId, { consumed: number; produced: number }>;

const makeGetFlow = (flows: FlowMap) => (id: ResourceId) => {
  const f = flows.get(id) ?? { consumed: 0, produced: 0 };

  flows.set(id, f);
  return f;
};

export const calculateNet = (lines: ProductionLine[], pinnedIds: Set<string> = new Set(), externalInputs: Partial<Record<ResourceId, number>> = {}) => {
  const regularLines = lines.filter((l) => l.recipe.group !== "source" && l.recipe.group !== "sink");
  const sourceLines = lines.filter((l) => l.recipe.group === "source");
  const sinkLines = lines.filter((l) => l.recipe.group === "sink");

  const pinnedLines = regularLines.filter((l) => pinnedIds.has(l.recipe.id));
  const flexibleLines = regularLines.filter((l) => !pinnedIds.has(l.recipe.id));

  const externalEntries = typedEntries(externalInputs);
  const externalIds = new Set(externalEntries.map(([id]) => id));

  // ── Pass 1: full-capacity simulation to find truly constrained resources ──
  const simFlows: FlowMap = new Map();
  const simGet = makeGetFlow(simFlows);

  // External inputs as virtual sources
  for (const [id, qty] of externalEntries) {
    simGet(id).produced += qty;
  }

  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) {
      simGet(output.resourceId).produced += output.quantity * line.buildingCount;
    }
  }
  for (const line of regularLines) {
    const m = line.buildingCount;

    for (const input of line.recipe.inputs) simGet(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) simGet(output.resourceId).produced += output.quantity * m;
  }

  const constrained = new Set<ResourceId>();

  for (const [id, flow] of simFlows) {
    if (flow.consumed > flow.produced) constrained.add(id);
  }

  // ── Pass 2: actual allocation with priority for constrained resources only ──
  const flows: FlowMap = new Map();
  const getFlow = makeGetFlow(flows);

  // External inputs as virtual sources
  for (const [id, qty] of externalEntries) {
    getFlow(id).produced += qty;
  }

  // Sources at full capacity
  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) {
      getFlow(output.resourceId).produced += output.quantity * line.buildingCount;
    }
  }

  // Pinned buildings at full capacity
  for (const line of pinnedLines) {
    const m = line.buildingCount;

    for (const input of line.recipe.inputs) getFlow(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) getFlow(output.resourceId).produced += output.quantity * m;
  }

  // Flexible buildings — priority allocation only for constrained resources
  const flexibleSupplyRatios = new Map<string, number>();

  for (const line of flexibleLines) {
    if (line.buildingCount === 0) {
      flexibleSupplyRatios.set(line.recipe.id, 0);
      continue;
    }

    let ratio = 1;

    for (const input of line.recipe.inputs) {
      if (!constrained.has(input.resourceId)) continue;
      const f = getFlow(input.resourceId);
      const available = f.produced - f.consumed;
      const needed = input.quantity * line.buildingCount;

      if (needed > 0) {
        ratio = Math.min(ratio, Math.max(0, available / needed));
      }
    }

    flexibleSupplyRatios.set(line.recipe.id, ratio);

    const m = line.buildingCount * ratio;

    for (const input of line.recipe.inputs) getFlow(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) getFlow(output.resourceId).produced += output.quantity * m;
  }

  // Regular results
  const regularResults: RegularResult[] = regularLines.map((line) => ({
    recipe: line.recipe,
    buildingCount: line.buildingCount,
    totalBuildings: line.totalBuildings,
    pinned: pinnedIds.has(line.recipe.id),
    supplyRatio: pinnedIds.has(line.recipe.id) ? 1 : (flexibleSupplyRatios.get(line.recipe.id) ?? 1),
  }));

  // Adjust source output to actual consumption
  const sourceResults: PassiveResult[] = sourceLines.map((line) => {
    const actualOutputs: PassiveResult["actualOutputs"] = [];

    for (const output of line.recipe.outputs) {
      const f = getFlow(output.resourceId);
      const actualUsed = Math.min(output.quantity * line.buildingCount, f.consumed);
      const overproduction = output.quantity * line.buildingCount - actualUsed;

      if (overproduction > 0) f.produced -= overproduction;
      actualOutputs.push({ resourceId: output.resourceId, quantity: actualUsed });
    }
    return {
      recipe: line.recipe,
      buildingCount: line.buildingCount,
      totalBuildings: line.totalBuildings,
      actualInputs: [],
      actualOutputs,
    };
  });

  // Sinks absorb excess (sequential priority)
  const sinkResults: PassiveResult[] = [];

  for (const line of sinkLines) {
    if (line.buildingCount === 0) {
      sinkResults.push({ recipe: line.recipe, buildingCount: 0, totalBuildings: line.totalBuildings, actualInputs: [], actualOutputs: [] });
      continue;
    }

    const capacity = line.buildingCount;
    let utilizationRatio = 1;

    for (const input of line.recipe.inputs) {
      const f = getFlow(input.resourceId);
      const excess = f.produced - f.consumed;

      if (excess <= 0) { utilizationRatio = 0; break; }
      utilizationRatio = Math.min(utilizationRatio, excess / (input.quantity * capacity));
    }

    const actualInputs: PassiveResult["actualInputs"] = [];
    const actualOutputs: PassiveResult["actualOutputs"] = [];

    if (utilizationRatio > 0) {
      for (const input of line.recipe.inputs) {
        const actual = Math.round(input.quantity * capacity * utilizationRatio);

        getFlow(input.resourceId).consumed += actual;
        actualInputs.push({ resourceId: input.resourceId, quantity: actual });
      }
      for (const output of line.recipe.outputs) {
        const actual = Math.round(output.quantity * capacity * utilizationRatio);

        getFlow(output.resourceId).produced += actual;
        actualOutputs.push({ resourceId: output.resourceId, quantity: actual });
      }
    }

    sinkResults.push({ recipe: line.recipe, buildingCount: line.buildingCount, totalBuildings: line.totalBuildings, actualInputs, actualOutputs });
  }

  // Identify source-produced resources
  const sourceResourceIds = new Set<ResourceId>();

  for (const line of sourceLines) {
    for (const output of line.recipe.outputs) sourceResourceIds.add(output.resourceId);
  }

  const resourceFlows: ResourceFlow[] = [];

  for (const [resourceId, { consumed, produced }] of flows) {
    if (externalIds.has(resourceId)) {
      // External inputs: only show deficit beyond declared external supply
      const net = produced - consumed;

      if (net < -0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net });
      }
    } else if (sourceResourceIds.has(resourceId)) {
      // Source resources: only show deficit (from simulation), hide surplus
      if (constrained.has(resourceId)) {
        const sim = simFlows.get(resourceId) ?? { produced: 0, consumed: 0 };
        const deficit = sim.produced - sim.consumed;

        if (deficit < -0.001) {
          resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed: sim.consumed, produced: sim.produced, net: deficit });
        }
      }
    } else {
      const net = produced - consumed;

      if (Math.abs(net) > 0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net });
      }
    }
  }

  return { resourceFlows, regularResults, sourceResults, sinkResults };
};
