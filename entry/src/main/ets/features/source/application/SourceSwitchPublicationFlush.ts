/** Wakes the current refresh on real projection or retirement events. */
export class SourceSwitchPublicationFlush {
  private retired = false;
  private readonly waiters = new Set<() => void>();
  private onRetire?: () => void;

  isRetired(): boolean { return this.retired; }

  onCancel(handler: () => void): void {
    if (this.retired) handler();
    else this.onRetire = handler;
  }

  waitForChange(): Promise<void> {
    if (this.retired) return Promise.resolve();
    return new Promise<void>((resolve): void => { this.waiters.add(resolve); });
  }

  changed(): void {
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }

  cancel(): void {
    if (this.retired) return;
    this.retired = true;
    const retire = this.onRetire;
    this.onRetire = undefined;
    try { retire?.(); } finally { this.changed(); }
  }
}
