/** The OS still renders AlertDialog. This adapter owns only one host's
 * presentation decision, preserving native geometry and caller business work. */
export type ReaderNativeAlertSpecId = 'notice' | 'confirmation' | 'confirmation-cancelable' |
  'choice-blocking' | 'retry-blocking' | 'preview';
export type ReaderNativeAlertDecision = 'primary' | 'secondary' | 'confirm' | 'cancel' | 'retired' | 'native-failure';
export interface ReaderNativeAlertOptions extends AlertDialogParamWithConfirm {
  primaryButton?: AlertDialogButtonBaseOptions;
  secondaryButton?: AlertDialogButtonBaseOptions;
}
interface ReaderNativeAlertSpec {
  autoCancel: boolean | undefined;
  layout: 'primary' | 'pair' | 'confirm';
}
function readerNativeAlertSpec(id: ReaderNativeAlertSpecId): ReaderNativeAlertSpec {
  switch (id) {
    case 'notice': return { autoCancel: true, layout: 'primary' };
    case 'confirmation': return { autoCancel: undefined, layout: 'pair' };
    case 'confirmation-cancelable': return { autoCancel: true, layout: 'pair' };
    case 'choice-blocking': return { autoCancel: false, layout: 'pair' };
    case 'retry-blocking': return { autoCancel: false, layout: 'primary' };
    case 'preview': return { autoCancel: undefined, layout: 'confirm' };
  }
}

export class ReaderNativeAlertLease {
  readonly decision: Promise<ReaderNativeAlertDecision>;
  private settled: boolean = false;
  private resolve: (decision: ReaderNativeAlertDecision) => void = (): void => {};
  private readonly isCurrent: () => boolean;

  constructor(isCurrent: () => boolean) {
    this.isCurrent = isCurrent;
    this.decision = new Promise<ReaderNativeAlertDecision>((resolve): void => { this.resolve = resolve; });
  }

  retire(): void { this.finish('retired'); }
  nativeFailed(): void { this.finish('native-failure'); }
  private finish(decision: ReaderNativeAlertDecision): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(decision);
  }
  act(decision: ReaderNativeAlertDecision, action: (() => void) | undefined): void {
    if (this.settled) return;
    if (!this.isCurrent()) { this.retire(); return; }
    // A dialog decision is never a business mutation ACK. Settle first so a
    // throwing domain callback cannot strand a caller's presentation wait.
    this.finish(decision);
    action?.();
  }
}

/** Scope is one Index/component instance, not a global overlay manager.
 * Owners retire this at exit and provide exact route/entity/session guards. */
export class ReaderNativeAlertOwner {
  private current: ReaderNativeAlertLease | undefined = undefined;

  retire(): void { this.current?.retire(); this.current = undefined; }

  present(show: (options: ReaderNativeAlertOptions) => void, id: ReaderNativeAlertSpecId,
    options: ReaderNativeAlertOptions, isCurrent: () => boolean): ReaderNativeAlertLease {
    this.retire();
    const lease = new ReaderNativeAlertLease(isCurrent);
    this.current = lease;
    if (!isCurrent()) { lease.retire(); return lease; }
    const spec = readerNativeAlertSpec(id);
    if ((spec.layout === 'confirm') !== (options.confirm !== undefined) ||
      (spec.layout === 'pair') !== (options.secondaryButton !== undefined) ||
      (spec.layout !== 'confirm' && options.primaryButton === undefined)) {
      lease.nativeFailed();
      throw new Error('Reader native Alert finite specification does not match its button slots');
    }
    const primary = options.primaryButton;
    const secondary = options.secondaryButton;
    const confirm = options.confirm;
    const native: ReaderNativeAlertOptions = {
      title: options.title, message: options.message,
      cancel: (): void => lease.act('cancel', options.cancel),
    };
    // AUTO remains omitted, including native platform font/layout defaults.
    if (spec.autoCancel !== undefined) native.autoCancel = spec.autoCancel;
    if (primary !== undefined) native.primaryButton = { ...primary, action: (): void => lease.act('primary', primary.action) };
    if (secondary !== undefined) native.secondaryButton = { ...secondary, action: (): void => lease.act('secondary', secondary.action) };
    if (confirm !== undefined) native.confirm = { ...confirm, action: (): void => lease.act('confirm', confirm.action) };
    try { show(native); }
    catch (error) { lease.nativeFailed(); throw error; }
    return lease;
  }
}
