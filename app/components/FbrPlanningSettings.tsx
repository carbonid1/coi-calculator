import { Card, Field } from "@carbonid1/design-system";

import { type PlanningBaselines } from "../db/planning-baselines";

interface Props {
  values: PlanningBaselines;
  onChange: (values: PlanningBaselines) => void;
}

export const FbrPlanningSettings: React.FC<Props> = ({ values, onChange }) => (
  <Card.Root className="max-w-xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Measured planning baselines</Card.Title>
        <Card.Description>
          Long-run values standing in for factory activity not modeled yet
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field.Root>
          <Field.Label>FBR generation (100Y average)</Field.Label>
          <Field.Control
            aria-label="FBR 100-year average generation"
            type="number"
            min={0}
            max={60}
            step={0.1}
            value={values.fbrAverageGenerationMw}
            onChange={(event) => {
              const nextValue = event.currentTarget.valueAsNumber;

              if (Number.isFinite(nextValue)) {
                onChange({
                  ...values,
                  fbrAverageGenerationMw: Math.min(60, Math.max(0, nextValue)),
                });
              }
            }}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Hydrogen fuel demand / 60s</Field.Label>
          <Field.Control
            aria-label="Hydrogen fuel demand per 60 seconds"
            type="number"
            min={0}
            step={0.1}
            value={values.hydrogenFuelDemandPerCycle}
            onChange={(event) => {
              const nextValue = event.currentTarget.valueAsNumber;

              if (Number.isFinite(nextValue)) {
                onChange({
                  ...values,
                  hydrogenFuelDemandPerCycle: Math.max(0, nextValue),
                });
              }
            }}
          />
        </Field.Root>
      </div>
    </Card.Content>
  </Card.Root>
);
