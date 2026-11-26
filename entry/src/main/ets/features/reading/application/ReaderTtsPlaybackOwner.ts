import type { ReaderTtsCapsuleTiming } from '../../../app/ReaderStartupTrace';
import type { ReadingSessionChapter } from './ReadingChapterWindow';
import type { ReaderTtsPreparation } from './ReaderTtsConfigAdmission';
import type { ReaderTtsStartInput } from './ReaderTtsSessionCoordinator';
import type { ReaderTtsState } from './ReaderTtsState';

export interface ReaderControlPlaybackPresentation {
  readonly lifecycleToken: number;
  readonly sourceId: string;
  readonly bookId: string;
  readonly openRevision: number;
  readonly moduleVisitRevision: number;
  readonly module: string;
}

export interface ReaderTtsPlaybackScope {
  readonly lifecycleToken: number;
  readonly selectionToken: number;
  readonly sourceId: string;
  readonly bookId: string;
}

interface ReaderTtsPlayIntent {
  readonly generation: number;
  readonly scope: ReaderTtsPlaybackScope;
  readonly presentation: ReaderControlPlaybackPresentation;
  capsuleFallback: boolean;
}

export interface ReaderTtsPlaybackCoordinator {
  pause(): Promise<void>;
  resume(): Promise<void>;
  hasConfirmedUserPause(generation: number): boolean;
  setDesiredPlaying(value: boolean): void;
  start(input: ReaderTtsStartInput, desiredPlaying: boolean, timing?: ReaderTtsCapsuleTiming): Promise<void>;
  whenStarted(): Promise<boolean>;
}

export interface ReaderTtsStartPage {
  readonly chapter: ReadingSessionChapter;
  readonly startScalar: number;
}

export interface ReaderTtsPauseWitness {
  readonly speechGeneration: number;
  confirm(): void;
}

export interface ReaderTtsPlaybackHost {
  scope(): ReaderTtsPlaybackScope;
  scopeCurrent(scope: ReaderTtsPlaybackScope): boolean;
  state(): ReaderTtsState;
  coordinator(): ReaderTtsPlaybackCoordinator | undefined;
  inputAllowed(): boolean;
  retireBlockedStarts(): void;
  cancelAutoPageStart(): void;
  stopAutoPage(): void;
  initialize(lifecycleToken: number, retry: boolean): Promise<boolean>;
  startPage(): ReaderTtsStartPage | undefined;
  hydrateEntry(chapter: ReadingSessionChapter): Promise<void>;
  startInput(page: ReaderTtsStartPage): ReaderTtsStartInput;
  logFailure(operation: string, error: Error): void;
}

export interface ReaderTtsPlaybackPresentation {
  capture(): ReaderControlPlaybackPresentation;
  beginForStart(): boolean;
  beginForResume(presentation: ReaderControlPlaybackPresentation): boolean | undefined;
  pauseWitness(): ReaderTtsPauseWitness | undefined;
  desiredPlaying(): boolean;
  timing(): ReaderTtsCapsuleTiming | undefined;
  showStatic(presentation: ReaderControlPlaybackPresentation): void;
  observeStart(): void;
  fail(): void;
}

/** One reader's pending play and resume intents. Only the accepted coordinator
 * controls audio and the Core queue. Each deferred callback remains attached
 * to the original reader lifecycle, selection and coordinator where applicable. */
export class ReaderTtsPlaybackOwner {
  private generation: number = 0;
  private pendingStart: boolean = false;
  private resumeIntent: ReaderTtsPlayIntent | undefined = undefined;
  private readonly host: ReaderTtsPlaybackHost;
  private readonly presentation: ReaderTtsPlaybackPresentation;
  private readonly preparation: ReaderTtsPreparation;

  constructor(host: ReaderTtsPlaybackHost, presentation: ReaderTtsPlaybackPresentation, preparation: ReaderTtsPreparation) {
    this.host = host;
    this.presentation = presentation;
    this.preparation = preparation;
  }

  startPending(): boolean { return this.pendingStart; }

  cancelPending(): void {
    this.pendingStart = false;
    this.clearResumePresentation();
    this.generation = this.generation >= Number.MAX_SAFE_INTEGER ? 1 : this.generation + 1;
  }

  clearResumePresentation(): void { this.resumeIntent = undefined; }

  acknowledgeResume(state: ReaderTtsState, capsuleAbsent: () => boolean): ReaderControlPlaybackPresentation | undefined {
    const intent = this.resumeIntent;
    if (intent === undefined || state.status === 'preparing' || state.status === 'resuming' ||
      (state.status === 'playing' && state.audioStarted !== true)) return undefined;
    this.clearResumePresentation();
    return state.status === 'playing' && state.audioStarted === true && capsuleAbsent() && this.isCurrent(intent) ?
      intent.presentation : undefined;
  }

  toggle(): void {
    this.toggleIntent();
  }

  private isCurrent(intent: ReaderTtsPlayIntent): boolean {
    return intent.generation === this.generation && this.host.scopeCurrent(intent.scope);
  }

