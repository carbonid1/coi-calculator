import { Button, ProgressRing } from '@carbonid1/design-system'

interface Props {
  failed: boolean
  hasSnapshot: boolean
  onRetry: () => void
}

const getLabel = (failed: boolean, hasSnapshot: boolean) => {
  if (failed) return 'Could not calculate plan.'
  if (hasSnapshot) return 'Calculating plan…'

  return 'Waiting for game sync'
}

/** A single calm first-visit state; never fabricate partial factory totals. */
export const FactoryStartup = ({ failed, hasSnapshot, onRetry }: Props) => {
  return (
  <div className="flex min-h-[60svh] items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      {hasSnapshot && !failed && (
        <div className="size-5">
          <ProgressRing progress={null} label="Calculating plan" />
        </div>
      )}
      <p role="status">
        {getLabel(failed, hasSnapshot)}
      </p>
      {failed && <Button variant="ghost" onClick={onRetry}>Retry</Button>}
    </div>
  </div>
  )
}
