import { Button, ProgressRing } from '@carbonid1/design-system'

interface Props {
  failed: boolean
  hasSnapshot: boolean
  onRetry: () => void
}

/** A single calm first-visit state; never fabricate partial factory totals. */
export const FactoryStartup = ({ failed, hasSnapshot, onRetry }: Props) => {
  let label = 'Waiting for game sync'

  if (hasSnapshot) label = 'Calculating factory…'
  if (failed) label = 'Could not calculate factory.'

  return (
  <div className="flex min-h-[60svh] items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      {hasSnapshot && !failed && (
        <div className="size-5">
          <ProgressRing progress={null} label="Calculating factory" />
        </div>
      )}
      <p role="status">
        {label}
      </p>
      {failed && <Button variant="ghost" onClick={onRetry}>Retry</Button>}
    </div>
  </div>
  )
}
