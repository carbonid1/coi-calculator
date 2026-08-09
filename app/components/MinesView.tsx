import { type SourceKind } from "../db/recipes";
import { resources } from "../db/resources";
import { type PassiveResult } from "../helpers/calculate/calculate";
import { ProductionCard } from "./ProductionCard";

interface Props {
  results: PassiveResult[];
}

const sections: { kind: SourceKind; label: string; description: string }[] = [
  {
    kind: "map-mine",
    label: "Map mines",
    description: "Extracted from deposits on the island",
  },
  {
    kind: "world-mine",
    label: "World mines",
    description: "Imported from world-map deposits",
  },
];

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const MinesView: React.FC<Props> = ({ results }) => (
  <div className="space-y-6">
    {sections.map((section) => {
      const mines = results.filter((result) => result.recipe.sourceKind === section.kind);

      if (mines.length === 0) return null;

      return (
        <section key={section.kind} className="space-y-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mines.map((result) => {
              const output = result.actualOutputs[0];
              const quantity = output?.quantity ?? 0;

              return (
                <ProductionCard
                  key={result.recipe.id}
                  operatingMode="balanced"
                  passive
                  inactive={quantity <= 0.001}
                  className="p-4"
                >
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground">
                      {output ? resources[output.resourceId].name : result.recipe.building}
                    </h3>
                    <p className="text-sm text-muted-foreground">Mined as needed</p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mined</span>
                    <span className="font-mono font-semibold text-success">
                      {formatQuantity(quantity)} / 60s
                    </span>
                  </div>
                </ProductionCard>
              );
            })}
          </div>
        </section>
      );
    })}
  </div>
);
