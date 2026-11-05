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
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | null = null;
  let nextPollAt = 0;

  const poll = async (force = false) => {
    if (disposed || active || !isVisible()) return;
    clearTimeout(timer);
    const remaining = nextPollAt - Date.now();

    if (!force && remaining > 0) {
      timer = setTimeout(() => void poll(), remaining);
      return;
    }
    const controller = new AbortController();

    active = controller;
    onRefreshingChange?.(true);
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(controller.signal.reason);

    controller.signal.addEventListener('abort', onAbort, { once: true });
    const deadline = setTimeout(() => {
      controller.abort(new Error('Game sync request timed out.'));
    }, REQUEST_TIMEOUT_MS);

    try {
      await Promise.race([refresh(controller.signal), aborted]);
    } catch (error) {
      if (!disposed) onError(error);
    } finally {
      clearTimeout(deadline);
      controller.signal.removeEventListener('abort', onAbort);
      active = null;
      nextPollAt = Date.now() + REFRESH_INTERVAL_MS;
      if (!disposed) onRefreshingChange?.(false);
      if (!disposed && isVisible()) timer = setTimeout(() => void poll(), REFRESH_INTERVAL_MS);
    }
  };

  const visibilityChanged = () => {
    clearTimeout(timer);
    void poll();
  };

  void poll();
  return {
    refreshNow: () => { void poll(true); },
    visibilityChanged,
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      active?.abort();
    },
  };
};