  private newIntent(): ReaderTtsPlayIntent {
    this.cancelPending();
    return {
      generation: this.generation, scope: this.host.scope(),
      presentation: this.presentation.capture(), capsuleFallback: false,
    };
  }

  private toggleIntent(pending?: ReaderTtsPlayIntent): void {
    if (pending !== undefined && !this.isCurrent(pending)) return;
    if (!this.host.inputAllowed()) {
      this.host.retireBlockedStarts();
      return;
    }
    const intent = pending ?? this.newIntent();
    if (!this.isCurrent(intent)) return;
    this.host.cancelAutoPageStart();
    const status = this.host.state().status;
    const starting = status !== 'playing' && status !== 'preparing' && status !== 'paused' &&
      status !== 'interrupted' && status !== 'stopping';
    this.pendingStart = starting;
    if (pending === undefined && starting) intent.capsuleFallback = this.presentation.beginForStart();
    const retryAvailability = this.preparation.resolved() && this.host.state().status === 'unavailable';
    if (!this.preparation.resolved() || retryAvailability) {
      this.initialize(intent, retryAvailability);
      return;
    }
    const coordinator = this.host.coordinator();
    if (coordinator === undefined || this.host.state().status === 'unavailable') {
      this.cancelPending();
      this.presentation.fail();
      return;
    }
    const availableStatus = this.host.state().status;
    if (availableStatus === 'playing' || availableStatus === 'preparing') {
      this.pause(coordinator, intent);
    } else if (availableStatus === 'paused' || availableStatus === 'interrupted') {
      this.resume(coordinator, intent);
    } else if (availableStatus !== 'stopping') {
      this.start(coordinator, intent);
    }
  }

  private initialize(intent: ReaderTtsPlayIntent, retry: boolean): void {
    void this.host.initialize(this.host.scope().lifecycleToken, retry).then((available: boolean): void => {
      if (available && this.isCurrent(intent)) this.toggleIntent(intent);
      else if (this.isCurrent(intent)) {
        this.cancelPending();
        this.presentation.fail();
      }
    }).catch((error: Error): void => {
      if (!this.isCurrent(intent)) return;
      this.cancelPending();
      this.host.logFailure('initialize', error);
      this.presentation.fail();
    });
  }

  private pause(coordinator: ReaderTtsPlaybackCoordinator, intent: ReaderTtsPlayIntent): void {
    const witness = this.presentation.pauseWitness();
    void coordinator.pause().then((): void => {
      if (witness !== undefined && this.host.coordinator() === coordinator && this.isCurrent(intent) &&
        coordinator.hasConfirmedUserPause(witness.speechGeneration)) witness.confirm();
    }).catch((error: Error): void => this.host.logFailure('pause', error));
  }

  private resume(coordinator: ReaderTtsPlaybackCoordinator, intent: ReaderTtsPlayIntent): void {
    this.host.stopAutoPage();
    const fallback = this.presentation.beginForResume(intent.presentation);
    if (fallback !== undefined) {
      intent.capsuleFallback = fallback;
      if (fallback) this.resumeIntent = intent;
    }
    void coordinator.resume().catch((error: Error): void => {
      this.host.logFailure('resume', error);
      if (this.host.coordinator() !== coordinator || !this.isCurrent(intent)) return;
      this.clearResumePresentation();
      this.presentation.fail();
    });
  }

  private start(coordinator: ReaderTtsPlaybackCoordinator, intent: ReaderTtsPlayIntent): void {
    const page = this.host.startPage();
    if (page === undefined) {
      this.host.retireBlockedStarts();
      return;
    }
    if (page.chapter.documentRange !== undefined) {
      void this.host.hydrateEntry(page.chapter).then((): void => {
        if (this.isCurrent(intent)) this.toggleIntent(intent);
      }).catch((error: Error): void => {
        if (!this.isCurrent(intent)) return;
        this.cancelPending();
        this.host.logFailure('entry expansion', error);
        this.presentation.fail();
      });
      return;
    }
    if (!this.host.inputAllowed()) {
      this.host.retireBlockedStarts();
      return;
    }
    this.host.stopAutoPage();
    coordinator.setDesiredPlaying(this.presentation.desiredPlaying());
    this.pendingStart = false;
    const timing = this.presentation.timing();
    const started = coordinator.start(this.host.startInput(page), this.presentation.desiredPlaying(), timing);
    if (intent.capsuleFallback) {
      void coordinator.whenStarted().then((confirmed: boolean): void => {
        if (confirmed && this.host.coordinator() === coordinator && this.isCurrent(intent)) {
          this.presentation.showStatic(intent.presentation);
        }
      });
    }
    void started.then((): void => {
      if (this.isCurrent(intent) && this.host.coordinator() === coordinator) this.presentation.observeStart();
    }).catch((error: Error): void => {
      if (!this.isCurrent(intent)) return;
      this.host.logFailure('start', error);
      this.presentation.fail();
    });
  }
}
