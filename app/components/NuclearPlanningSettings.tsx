import { Card } from "@carbonid1/design-system";

import { type PlanningBaselines } from "../db/planning-baselines";

interface Props {
  values: PlanningBaselines;
}

export const NuclearPlanningSettings: React.FC<Props> = ({ values }) => (
  <Card.Root className="max-w-xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Operating baselines</Card.Title>
        <Card.Description>
          Planned operating point before research is brought online
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">Average nuclear generation</p>
          <p className="font-mono font-semibold text-foreground">
            {values.averageNuclearGenerationMw} MW
          </p>
        </div>

        <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">Hydrogen Fuel / cycle</p>
          <p className="font-mono font-semibold text-foreground">
            {values.hydrogenFuelDemandPerCycle}
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
);
