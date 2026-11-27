interface PendingCookieCommit {
  completion: Promise<void>;
  bestEffort: Promise<void>;
}

/** Holds one pending dirty batch while a secure-store commit is in flight. */
export class CookiePersistenceQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending: PendingCookieCommit | undefined;
  private readonly persist: () => Promise<void>;
  private readonly onError: () => void;

  constructor(persist: () => Promise<void>, onError: () => void) {
    this.persist = persist;
    this.onError = onError;
  }

  schedule(required: boolean = false): Promise<void> {
    if (this.pending === undefined) {
      const completion = this.tail.then((): Promise<void> => {
        // New mutations after this point must wait for a later snapshot.
        this.pending = undefined;
        return this.persist();
      });
      const bestEffort = completion.catch((): void => {
        try { this.onError(); } catch (_) { /* Keep the queue usable when diagnostics fail. */ }
      });
      this.pending = { completion, bestEffort };
      this.tail = bestEffort;
    }
    return required ? this.pending.completion : this.pending.bestEffort;
  }
}
