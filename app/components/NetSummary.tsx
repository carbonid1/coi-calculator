import { type ResourceId, resources } from "../db/resources";
import { type ResourceFlow } from "../helpers/calculate/calculate";

type Props = {
  flows: ResourceFlow[];
  externalInputs?: Partial<Record<ResourceId, number>>;
  workers?: number;
  electricityConsumptionKw?: number;
};

export const NetSummary: React.FC<Props> = ({ flows, externalInputs, workers, electricityConsumptionKw }) => {
  const externalEntries = externalInputs
    ? (Object.entries(externalInputs) as [ResourceId, number][]).filter(([, qty]) => qty > 0)
    : [];

  const electricityFlow = flows.find((f) => f.resourceId === "electricity");
  const regularFlows = flows.filter((f) => f.resourceId !== "electricity");

  if (regularFlows.length === 0 && externalEntries.length === 0 && !electricityFlow) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
        Net Summary <span className="text-sm font-normal text-gray-500">(per 60s)</span>
      </h3>

      {(electricityFlow || (workers && workers > 0)) && (() => {
        const generationMw = electricityFlow ? electricityFlow.net : 0;
        const consumptionMw = (electricityConsumptionKw ?? 0) / 1000;
        const netMw = generationMw - consumptionMw;

        return (
          <div className="mb-3 border-b border-gray-200 pb-3 dark:border-gray-700 space-y-1">
            {electricityFlow && (
              <>
                <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ⚡ Generation
                  </span>
                  <span className="font-mono text-green-600 dark:text-green-400">
                    +{parseFloat(generationMw.toFixed(1))} MW
                  </span>
                </div>
                {consumptionMw > 0 && (
                  <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ⚡ Consumption
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">
                      -{parseFloat(consumptionMw.toFixed(1))} MW
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    ⚡ Net
                  </span>
                  <span className={`font-mono font-semibold ${netMw > 0 ? "text-yellow-500 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                    {parseFloat(netMw.toFixed(1))} MW
                  </span>
                </div>
              </>
            )}
            {workers != null && workers > 0 && (
              <div className="flex items-center justify-between rounded px-2 -mx-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  👷 Workers
                </span>
                <span className="font-mono font-semibold text-gray-500 dark:text-gray-400">
                  {workers}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {externalEntries.length > 0 && (
        <div className="mb-3 space-y-1 border-b border-gray-200 pb-3 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            External Inputs
          </p>
          {externalEntries.map(([id, qty]) => (
            <div key={id} className="flex justify-between text-sm rounded px-2 -mx-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50">
              <span className="text-gray-500 dark:text-gray-400">
                {resources[id].name}
              </span>
              <span className="font-mono text-blue-500 dark:text-blue-400">
                {parseFloat(qty.toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {regularFlows.map((flow) => (
          <div
            key={flow.resourceId}
            className="flex justify-between text-sm rounded px-2 -mx-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/50"
          >
            <span className="text-gray-600 dark:text-gray-300">
              {flow.name}
            </span>
            <span
              className={`font-mono font-semibold ${
                flow.net > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {flow.net > 0 ? `+${parseFloat(flow.net.toFixed(2))}` : parseFloat(flow.net.toFixed(2))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
