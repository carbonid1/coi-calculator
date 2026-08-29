import { Badge, Tooltip } from '@carbonid1/design-system'
import { Ghost } from 'lucide-react'

interface Props {
  count?: number
}

export const GhostBuildingBadge: React.FC<Props> = ({ count = 0 }) => {
  if (count <= 0) return null

  return (
    <Tooltip
      label={`${count} construction ${count === 1 ? 'ghost is' : 'ghosts are'} synced from the game and included as planned capacity.`}
      maxWidth={300}
    >
      <Badge variant="highlight" className="mt-1 gap-1">
        <Ghost aria-hidden="true" className="size-3" />
        {count} planned
      </Badge>
    </Tooltip>
  )
}

