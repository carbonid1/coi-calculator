import { type ProductionLine, type RegularResult } from "../calculate/calculate";

const REACTOR_RECIPE_IDS = ["fbr-3x", "fbr-0x"] as const;
const TURBINE_RECIPE_IDS = [
  "turbine-super",
  "turbine-high",
  "turbine-low",
  "power-generator-ii-nuclear",
] as const;

interface PresentedRecipe {
  line: ProductionLine;
  result?: RegularResult;
}

export interface NuclearPowerBlock {
  id: string;
  label: string;
  reactor: PresentedRecipe;
  turbineBank: PresentedRecipe[];
}

const scaleQuantities = <T extends { quantity: number }>(
  quantities: T[],
  ratio: number,
) => quantities.map((quantity) => ({
  ...quantity,
  quantity: quantity.quantity * ratio,
}));

const splitResult = (
  result: RegularResult | undefined,
  activeBuildings: number,
  builtBuildings: number,
  share: number,
): RegularResult | undefined => result && ({
  ...result,
  activeBuildings,
  builtBuildings,
  actualInputs: scaleQuantities(result.actualInputs, share),
  actualOutputs: scaleQuantities(result.actualOutputs, share),
  recyclableSourceValueProduced: result.recyclableSourceValueProduced * share,
});

const allocateIntegerCapacity = (total: number, weights: number[]) => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) return weights.map(() => 0);

  const raw = weights.map((weight) => total * weight / totalWeight);
  const allocated = raw.map(Math.floor);
  let remaining = total - allocated.reduce((sum, count) => sum + count, 0);
  const remainderOrder = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of remainderOrder) {
    if (remaining <= 0) break;

    allocated[index] = (allocated[index] ?? 0) + 1;
    remaining -= 1;
  }

  return allocated;
};

const allocateActiveCapacity = (
  total: number,
  capacities: number[],
  priorities: number[],
) => {
  let remaining = total;
  const allocated = capacities.map(() => 0);
  const allocationOrder = capacities
    .map((capacity, index) => ({ capacity, index, priority: priorities[index] ?? 0 }))
    .toSorted((a, b) => b.priority - a.priority || a.index - b.index);

  for (const { capacity, index } of allocationOrder) {
    const count = Math.min(capacity, Math.max(0, remaining));

    allocated[index] = count;
    remaining -= count;
  }

  return allocated;
};

export const createNuclearPowerBlocks = (
  electricityLines: ProductionLine[],
  results: RegularResult[],
): NuclearPowerBlock[] => {
  const reactorInstances = REACTOR_RECIPE_IDS.flatMap((recipeId) => {
    const line = electricityLines.find((candidate) => candidate.recipe.id === recipeId);

    if (!line) return [];

    return Array.from({ length: line.builtBuildings }, (_, index) => ({
      line,
      instanceIndex: index,
      steamWeight: (line.recipe.outputs.find(
        (output) => output.resourceId === "steamSuper",
      )?.quantity ?? 0) * line.speedLevel,
    }));
  });
  const turbineLines = TURBINE_RECIPE_IDS.flatMap((recipeId) => {
    const line = electricityLines.find((candidate) => candidate.recipe.id === recipeId);

    return line ? [line] : [];
  });
  const referenceTurbine = turbineLines.find(
    (line) => line.recipe.id === "turbine-super",
  );
  const turbineTrainCounts = allocateIntegerCapacity(
    referenceTurbine?.builtBuildings ?? 0,
    reactorInstances.map((instance) => instance.steamWeight),
  );

  return reactorInstances.map((instance, blockIndex) => {
    const reactorResult = results.find(
      (result) => result.recipe.id === instance.line.recipe.id,
    );
    const reactorActive = instance.instanceIndex < instance.line.activeBuildings ? 1 : 0;
    const reactorShare = instance.line.activeBuildings > 0
      ? reactorActive / instance.line.activeBuildings
      : 0;

    return {
      id: `nuclear-reactor-${blockIndex + 1}`,
      label: `Reactor ${blockIndex + 1}`,
      reactor: {
        line: {
          ...instance.line,
          activeBuildings: reactorActive,
          builtBuildings: 1,
        },
        result: splitResult(reactorResult, reactorActive, 1, reactorShare),
      },
      turbineBank: turbineLines.map((line) => {
        const builtMultiplier = line.recipe.id === "power-generator-ii-nuclear" ? 2 : 1;
        const builtByBlock = turbineTrainCounts.map((count) => count * builtMultiplier);
        const activeByBlock = allocateActiveCapacity(
          line.activeBuildings,
          builtByBlock,
          reactorInstances.map((reactor) => reactor.steamWeight),
        );
        const active = activeByBlock[blockIndex] ?? 0;
        const result = results.find((candidate) => candidate.recipe.id === line.recipe.id);
        const share = line.activeBuildings > 0 ? active / line.activeBuildings : 0;

        return {
          line: {
            ...line,
            activeBuildings: active,
            builtBuildings: builtByBlock[blockIndex] ?? 0,
          },
          result: splitResult(
            result,
            active,
            builtByBlock[blockIndex] ?? 0,
            share,
          ),
        };
      }),
    };
  });
};
