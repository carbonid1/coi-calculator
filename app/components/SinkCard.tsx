import { resources } from "../db/resources";
import { type PassiveResult } from "../helpers/calculate/calculate";
import { BuildingCount } from "./BuildingCount";

type Props = {
  result: PassiveResult;
  role: "source" | "sink";
};

export const SinkCard: React.FC<Props> = ({ result }) => {
  const hasWork = result.actualInputs.length > 0 || result.actualOutputs.length > 0;
  const inactive = result.buildingCount === 0 || !hasWork;

  // Effective building count based on actual vs max output
  const effectiveCount = hasWork && result.recipe.outputs.length > 0
    ? (() => {
        const maxOutput = result.recipe.outputs[0]!.quantity * result.buildingCount;
        const actualOutput = result.actualOutputs[0]?.quantity ?? 0;
        return maxOutput > 0 ? parseFloat((result.buildingCount * actualOutput / maxOutput).toFixed(2)) : result.buildingCount;
      })()
    : 0;

  return (
    <div
      className={`rounded-lg border border-dashed p-4 ${
        inactive
          ? "border-gray-300 opacity-40 dark:border-gray-600"
          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {result.recipe.building}
          </h3>
          {result.recipe.name !== result.recipe.building && (() => {
            const match = result.recipe.name.match(/\((.+)\)$/);
            return match ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{match[1]}</p>
            ) : null;
          })()}
        </div>
        <BuildingCount effective={effectiveCount} total={result.totalBuildings} />
      </div>

      {!inactive && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-1">
            {result.actualInputs.map((input) => (
              <div key={input.resourceId} className="flex justify-between text-sm whitespace-nowrap gap-2">
                <span className="text-gray-600 dark:text-gray-300">
                  {resources[input.resourceId].name}
                </span>
                <span className="font-mono text-red-600 dark:text-red-400">
                  {Math.round(input.quantity)}
                </span>
              </div>
            ))}
            {result.actualInputs.length === 0 && (
              <p className="text-sm text-gray-400 italic">none</p>
            )}
          </div>

          <div className="text-xl text-gray-400">&rarr;</div>

          <div className="space-y-1">
            {result.actualOutputs.map((output) => (
              <div key={output.resourceId} className="flex justify-between text-sm whitespace-nowrap gap-2">
                <span className="text-gray-600 dark:text-gray-300">
                  {resources[output.resourceId].name}
                </span>
                <span className="font-mono text-green-600 dark:text-green-400">
                  {Math.round(output.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
