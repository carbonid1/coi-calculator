interface Options {
  refresh: (signal: AbortSignal) => Promise<void>;
  isVisible: () => boolean;
  onError: (error: unknown) => void;
  onRefreshingChange?: (refreshing: boolean) => void;
}

const REFRESH_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Serialize syncs; the next automatic poll waits one minute after completion. */
export const startGameStatePolling = ({ refresh, isVisible, onError, onRefreshingChange }: Options) => {
  const state: {
    disposed: boolean;
    timer: ReturnType<typeof setTimeout> | undefined;
    active: AbortController | null;
    nextPollAt: number;
  } = {
    disposed: false,
    timer: undefined,
    active: null,
    nextPollAt: 0,
  };

  const poll = async (force = false) => {
    if (state.disposed || state.active || !isVisible()) return;
    clearTimeout(state.timer);
    const remaining = state.nextPollAt - Date.now();

    if (!force && remaining > 0) {
      state.timer = setTimeout(() => void poll(), remaining);
      return;
    }
    const controller = new AbortController();

    state.active = controller;
    onRefreshingChange?.(true);
    const aborted = Promise.withResolvers<never>();
    const onAbort = () => aborted.reject(controller.signal.reason);

    controller.signal.addEventListener('abort', onAbort, { once: true });
    const deadline = setTimeout(() => {
      controller.abort(new Error('Game sync request timed out.'));
    }, REQUEST_TIMEOUT_MS);

    try {
      await Promise.race([refresh(controller.signal), aborted.promise]);
    } catch (error) {
      if (!state.disposed) onError(error);
    } finally {
      clearTimeout(deadline);
      controller.signal.removeEventListener('abort', onAbort);
      state.active = null;
      state.nextPollAt = Date.now() + REFRESH_INTERVAL_MS;
      if (!state.disposed) onRefreshingChange?.(false);
      if (!state.disposed && isVisible()) state.timer = setTimeout(() => void poll(), REFRESH_INTERVAL_MS);
    }
  };

  const visibilityChanged = () => {
    clearTimeout(state.timer);
    void poll();
  };

  void poll();
  return {
    refreshNow: () => { void poll(true); },
    visibilityChanged,
    dispose: () => {
      state.disposed = true;
      clearTimeout(state.timer);
      state.active?.abort();
    },
  };
};
