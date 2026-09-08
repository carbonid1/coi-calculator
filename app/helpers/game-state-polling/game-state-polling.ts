interface Options {
  refresh: (signal: AbortSignal) => Promise<void>;
  isVisible: () => boolean;
  onError: (error: unknown) => void;
}

const REFRESH_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** One bounded request per minute; hidden tabs resume when the next poll is due. */
export const startGameStatePolling = ({ refresh, isVisible, onError }: Options) => {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | null = null;
  let nextPollAt = 0;

  const poll = async () => {
    if (disposed || active || !isVisible()) return;
    const remaining = nextPollAt - Date.now();

    if (remaining > 0) {
      timer = setTimeout(() => void poll(), remaining);
      return;
    }
    const controller = new AbortController();

    active = controller;
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
      if (!disposed && isVisible()) timer = setTimeout(() => void poll(), REFRESH_INTERVAL_MS);
    }
  };

  const visibilityChanged = () => {
    clearTimeout(timer);
    void poll();
  };

  void poll();
  return {
    visibilityChanged,
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      active?.abort();
    },
  };
};
