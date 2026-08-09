import { baseConfig } from "../../db/config";
import { type Recipe } from "../../db/recipes";
import { type ResourceId, resources } from "../../db/resources";
import { getRecipeOutputQuantity, type OutputModifierMultipliers } from "../modifiers/recipe-output";
import { typedEntries } from "../typed-entries/typed-entries";

export interface ProductionLine {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
  speedLevel: number;
  operatingMode: OperatingMode;
}

export interface ResourceFlow {
  resourceId: ResourceId;
  name: string;
  consumed: number;
  produced: number;
  net: number;
  /** Hidden source-product value retained when Recyclables were created. */
  recyclableSourceValueProduced?: number;
}

export type OperatingMode = "fixed" | "balanced";

export interface RegularResult {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
  operatingMode: OperatingMode;
  supplyRatio: number;
  speedLevel: number;
  appliedRecyclingEfficiencyPercent: number | null;
}

export interface PassiveResult {
  recipe: Recipe;
  buildingCount: number;
  totalBuildings: number;
  actualInputs: { resourceId: ResourceId; quantity: number }[];
  actualOutputs: { resourceId: ResourceId; quantity: number }[];
}

const lineFactor = (line: ProductionLine) => line.buildingCount * line.speedLevel;

const orderDemandBalancedLines = (lines: ProductionLine[]) => {
  const ordered: ProductionLine[] = [];
  const visiting = new Set<ProductionLine>();
  const visited = new Set<ProductionLine>();

  const visit = (line: ProductionLine) => {
    if (visited.has(line) || visiting.has(line)) return;

    visiting.add(line);
    const outputIds = new Set(line.recipe.outputs.map((output) => output.resourceId));

    for (const possibleConsumer of lines) {
      if (
        possibleConsumer !== line
        && possibleConsumer.recipe.inputs.some((input) => outputIds.has(input.resourceId))
      ) {
        visit(possibleConsumer);
      }
    }

    visiting.delete(line);
    visited.add(line);
    ordered.push(line);
  };

  for (const line of lines) visit(line);

  return ordered;
};

export const getAppliedRecyclingEfficiencyPercent = (recipe: Recipe, globalEfficiencyPercent: number) => {
  const createsRecyclables = recipe.outputs.some((output) => output.resourceId === "recyclables");

  if (!createsRecyclables) return null;

  return recipe.appliesRecyclingEfficiency === false
    ? 100
    : Math.min(100, Math.max(0, globalEfficiencyPercent));
};

type FlowMap = Map<ResourceId, { consumed: number; produced: number }>;

const makeGetFlow = (flows: FlowMap) => (id: ResourceId) => {
  const f = flows.get(id) ?? { consumed: 0, produced: 0 };

  flows.set(id, f);
  return f;
};

