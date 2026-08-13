// ReaderControlMotionCoordinator — transient ownership for the three visible
// reader-control actors (top bar, control sheet, and module navigation).
//
// The durable route and business state remain in ReaderUiStore/ReaderReducer.
// This coordinator owns only the short-lived visual phase needed to keep the
// actors mounted while `reader.control.hide` plays.  In particular, it never
// owns a book, a chapter, a module selection, or a navigation destination.
import { MotionAdapter } from '../adapters/MotionAdapter';
import { MotionSpecRegistry } from './MotionSpecRegistry';

export type ReaderControlMotionPhase = 'hidden' | 'entering' | 'visible' | 'exiting';

export class ReaderControlMotionCoordinator {
  static readonly K_PHASE: string = 'reader.control.motionPhase';

  private static settleTimer: number = 0;
  private static sequence: number = 0;

  static isImmersiveRoute(routeId: string): boolean {
    return routeId === 'immersive-reading' || routeId === 'reader_content';
  }

  static isControlRoute(routeId: string): boolean {
    return routeId === 'reader' || routeId === 'control-layer-base-v2' ||
      routeId === 'reader-directory-overlay-v2' ||
      routeId === 'reader-appearance-overlay-v2' ||
      routeId === 'reader-tts-overlay-v2' ||
      routeId === 'reader-settings-overlay-v2' ||
      routeId === 'reader-search-overlay-v2' ||
      routeId === 'reader-replace-overlay-v2' ||
      routeId === 'reader-auto-scroll-overlay-v2';
  }

  // Only the unexpanded control home can dismiss straight back to the
  // immersive surface.  Overlay/module routes keep their existing route-pop
  // behavior so a panel close does not accidentally hide the whole control
  // system.
  static isControlHomeRoute(routeId: string): boolean {
    return routeId === 'reader' || routeId === 'control-layer-base-v2';
  }

  static phase(): ReaderControlMotionPhase {
    const value: string = AppStorage.get<string>(ReaderControlMotionCoordinator.K_PHASE) ?? 'hidden';
    if (value === 'entering' || value === 'visible' || value === 'exiting') return value;
    return 'hidden';
  }

  static beginEnter(reducedMotion: boolean): void {
    const phase = ReaderControlMotionCoordinator.phase();
    if (phase === 'entering' || phase === 'visible') return;
    ReaderControlMotionCoordinator.cancelPendingSettle();
    const sequence = ReaderControlMotionCoordinator.nextSequence();
    AppStorage.setOrCreate<string>(ReaderControlMotionCoordinator.K_PHASE, 'entering');
    ReaderControlMotionCoordinator.scheduleSettle(
      'reader.control.show', reducedMotion, sequence, 'visible', undefined,
    );
  }

  // Returns false when a newer hide has already taken ownership.  The caller
  // must not route-pop in that case: one exit animation owns exactly one pop.
  static beginExit(reducedMotion: boolean, complete: () => void): boolean {
    if (ReaderControlMotionCoordinator.phase() === 'exiting') return false;
    ReaderControlMotionCoordinator.cancelPendingSettle();
    const sequence = ReaderControlMotionCoordinator.nextSequence();
    AppStorage.setOrCreate<string>(ReaderControlMotionCoordinator.K_PHASE, 'exiting');
    ReaderControlMotionCoordinator.scheduleSettle(
      'reader.control.hide', reducedMotion, sequence, 'hidden', complete,
    );
    return true;
  }

  static reset(): void {
    ReaderControlMotionCoordinator.cancelPendingSettle();
    ReaderControlMotionCoordinator.nextSequence();
    AppStorage.setOrCreate<string>(ReaderControlMotionCoordinator.K_PHASE, 'hidden');
  }

  private static nextSequence(): number {
    ReaderControlMotionCoordinator.sequence += 1;
    if (ReaderControlMotionCoordinator.sequence > 2147483646) {
      ReaderControlMotionCoordinator.sequence = 1;
    }
    return ReaderControlMotionCoordinator.sequence;
  }

  private static scheduleSettle(motionId: string, reducedMotion: boolean, sequence: number,
    phase: ReaderControlMotionPhase, complete: (() => void) | undefined): void {
    const spec = MotionSpecRegistry.byId(motionId);
    const duration = spec === undefined ? 0 : MotionAdapter.durationFor(spec, reducedMotion);
    if (duration <= 0) {
      if (sequence !== ReaderControlMotionCoordinator.sequence) return;
      ReaderControlMotionCoordinator.finish(sequence, phase, complete);
      return;
    }
    ReaderControlMotionCoordinator.settleTimer = setTimeout((): void => {
      ReaderControlMotionCoordinator.settleTimer = 0;
      if (sequence !== ReaderControlMotionCoordinator.sequence) return;
      ReaderControlMotionCoordinator.finish(sequence, phase, complete);
    }, duration);
  }

  private static finish(sequence: number, phase: ReaderControlMotionPhase,
    complete: (() => void) | undefined): void {
    // On hide the route callback unmounts the outgoing actors.  Run it before
    // publishing `hidden`, otherwise a one-frame visible reset can occur as
    // opacity/translate state returns to its default while the old route is
    // still mounted.  A redirect may start a newer sequence; never overwrite
    // that newer phase afterwards.
    if (complete !== undefined) complete();
    if (sequence !== ReaderControlMotionCoordinator.sequence) return;
    AppStorage.setOrCreate<string>(ReaderControlMotionCoordinator.K_PHASE, phase);
  }

  private static cancelPendingSettle(): void {
    if (ReaderControlMotionCoordinator.settleTimer !== 0) {
      clearTimeout(ReaderControlMotionCoordinator.settleTimer);
      ReaderControlMotionCoordinator.settleTimer = 0;
    }
  }
}
