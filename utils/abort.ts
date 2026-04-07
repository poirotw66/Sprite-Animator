export const createAbortError = (message = 'Operation aborted'): DOMException =>
  new DOMException(message, 'AbortError');

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

export const throwIfAborted = (signal?: AbortSignal | null): void => {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof DOMException && signal.reason.name === 'AbortError') {
    throw signal.reason;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw createAbortError();
};

export const abortableDelay = (ms: number, signal?: AbortSignal | null): Promise<void> => {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
      resolve();
    }, ms);

    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
      reject(createAbortError());
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
};