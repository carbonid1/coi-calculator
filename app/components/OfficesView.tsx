import { Card } from "@carbonid1/design-system";
import { TriangleAlert } from "lucide-react";

import {
  calculateFocusPointsCost,
  focusCatalog,
  type OfficePlan,
  type OfficePlanCalculation,
} from "../db/offices";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";
import {
  DataSourceBadge,
  getDataSourcePresentation,
  getDataSourceSurfaceClassName,
} from "./DataSourceState";

interface Props {
  calculation: OfficePlanCalculation;
  focusResearchLevel: number;
  plan: OfficePlan;
  source: ValueSource;
}

const formatNumber = (value: number) => parseFloat(value.toFixed(2)).toLocaleString("en-US");
const formatSignedPercent = (value: number) => (
  `${value > 0 ? "+" : ""}${formatNumber(value)}%`
);
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
      {value}
    </p>
  </div>
);

export const OfficesView: React.FC<Props> = ({
  calculation,
  focusResearchLevel,
  plan,
  source,
}) => (
  <div className="space-y-6">
    <Card.Root>
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>Focus budget</Card.Title>
          <Card.Description>
            Calculated result · Focus Points research level {focusResearchLevel}
          </Card.Description>
        </Card.Header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Generated / allocated"
            value={`${formatNumber(calculation.focusPointsCapacity)} / ${formatNumber(calculation.focusPointsRequired)}`}
          />
          <Metric
            label="Focus available"
            value={formatNumber(calculation.focusPointsAvailable)}
          />
          <Metric
            label="Office Supplies"
            value={`${formatNumber(calculation.officeSuppliesPerCycle)} / cycle`}
          />
          <Metric
            label="Computing boost"
            value={`${formatNumber(calculation.computingTflops)} TFLOPS`}
          />
        </div>

        {!calculation.isAffordable && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Planned Focus allocation exceeds Office capacity by
            {` ${formatNumber(calculation.focusPointsRequired - calculation.focusPointsCapacity)} points`}.
          </p>
        )}
      </Card.Content>
    </Card.Root>

    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Focus allocation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {getDataSourcePresentation(source).description}.
          {source === "planned"
            ? " These steps override lower-precedence values until explicitly changed."
            : ""}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {focusCatalog.map((focus) => {
          const step = Math.min(
            focus.maxStep,
            Math.max(0, Math.trunc(plan.focusSteps[focus.id])),
          );
          const active = step > 0;

          return (
            <Card.Root
              key={focus.id}
              className={active
                ? getDataSourceSurfaceClassName(source)
                : undefined}
            >
              <Card.Content className="space-y-3 p-3">
                <Card.Header>
                  <Card.Title className="text-sm">{focus.name}</Card.Title>
                  <Card.Description className="text-xs">
                    {focus.effectPerStep}
                  </Card.Description>
                  <Card.Action>
                    <div className="flex items-center gap-2">
                      {active && <DataSourceBadge source={source} />}
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {step} / {focus.maxStep}
                      </span>
                    </div>
                  </Card.Action>
                </Card.Header>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Current effect</p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {active
                        ? formatSignedPercent(calculation.bonuses[focus.id])
                        : "Off"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Focus cost</p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatNumber(calculateFocusPointsCost(focus, step))}
                    </p>
                  </div>
                </div>
                {!focus.modeledInCalculator && active && (
                  <p className="text-xs text-muted-foreground">
                    Informational; this effect is not yet applied to calculator totals.
                  </p>
                )}
              </Card.Content>
            </Card.Root>
          );
        })}
      </div>
    </section>
  </div>
);
