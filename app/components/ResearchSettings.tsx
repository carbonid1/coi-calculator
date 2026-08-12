import { Card } from "@carbonid1/design-system";

import { type ResearchModuleConfig } from "../db/modules/research";

interface Props {
  config: ResearchModuleConfig;
}

export const ResearchSettings: React.FC<Props> = ({ config }) => (
  <Card.Root className="max-w-2xl">
    <Card.Content>
      <div className="max-w-xs rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <p className="text-sm text-muted-foreground">Active Research Lab IV</p>
        <p className="font-mono font-semibold text-foreground">
          {config.activeResearchLabIvCount.toLocaleString()}
        </p>
      </div>
    </Card.Content>
  </Card.Root>
);
