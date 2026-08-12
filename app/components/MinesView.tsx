import { type SourceKind } from "../db/recipes";
import { resources } from "../db/resources";
import { type PassiveResult } from "../helpers/calculate/calculate";
import { ProductionCard } from "./ProductionCard";

interface Props {
  sourceResults: PassiveResult[];
  sinkResults: PassiveResult[];
}

const sections: {
  kind: SourceKind;
  label: string;
}[] = [
  {
    kind: "map-mine",
    label: "Map mines",
  },
  {
    kind: "world-mine",
    label: "World mines",
  },
  {
    kind: "groundwater",
    label: "Groundwater",
  },
];

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const MinesView: React.FC<Props> = ({ sourceResults, sinkResults }) => (
  <div className="space-y-6">
    {sections.map((section) => {
      const mines = sourceResults.filter((result) => result.recipe.sourceKind === section.kind);

      if (mines.length === 0) return null;

      return (
        <section key={section.kind} className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {section.label}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mines.map((result) => {
              const output = result.actualOutputs[0];
              const quantity = output?.quantity ?? 0;
              const isGroundwater = result.recipe.sourceKind === "groundwater";
              const capacity = (result.recipe.outputs[0]?.quantity ?? 0)
                * result.buildingCount;
              let title = result.recipe.building;

              if (!isGroundwater && output) title = resources[output.resourceId].name;

              return (
                <ProductionCard
                  key={result.recipe.id}
                  operatingMode="balanced"
                  passive
                  inactive={quantity <= 0.001}
                  className="p-4"
                >
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <h3 className="font-semibold text-foreground">
                      {title}
                    </h3>
                    <span className="font-mono font-semibold text-success">
                      {formatQuantity(quantity)}{isGroundwater && ` / ${formatQuantity(capacity)}`}
                    </span>
                  </div>
                  {isGroundwater && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {result.buildingCount} installed
                    </p>
                  )}
                </ProductionCard>
              );
            })}
          </div>
        </section>
      );
    })}

    {sinkResults.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Disposal
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sinkResults.map((result) => {
            const input = result.recipe.inputs[0];
            const actualInput = result.actualInputs.find(
              (actual) => actual.resourceId === input?.resourceId,
            );
            const quantity = actualInput?.quantity ?? 0;

            return (
              <ProductionCard
                key={result.recipe.id}
                operatingMode="balanced"
                passive
                inactive={quantity <= 0.001}
                className="p-4"
              >
                <div className="flex items-center justify-between gap-4 text-sm">
                  <h3 className="font-semibold text-foreground">
                    {input ? resources[input.resourceId].name : result.recipe.building}
                  </h3>
                  <span className="font-mono font-semibold text-foreground">
                    {formatQuantity(quantity)}
                  </span>
                </div>
              </ProductionCard>
            );
          })}
        </div>
      </section>
    )}
  </div>
);
