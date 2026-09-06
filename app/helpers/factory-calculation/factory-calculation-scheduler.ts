interface CalculationJob<Input> {
  input: Input
  revision: string
}

export interface CalculationScheduler<Input> {
  /** Drops every queued job and ignores results still in flight. */
  dispose: () => void
  /**
   * Requests a value for `revision`. Only one calculation runs at a time and
   * only the most recently requested revision waits behind it, so a slow
   * calculation never builds a backlog of obsolete snapshots.
   */
  request: (revision: string, input: Input) => void
}

export interface CalculationSchedulerOptions<Input, Value> {
  calculate: (revision: string, input: Input) => Promise<Value>
  onError: (revision: string, error: unknown) => void
  onSettled: (revision: string, input: Input, value: Value) => void
}

export const createCalculationScheduler = <Input, Value>({
  calculate,
  onError,
  onSettled,
}: CalculationSchedulerOptions<Input, Value>): CalculationScheduler<Input> => {
  let active: CalculationJob<Input> | null = null
  let queued: CalculationJob<Input> | null = null
  let disposed = false

  const run = (job: CalculationJob<Input>) => {
    active = job
    void calculate(job.revision, job.input).then(
      value => {
        if (disposed || active !== job) return
        active = null
        onSettled(job.revision, job.input, value)
        if (queued) {
          const next = queued

          queued = null
          run(next)
        }
      },
      (error: unknown) => {
        if (disposed || active !== job) return
        active = null
        onError(job.revision, error)
        if (queued) {
          const next = queued

          queued = null
          run(next)
        }
      },
    )
  }

  return {
    dispose: () => {
      disposed = true
      active = null
      queued = null
    },
    request: (revision, input) => {
      if (disposed) return
      if (active?.revision === revision) {
        queued = null
        return
      }
      if (active) {
        queued = { input, revision }
        return
      }

      run({ input, revision })
    },
  }
}
