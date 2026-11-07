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
  const state: { active: CalculationJob<Input> | null; queued: CalculationJob<Input> | null; disposed: boolean } = {
    active: null,
    queued: null,
    disposed: false,
  }

  const run = (job: CalculationJob<Input>) => {
    state.active = job
    void calculate(job.revision, job.input).then(
      value => {
        if (state.disposed || state.active !== job) return
        state.active = null
        onSettled(job.revision, job.input, value)
        if (state.queued) {
          const next = state.queued

          state.queued = null
          run(next)
        }
      },
      (error: unknown) => {
        if (state.disposed || state.active !== job) return
        state.active = null
        onError(job.revision, error)
        if (state.queued) {
          const next = state.queued

          state.queued = null
          run(next)
        }
      },
    )
  }

  return {
    dispose: () => {
      state.disposed = true
      state.active = null
      state.queued = null
    },
    request: (revision, input) => {
      if (state.disposed) return
      if (state.active?.revision === revision) {
        state.queued = null
        return
      }
      if (state.active) {
        state.queued = { input, revision }
        return
      }

      run({ input, revision })
    },
  }
}
