import { CircleAlert, MapPinned } from 'lucide-react'

import { type LiveAreaModuleState } from '../db/modules/modules'
import { BuildingStateCounts } from './BuildingStateCounts'

interface Props {
  state: LiveAreaModuleState
}

export const LiveAreaStatus: React.FC<Props> = ({ state }) => {
  if (state.trackedBuildings === 0) {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-transparent p-4">
        <MapPinned aria-hidden="true" className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <h2 className="font-medium text-foreground">Live area connected</h2>
          <p className="text-sm text-muted-foreground">
            Add or remove construction ghosts inside this game area to preview its module flows.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-2" aria-label="Live area inventory">
      <div className="flex flex-wrap items-center gap-2">
        <BuildingStateCounts
          active={state.activeBuildings}
          paused={state.pausedBuildings}
          ghosts={state.constructionGhosts}
        />
        <span className="text-xs text-muted-foreground">
          {state.constructedBuildings} constructed · snapshot synced
        </span>
      </div>

      {state.issues.length > 0 && (
        <div className="rounded-lg border border-attention/40 bg-attention/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-attention-foreground">
            <CircleAlert aria-hidden="true" className="size-4" />
            Needs game configuration
          </div>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {state.issues.map(issue => (
              <li key={issue.id}>
                {issue.count > 1 ? `${issue.count}× ` : ''}{issue.building}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
