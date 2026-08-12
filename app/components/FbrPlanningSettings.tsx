import { Card } from "@carbonid1/design-system";

import { type PlanningBaselines } from "../db/planning-baselines";

interface Props {
  values: PlanningBaselines;
}

export const FbrPlanningSettings: React.FC<Props> = ({ values }) => (
  <Card.Root className="max-w-xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Measured planning baselines</Card.Title>
        <Card.Description>
          Long-run values standing in for factory activity not modeled yet
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">FBR generation (100Y average)</p>
          <p className="font-mono font-semibold text-foreground">{values.fbrAverageGenerationMw} MW</p>
        </div>

        <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">Hydrogen fuel demand / cycle</p>
          <p className="font-mono font-semibold text-foreground">{values.hydrogenFuelDemandPerCycle}</p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
);
