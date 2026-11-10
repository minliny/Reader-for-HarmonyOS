import {
  createReaderAutoPageState, startReaderAutoPage, resumeReaderAutoPage, pauseReaderAutoPage,
  stopReaderAutoPage, invalidateReaderAutoPageState, setReaderAutoPageSpeed, tickReaderAutoPage,
  commitReaderAutoPageTurn, retryReaderAutoPageTurn, endReaderAutoPageAtBookEnd,
  isReaderAutoPageTurnDue, type ReaderAutoPageState, type ReaderAutoPagePauseReason,
  type ReaderAutoPageStopReason,
} from './ReaderAutoPageState.ts';
import {
  createDefaultReaderAutoPageFullConfiguration, normalizeReaderAutoPageFullConfiguration,
  readerAutoPageFullTimerDurationSeconds, setReaderAutoPageFullSpeed, setReaderAutoPageFullFollowHighlight,
  type ReaderAutoPageFullConfiguration,
} from './ReaderAutoPageFullState.ts';
import type { ReaderPageTurnOutcome } from './ReaderPageGestureState.ts';

export interface ReaderAutoPageHost {
  now(): number;
  schedule(callback: () => void, delayMs: number): number;
  cancel(handle: number): void;
  active(): boolean;
  ready(): boolean;
  canResumeTurn(): boolean;
  turn(): ReaderPageTurnOutcome;
  changed(): void;
}

/** Owns the automatic-reading intent, both deadlines and pending page commit.
 * The existing pure reducer remains the transition authority. UI schedules
 * through this use case; it never retains a writable playback-state mirror.
 */
export class ReaderAutoPageCoordinator {
  private state: ReaderAutoPageState = createReaderAutoPageState(8);
  private configuration: ReaderAutoPageFullConfiguration = createDefaultReaderAutoPageFullConfiguration();
  private pageTimer: number = -1;
  private pageDeadline: number = 0;
  private pageTimerGeneration: number = 0;
  private sessionTimer: number = -1;
  private sessionDeadline: number = 0;
  private sessionTimerGeneration: number = 0;
  private remainingSessionSeconds: number = 15 * 60;
  private turnPending: boolean = false;
  private startGeneration: number = 0;
  private startPending: boolean = false;
  private readonly host: ReaderAutoPageHost;

  constructor(host: ReaderAutoPageHost) { this.host = host; }

  snapshot(_revision: number = 0): Readonly<ReaderAutoPageState> { return this.state; }
  configurationAt(_revision: number = 0): Readonly<ReaderAutoPageFullConfiguration> { return this.configuration; }
  pendingStart(): boolean { return this.startPending; }
  beginStart(): number { this.cancelStart(); this.startPending = true; return this.startGeneration; }
  admitStart(generation: number): boolean {
    if (!this.startPending || generation !== this.startGeneration) return false;
    this.startPending = false;
    return true;
  }
  isStartCurrent(generation: number): boolean { return generation === this.startGeneration; }
  cancelStart(): void { this.startGeneration = this.nextGeneration(this.startGeneration); this.startPending = false; }

