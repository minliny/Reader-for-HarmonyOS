/** Pending DocumentViewPicker invocations for the installed main window.
 * A settled invocation is not a Native window disappearance acknowledgement.
 * This adapter owns no rendering, navigation, I/O or business operations. */
class ReaderDocumentPickerScope {
  readonly windowId: number;
  readonly pending: Set<ReaderDocumentPickerTicket> = new Set<ReaderDocumentPickerTicket>();
  readonly changed: () => void;
  active: boolean = true;

  constructor(windowId: number, changed: () => void) { this.windowId = windowId; this.changed = changed; }
}

export class ReaderDocumentPickerTicket {
  private readonly scope: ReaderDocumentPickerScope;
  private finished: boolean = false;

  constructor(scope: ReaderDocumentPickerScope) { this.scope = scope; }

  /** Called only from the original invocation's finally block. */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.scope.pending.delete(this);
    if (this.scope.active) this.scope.changed();
  }
}

export class ReaderDocumentPickerActivity {
  private static scope: ReaderDocumentPickerScope | undefined;
  private static epoch: number = 0;
  private static foreground: boolean = false;
  private static readonly listeners: Set<() => void> = new Set<() => void>();
  private static notificationPending: boolean = false;

  static bind(windowId: number): void {
    if (!Number.isSafeInteger(windowId) || windowId < 0) throw new Error('Document picker main-window identity is invalid');
    if (ReaderDocumentPickerActivity.scope?.windowId === windowId && ReaderDocumentPickerActivity.scope.active) return;
    ReaderDocumentPickerActivity.retireScope();
    ReaderDocumentPickerActivity.epoch += 1;
    ReaderDocumentPickerActivity.scope = new ReaderDocumentPickerScope(windowId,
      (): void => ReaderDocumentPickerActivity.notify());
    ReaderDocumentPickerActivity.notify();
  }

  /** Actual window destruction only; ordinary Root/detach keeps invocations. */
  static destroy(): void {
    ReaderDocumentPickerActivity.retireScope();
    ReaderDocumentPickerActivity.epoch += 1;
    ReaderDocumentPickerActivity.foreground = false;
    ReaderDocumentPickerActivity.notify();
  }

  static hasWindow(): boolean { return ReaderDocumentPickerActivity.scope?.active === true; }
  static isPending(): boolean { return (ReaderDocumentPickerActivity.scope?.pending.size ?? 0) > 0; }
  static windowEpoch(): number { return ReaderDocumentPickerActivity.epoch; }

  static setForeground(foreground: boolean): void {
    if (ReaderDocumentPickerActivity.foreground === foreground) return;
    ReaderDocumentPickerActivity.foreground = foreground;
    ReaderDocumentPickerActivity.notify();
  }

  /** Reserve synchronously before constructing/calling the system picker. */
  static begin(expectedEpoch: number = ReaderDocumentPickerActivity.windowEpoch()): ReaderDocumentPickerTicket {
    const scope = ReaderDocumentPickerActivity.scope;
    if (scope === undefined || !scope.active) throw new Error('Document picker requires a current main window');
    if (expectedEpoch !== ReaderDocumentPickerActivity.epoch) throw new Error('Document picker original main window is no longer current');
    if (!ReaderDocumentPickerActivity.foreground) throw new Error('Document picker requires the foreground main window');
    const ticket = new ReaderDocumentPickerTicket(scope);
    scope.pending.add(ticket);
    ReaderDocumentPickerActivity.notify();
    return ticket;
  }

  static subscribe(listener: () => void): () => void {
    ReaderDocumentPickerActivity.listeners.add(listener);
    ReaderDocumentPickerActivity.notify();
    return (): void => { ReaderDocumentPickerActivity.listeners.delete(listener); };
  }

  private static retireScope(): void {
    const scope = ReaderDocumentPickerActivity.scope;
    ReaderDocumentPickerActivity.scope = undefined;
    if (scope === undefined) return;
    scope.active = false;
    // Retiring observation never cancels or settles the original invocation.
    scope.pending.clear();
  }

  private static notify(): void {
    if (ReaderDocumentPickerActivity.notificationPending) return;
    ReaderDocumentPickerActivity.notificationPending = true;
    void Promise.resolve().then((): void => {
      ReaderDocumentPickerActivity.notificationPending = false;
      Array.from(ReaderDocumentPickerActivity.listeners).forEach((listener: () => void): void => {
        if (!ReaderDocumentPickerActivity.listeners.has(listener)) return;
        try { listener(); } catch (_) { /* A subscriber cannot undo invocation settlement. */ }
      });
    });
  }
}
