/** Physical native Alert attachments for the installed main window only.
 * This adapter owns no rendering, routes, dialog decisions or business work. */
class ReaderNativeAlertScope {
  readonly windowId: number;
  readonly attachments: Set<ReaderNativeAlertAttachment> = new Set<ReaderNativeAlertAttachment>();
  readonly changed: () => void;
  active: boolean = true;

  constructor(windowId: number, changed: () => void) { this.windowId = windowId; this.changed = changed; }
}

export class ReaderNativeAlertAttachment {
  private readonly scope: ReaderNativeAlertScope;
  private readonly retired: () => void;
  private nativeSeen: boolean = false;
  private closing: boolean = false;
  private released: boolean = false;

  constructor(scope: ReaderNativeAlertScope, retired: () => void) { this.scope = scope; this.retired = retired; }

  isCurrent(): boolean { return !this.released && this.scope.active && this.scope.attachments.has(this); }
  willAppear(): void { if (this.isCurrent()) this.nativeSeen = true; }
  didAppear(): void { if (this.isCurrent()) this.nativeSeen = true; }
  willDisappear(): void {
    if (!this.isCurrent()) return;
    this.nativeSeen = true;
    this.closing = true;
  }
  didDisappear(): void { this.release(); }
  showFailed(): void {
    // A synchronous rejection can withdraw an unobserved reservation. Once
    // Native has appeared or started closing, only its real disappearance or
    // window destruction can release it.
    if (!this.nativeSeen && !this.closing) this.release();
  }
  windowRetired(): void { this.release(); }

  private release(): void {
    if (this.released) return;
    this.released = true;
    this.scope.attachments.delete(this);
    try { this.retired(); } finally { if (this.scope.active) this.scope.changed(); }
  }
}

export class ReaderNativeAlertWindow {
  private static scope: ReaderNativeAlertScope | undefined;
  private static readonly listeners: Set<() => void> = new Set<() => void>();
  private static notificationPending: boolean = false;

  static bind(windowId: number): void {
    if (!Number.isSafeInteger(windowId) || windowId < 0) throw new Error('Native Alert main-window identity is invalid');
    if (ReaderNativeAlertWindow.scope?.windowId === windowId && ReaderNativeAlertWindow.scope.active) return;
    ReaderNativeAlertWindow.retireScope();
    ReaderNativeAlertWindow.scope = new ReaderNativeAlertScope(windowId, (): void => ReaderNativeAlertWindow.notify());
    ReaderNativeAlertWindow.notify();
  }

  /** Called for actual window destruction, never component/Root retirement. */
  static destroy(): void {
    ReaderNativeAlertWindow.retireScope();
    ReaderNativeAlertWindow.notify();
  }

  static hasWindow(): boolean { return ReaderNativeAlertWindow.scope?.active === true; }
  static isPresented(): boolean { return (ReaderNativeAlertWindow.scope?.attachments.size ?? 0) > 0; }

  static reserve(retired: () => void = (): void => {}): ReaderNativeAlertAttachment | undefined {
    const scope = ReaderNativeAlertWindow.scope;
    if (scope === undefined || !scope.active) return undefined;
    const attachment = new ReaderNativeAlertAttachment(scope, retired);
    scope.attachments.add(attachment);
    ReaderNativeAlertWindow.notify();
    return attachment;
  }

  static subscribe(listener: () => void): () => void {
    ReaderNativeAlertWindow.listeners.add(listener);
    ReaderNativeAlertWindow.notify();
    return (): void => { ReaderNativeAlertWindow.listeners.delete(listener); };
  }

  private static retireScope(): void {
    const scope = ReaderNativeAlertWindow.scope;
    ReaderNativeAlertWindow.scope = undefined;
    if (scope === undefined) return;
    scope.active = false;
    Array.from(scope.attachments).forEach((attachment: ReaderNativeAlertAttachment): void => attachment.windowRetired());
    scope.attachments.clear();
  }

  private static notify(): void {
    if (ReaderNativeAlertWindow.notificationPending) return;
    ReaderNativeAlertWindow.notificationPending = true;
    void Promise.resolve().then((): void => {
      ReaderNativeAlertWindow.notificationPending = false;
      Array.from(ReaderNativeAlertWindow.listeners).forEach((listener: () => void): void => {
        if (!ReaderNativeAlertWindow.listeners.has(listener)) return;
        try { listener(); } catch (_) { /* A subscriber cannot undo physical retirement. */ }
      });
    });
  }
}