  reset(): void {
    this.dispose();
    this.publish(createReaderAutoPageState(this.state.speedSeconds));
    this.resetSessionDuration();
  }
  start(): void { this.publish(startReaderAutoPage(this.state)); }
  resume(): void { this.publish(resumeReaderAutoPage(this.state)); }
  stop(reason: ReaderAutoPageStopReason = 'manual'): void {
    this.cancelStart(); this.turnPending = false;
    this.clearPageTimer(); this.clearSessionTimer();
    this.publish(stopReaderAutoPage(this.state, reason));
    this.resetSessionDuration();
  }
  dispose(): void {
    this.cancelStart(); this.turnPending = false;
    this.clearPageTimer(); this.clearSessionTimer();
    this.publish(invalidateReaderAutoPageState(this.state));
  }
  pause(reason: ReaderAutoPagePauseReason): void {
    if (this.state.status !== 'running') return;
    this.turnPending = false;
    this.capturePageRemaining(); this.captureSessionRemaining();
    if (this.sessionDuration() > 0 && this.remainingSessionSeconds <= 0) {
      this.stop(); return;
    }
    this.publish(pauseReaderAutoPage(this.state, reason));
    // Resume counts from the captured remainder, even when the pause ends
    // before the old deadline. Retaining that deadline consumes paused time.
    this.clearPageTimer(); this.clearSessionTimer();
  }
  setSpeed(speed: number): void {
    const normalized = Math.max(2, Math.min(20, Math.round(speed)));
    if (normalized === this.state.speedSeconds) return;
    this.configuration = setReaderAutoPageFullSpeed(this.configuration, normalized);
    this.publish(setReaderAutoPageSpeed(this.state, normalized));
    if (this.state.status === 'running' && !this.state.awaitingPageCommit) this.armPageTimer(true);
  }
  setSessionTimer(minutes: number, seconds: number): void {
    if (this.state.status !== 'stopped') return;
    this.configuration = normalizeReaderAutoPageFullConfiguration({
      timerMinutes: minutes, timerSeconds: seconds, speedSeconds: this.state.speedSeconds,
      followHighlight: this.configuration.followHighlight,
    });
    this.resetSessionDuration(); this.host.changed();
  }
  setFollowHighlight(enabled: boolean): void {
    if (this.state.status !== 'stopped') return;
    this.configuration = setReaderAutoPageFullFollowHighlight(this.configuration, enabled);
    this.host.changed();
  }
  cancelPendingTurn(): void { this.turnPending = false; }
  /** A failed catalog cannot satisfy the pending chapter-boundary turn. */
  catalogLoadFailed(): boolean {
    if (!this.turnPending || !isReaderAutoPageTurnDue(this.state)) return false;
    this.stop('catalogUnavailable');
    return true;
  }
  retryTurn(generation: number): void { this.publish(retryReaderAutoPageTurn(this.state, generation)); }
  pageCommitted(): void {
    if (this.state.awaitingPageCommit) this.publish(commitReaderAutoPageTurn(this.state, this.state.generation));
    if (this.state.status === 'running') this.armPageTimer(true);
  }
  resumePendingTurn(): void {
    if (!this.turnPending) return;
    if (!isReaderAutoPageTurnDue(this.state)) { this.turnPending = false; return; }
    if (!this.host.canResumeTurn()) return;
    this.requestTurn(this.state.generation);
  }
  requestTurn(generation: number): void {
    this.turnPending = false;
    if (generation !== this.state.generation || !isReaderAutoPageTurnDue(this.state)) return;
    const result = this.host.turn();
    if (result.kind === 'boundary' && result.edge === 'end') {
      this.publish(endReaderAutoPageAtBookEnd(this.state, generation));
      this.clearPageTimer(); this.clearSessionTimer();
    } else if (result.kind === 'busy' || result.kind === 'preparing') this.turnPending = true;
  }
  armPageTimer(resetDeadline: boolean): void {
    this.clearPageTimer(false);
    if (!this.host.active() || !this.host.ready() || this.state.status !== 'running' || this.state.awaitingPageCommit) return;
    const now = this.host.now();
    if (resetDeadline || this.pageDeadline <= now) this.pageDeadline = now + this.state.remainingSeconds * 1000;
    const timerGeneration = this.pageTimerGeneration;
    const generation = this.state.generation;
    this.pageTimer = this.host.schedule((): void => {
      if (timerGeneration !== this.pageTimerGeneration || generation !== this.state.generation ||
        !this.host.active() || this.state.status !== 'running') return;
      this.pageTimer = -1;
      this.capturePageRemaining();
      if (isReaderAutoPageTurnDue(this.state)) this.requestTurn(generation);
      else this.armPageTimer(false);
    }, Math.max(1, Math.min(1000, this.pageDeadline - now)));
  }
  clearPageTimer(resetDeadline: boolean = true): void {
    if (this.pageTimer >= 0) this.host.cancel(this.pageTimer);
    this.pageTimer = -1; this.pageTimerGeneration = this.nextGeneration(this.pageTimerGeneration);
    if (resetDeadline) this.pageDeadline = 0;
  }
  armSessionTimer(resetDeadline: boolean): void {
    this.clearSessionTimer(false);
    const configured = this.sessionDuration();
    if (configured <= 0 || !this.host.active() || this.state.status !== 'running') return;
    if (resetDeadline) this.remainingSessionSeconds = configured;
    else if (this.remainingSessionSeconds <= 0) { this.stop(); return; }
    const now = this.host.now();
    if (resetDeadline || this.sessionDeadline <= now) this.sessionDeadline = now + this.remainingSessionSeconds * 1000;
    const generation = this.sessionTimerGeneration;
    this.sessionTimer = this.host.schedule((): void => {
      if (generation !== this.sessionTimerGeneration || !this.host.active() || this.state.status !== 'running') return;
      this.sessionTimer = -1;
      this.captureSessionRemaining();
      if (this.remainingSessionSeconds <= 0) this.stop();
      else this.armSessionTimer(false);
    }, Math.max(1, Math.min(1000, this.sessionDeadline - now)));
  }
  clearSessionTimer(resetDeadline: boolean = true): void {
    if (this.sessionTimer >= 0) this.host.cancel(this.sessionTimer);
    this.sessionTimer = -1; this.sessionTimerGeneration = this.nextGeneration(this.sessionTimerGeneration);
    if (resetDeadline) this.sessionDeadline = 0;
  }
  private sessionDuration(): number { return readerAutoPageFullTimerDurationSeconds(this.configuration); }
  private nextGeneration(value: number): number { return value >= Number.MAX_SAFE_INTEGER ? 1 : value + 1; }
  private resetSessionDuration(): void { this.remainingSessionSeconds = this.sessionDuration(); }
  private captureSessionRemaining(): void {
    if (this.sessionDeadline > 0 && this.remainingSessionSeconds > 0)
      this.remainingSessionSeconds = Math.max(0, Math.ceil((this.sessionDeadline - this.host.now()) / 1000));
  }
  private capturePageRemaining(): void {
    if (this.pageDeadline <= 0 || this.state.awaitingPageCommit) return;
    const remaining = Math.max(0, Math.ceil((this.pageDeadline - this.host.now()) / 1000));
    const elapsed = this.state.remainingSeconds - remaining;
    if (elapsed > 0) this.publish(tickReaderAutoPage(this.state, this.state.generation, elapsed));
  }
  private publish(state: ReaderAutoPageState): void {
    if (state === this.state) return;
    this.state = state; this.host.changed();
  }
}
