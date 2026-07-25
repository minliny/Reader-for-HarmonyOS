// RestoreBackupOverlayMotionCoordinator owns only the short-lived Figma
// Restore Backup presentation phase. Core/Host still owns backup validity,
// atomic apply, success, failure, and the durable route transaction.
//
// In particular, the old Figma prototype's 1.2s review timeout is never a
// business-success signal. Complete can be shown only after the existing
// Core-owned `restore-result` + `success` terminal has been committed.

export type RestoreBackupOverlayPresentationPhase =
  'idle' | 'confirm' | 'dissolving' | 'loading' | 'complete';

export class RestoreBackupOverlayMotionCoordinator {
  static readonly K_PHASE: string = 'reader.restoreBackupOverlay.presentationPhase';
  static readonly K_SEQUENCE: string = 'reader.restoreBackupOverlay.presentationSequence';
  static readonly CONFIRM_TO_LOADING_DURATION_MS: number = 150;
  static readonly COMPLETE_AUTO_CLOSE_DURATION_MS: number = 1500;

  private static nextSequenceValue: number = 0;
  private static completeCloseTimer: number = 0;

  static phase(): RestoreBackupOverlayPresentationPhase {
    const value: string = AppStorage.get<string>(RestoreBackupOverlayMotionCoordinator.K_PHASE) ?? 'idle';
    if (value === 'confirm' || value === 'dissolving' || value === 'loading' || value === 'complete') {
      return value;
    }
    return 'idle';
  }

  static sequence(): number {
    return AppStorage.get<number>(RestoreBackupOverlayMotionCoordinator.K_SEQUENCE) ?? 0;
  }

  static prepareConfirm(): number {
    RestoreBackupOverlayMotionCoordinator.clearCompleteCloseTimer();
    if (RestoreBackupOverlayMotionCoordinator.phase() === 'confirm') {
      return RestoreBackupOverlayMotionCoordinator.sequence();
    }
    const sequence = RestoreBackupOverlayMotionCoordinator.nextSequence();
    RestoreBackupOverlayMotionCoordinator.publish(sequence, 'confirm');
    return sequence;
  }

  static beginConfirmToLoading(reducedMotion: boolean): number {
    const phase = RestoreBackupOverlayMotionCoordinator.phase();
    if (phase === 'loading') {
      return RestoreBackupOverlayMotionCoordinator.sequence();
    }
    if (phase === 'dissolving' && !reducedMotion) {
      return RestoreBackupOverlayMotionCoordinator.sequence();
    }
    if (phase === 'dissolving' && reducedMotion) {
      const sequence = RestoreBackupOverlayMotionCoordinator.sequence();
      RestoreBackupOverlayMotionCoordinator.publish(sequence, 'loading');
      return sequence;
    }
    RestoreBackupOverlayMotionCoordinator.clearCompleteCloseTimer();
    const sequence = RestoreBackupOverlayMotionCoordinator.nextSequence();
    // Reduced motion reaches the same loading terminal immediately. It does
    // not alter the Core restore or invent a broader F3 policy.
    RestoreBackupOverlayMotionCoordinator.publish(sequence, reducedMotion ? 'loading' : 'dissolving');
    return sequence;
  }

  static finishConfirmToLoading(sequence: number): void {
    if (!RestoreBackupOverlayMotionCoordinator.isCurrent(sequence, 'dissolving')) return;
    AppStorage.setOrCreate<string>(RestoreBackupOverlayMotionCoordinator.K_PHASE, 'loading');
  }

  static beginComplete(close: () => void): number {
    RestoreBackupOverlayMotionCoordinator.clearCompleteCloseTimer();
    if (RestoreBackupOverlayMotionCoordinator.phase() === 'complete' &&
      RestoreBackupOverlayMotionCoordinator.completeCloseTimer !== 0) {
      return RestoreBackupOverlayMotionCoordinator.sequence();
    }
    const sequence = RestoreBackupOverlayMotionCoordinator.nextSequence();
    RestoreBackupOverlayMotionCoordinator.publish(sequence, 'complete');
    // This timer is presentation-only and starts only after Core has already
    // committed its real success terminal. It must not decide whether Core
    // succeeded, failed, or is still restoring.
    RestoreBackupOverlayMotionCoordinator.completeCloseTimer = setTimeout((): void => {
      RestoreBackupOverlayMotionCoordinator.completeCloseTimer = 0;
      if (!RestoreBackupOverlayMotionCoordinator.isCurrentCompleteTerminal(sequence)) return;
      close();
    }, RestoreBackupOverlayMotionCoordinator.COMPLETE_AUTO_CLOSE_DURATION_MS);
    return sequence;
  }

  static cancel(): void {
    RestoreBackupOverlayMotionCoordinator.clearCompleteCloseTimer();
    const sequence = RestoreBackupOverlayMotionCoordinator.nextSequence();
    RestoreBackupOverlayMotionCoordinator.publish(sequence, 'idle');
  }

  static isCurrent(sequence: number, phase: RestoreBackupOverlayPresentationPhase): boolean {
    return sequence > 0 && RestoreBackupOverlayMotionCoordinator.sequence() === sequence &&
      RestoreBackupOverlayMotionCoordinator.phase() === phase;
  }

  private static isCurrentCompleteTerminal(sequence: number): boolean {
    return RestoreBackupOverlayMotionCoordinator.isCurrent(sequence, 'complete') &&
      (AppStorage.get<string>('reader.routeId') ?? '') === 'restore-result' &&
      (AppStorage.get<string>('reader.coreBackupStatus') ?? '') === 'success';
  }

  private static publish(sequence: number, phase: RestoreBackupOverlayPresentationPhase): void {
    AppStorage.setOrCreate<number>(RestoreBackupOverlayMotionCoordinator.K_SEQUENCE, sequence);
    AppStorage.setOrCreate<string>(RestoreBackupOverlayMotionCoordinator.K_PHASE, phase);
  }

  private static clearCompleteCloseTimer(): void {
    if (RestoreBackupOverlayMotionCoordinator.completeCloseTimer !== 0) {
      clearTimeout(RestoreBackupOverlayMotionCoordinator.completeCloseTimer);
      RestoreBackupOverlayMotionCoordinator.completeCloseTimer = 0;
    }
  }

  private static nextSequence(): number {
    RestoreBackupOverlayMotionCoordinator.nextSequenceValue += 1;
    if (RestoreBackupOverlayMotionCoordinator.nextSequenceValue > 2147483646) {
      RestoreBackupOverlayMotionCoordinator.nextSequenceValue = 1;
    }
    return RestoreBackupOverlayMotionCoordinator.nextSequenceValue;
  }
}