export const calculateNet = (
  lines: ProductionLine[],
  externalInputs: Partial<Record<ResourceId, number>> = {},
  recyclingEfficiencyPercent: number = baseConfig.recyclingEfficiencyPercent,
  outputModifiers: OutputModifierMultipliers = {},
) => {
  const regularLines = lines.filter((l) => l.recipe.group !== "source" && l.recipe.group !== "sink");
  const sourceLines = lines.filter((l) => l.recipe.group === "source");
  const sinkLines = lines.filter((l) => l.recipe.group === "sink");

  const fixedLines = regularLines.filter((line) => line.operatingMode === "fixed");
  const balancedLines = regularLines.filter((line) => line.operatingMode === "balanced");
  const supplyBalancedLines = balancedLines.filter((line) => line.recipe.balanceBy !== "output");
  const demandBalancedLines = orderDemandBalancedLines(
    balancedLines.filter((line) => line.recipe.balanceBy === "output"),
  );

  const externalEntries = typedEntries(externalInputs);
  const externalIds = new Set(externalEntries.map(([id]) => id));
  const internallyProducedIds = new Set(
    lines.flatMap((line) => line.recipe.outputs.map((output) => output.resourceId)),
  );

  // ── Pass 1: full-capacity simulation to find truly constrained resources ──
  const simFlows: FlowMap = new Map();
  const simGet = makeGetFlow(simFlows);

  // External inputs as virtual sources
  for (const [id, qty] of externalEntries) {
    simGet(id).produced += qty;
  }

  for (const line of sourceLines) {
    const m = lineFactor(line);

    for (const output of line.recipe.outputs) {
      simGet(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }
  for (const line of regularLines) {
    const m = lineFactor(line);

    for (const input of line.recipe.inputs) simGet(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) {
      simGet(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }

  const constrained = new Set<ResourceId>();

  for (const [id, flow] of simFlows) {
    if (
      flow.consumed > flow.produced
      && (internallyProducedIds.has(id) || externalIds.has(id))
    ) {
      constrained.add(id);
    }
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
    const m = lineFactor(line);

    for (const output of line.recipe.outputs) {
      getFlow(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }

  // Fixed buildings run at their configured capacity.
  for (const line of fixedLines) {
    const m = lineFactor(line);

    for (const input of line.recipe.inputs) getFlow(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) {
      getFlow(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }

  // Supply-balanced consumers run first so demand-balanced producers can see
  // their actual deficits. Demand-balanced chains run downstream-to-upstream.
  const balancedSupplyRatios = new Map<ProductionLine, number>();

  for (const line of [...supplyBalancedLines, ...demandBalancedLines]) {
    if (line.buildingCount === 0) {
      balancedSupplyRatios.set(line, 0);
      continue;
    }

    const factor = lineFactor(line);
    let ratio = 1;

    for (const input of line.recipe.inputs) {
      if (line.recipe.balanceBy !== "input" && !constrained.has(input.resourceId)) continue;
      const f = getFlow(input.resourceId);
      const available = f.produced - f.consumed;
      const needed = input.quantity * factor;

      if (needed > 0) {
        ratio = Math.min(ratio, Math.max(0, available / needed));
      }
    }

    // Explicit load balancers run only enough to cover the largest outstanding
    // co-product deficit; outputs with no downstream consumer remain unrestricted.
    if (line.recipe.balanceBy === "output") {
      const outputDemandRatios = line.recipe.outputs.flatMap((output) => {
        const flow = flows.get(output.resourceId);
        const capacity = getRecipeOutputQuantity(line.recipe, output, outputModifiers) * factor;

        if (!flow || flow.consumed <= 0 || capacity <= 0) return [];

        return [Math.max(0, flow.consumed - flow.produced) / capacity];
      });

      if (outputDemandRatios.length > 0) {
        ratio = Math.min(ratio, Math.max(...outputDemandRatios));
      }
    }

    balancedSupplyRatios.set(line, ratio);

    const m = factor * ratio;

    for (const input of line.recipe.inputs) getFlow(input.resourceId).consumed += input.quantity * m;
    for (const output of line.recipe.outputs) {
      getFlow(output.resourceId).produced += getRecipeOutputQuantity(line.recipe, output, outputModifiers) * m;
    }
  }

  // Regular results
  const regularResults: RegularResult[] = regularLines.map((line) => ({
    recipe: line.recipe,
    buildingCount: line.buildingCount,
    totalBuildings: line.totalBuildings,
    operatingMode: line.operatingMode,
    supplyRatio: line.operatingMode === "fixed" ? 1 : (balancedSupplyRatios.get(line) ?? 1),
    speedLevel: line.speedLevel,
    appliedRecyclingEfficiencyPercent: getAppliedRecyclingEfficiencyPercent(
      line.recipe,
      recyclingEfficiencyPercent,
    ),
  }));

  // Adjust source output to actual consumption
  const sourceResults: PassiveResult[] = sourceLines.map((line) => {
    const actualOutputs: PassiveResult["actualOutputs"] = [];
    const cap = lineFactor(line);

    for (const output of line.recipe.outputs) {
      const f = getFlow(output.resourceId);
      const outputQuantity = getRecipeOutputQuantity(line.recipe, output, outputModifiers);
      const actualUsed = Math.min(outputQuantity * cap, f.consumed);
      const overproduction = outputQuantity * cap - actualUsed;

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

    const capacity = lineFactor(line);
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
        const actual = Math.round(
          getRecipeOutputQuantity(line.recipe, output, outputModifiers) * capacity * utilizationRatio,
        );

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
  const allResourceFlows: ResourceFlow[] = [];
  const recyclableSourceValueProduced = regularResults.reduce((total, result) => {
    if (result.appliedRecyclingEfficiencyPercent == null) return total;

    const physicalQuantity = result.recipe.outputs
      .filter((output) => output.resourceId === "recyclables")
      .reduce(
        (quantity, output) => quantity + getRecipeOutputQuantity(result.recipe, output, outputModifiers),
        0,
      )
      * result.buildingCount
      * result.speedLevel
      * result.supplyRatio;

    return total + physicalQuantity * result.appliedRecyclingEfficiencyPercent / 100;
  }, 0);

  for (const [resourceId, { consumed, produced }] of flows) {
    const net = produced - consumed;
    const recyclingMetadata = resourceId === "recyclables"
      ? { recyclableSourceValueProduced }
      : {};

    allResourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });

    if (externalIds.has(resourceId)) {
      // External inputs: only show deficit beyond declared external supply
      if (net < -0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });
      }
    } else if (sourceResourceIds.has(resourceId)) {
      // Source resources: only show deficit (from simulation), hide surplus
      if (constrained.has(resourceId)) {
        const sim = simFlows.get(resourceId) ?? { produced: 0, consumed: 0 };
        const deficit = sim.produced - sim.consumed;

        if (deficit < -0.001) {
          resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed: sim.consumed, produced: sim.produced, net: deficit, ...recyclingMetadata });
        }
      }
    } else {
      if (Math.abs(net) > 0.001) {
        resourceFlows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });
      }
    }
  }

  return { resourceFlows, allResourceFlows, regularResults, sourceResults, sinkResults };
};
