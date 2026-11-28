import type { ReadingPrefetchActivity } from './ReadingPrefetchHost';
import type { ReadingCommit } from './ReadingCommit';

type AutomaticReadingStatus = 'paused' | 'running' | 'stopped';

export interface ReadingAutomaticSpeech {
  pause(): Promise<void>;
}

export interface ReadingAutomaticPageHost {
  inputAllowed(): boolean;
  retirePendingStarts(): void;
  cancelSpeechStart(): void;
  status(): AutomaticReadingStatus;
  pause(): void;
  canStart(): boolean;
  speech(): ReadingAutomaticSpeech | undefined;
  beginStart(): number;
  speechPauseNeeded(): boolean;
  speechPauseCurrent(speech: ReadingAutomaticSpeech | undefined, start: number): () => boolean;
  pauseFailed(error: Error, isCurrent: () => boolean): void;
  admitStart(start: number): boolean;
  start(resuming: boolean): void;
}

export interface ReadingPrefetchPresentation {
  readonly chapterIndex: number;
  readonly committed: ReadingCommit | undefined;
  readonly pageStart: number | undefined;
  readonly active: boolean;
  readonly playing: boolean;
}

export interface ReadingContentMutationPosition {
  readonly sourceId: string;
  readonly bookId: string;
  readonly chapterIndex: number;
  readonly offset: number;
  readonly current: () => boolean;
  readonly persist: () => Promise<void>;
}

export interface ReadingContentMutationGateway {
  hasPendingSourceSwitch(): boolean;
  runProgressCommitSerial(operation: () => Promise<void>): Promise<void>;
}

export interface ReadingContentMutationHost {
  firstPagePersistence(): Promise<void>;
  gateway(): ReadingContentMutationGateway;
  capture(gateway: ReadingContentMutationGateway): ReadingContentMutationPosition | undefined;
  committed(): ReadingCommit | undefined;
}

export interface ReadingReplaceReloadHost {
  active(): boolean;
  retireSearchPublication(): void;
  deferDuringSettlement(): boolean;
  invalidateProcessedContent(): void;
  reopenMappedPosition(): void;
}

/** Arbitrates auxiliary work with the already-presented page and the single
 * durable progress owner. Platform actors own timers, feedback and rendering. */
export class ReadingAuxiliaryFlowBridge {
  toggleAutomaticPaging(host: ReadingAutomaticPageHost): void {
    if (!host.inputAllowed()) {
      host.retirePendingStarts();
      return;
    }
    host.cancelSpeechStart();
    const status = host.status();
    if (status === 'running') {
      host.pause();
      return;
    }
    if (!host.canStart()) return;
    const speech = host.speech();
    const generation = host.beginStart();
    const isCurrent = host.speechPauseCurrent(speech, generation);
    if (speech !== undefined && host.speechPauseNeeded()) {
      // Native pause dispatches before paging intent. Neither its queue nor a
      // delayed failure from a replaced actor may gate the accepted timer.
      void speech.pause().catch((error: Error): void => {
        if (!isCurrent()) return;
        host.pause();
        host.pauseFailed(error, isCurrent);
      });
    }
    if (host.admitStart(generation)) host.start(status === 'paused');
  }

  reportPrefetch(presentation: ReadingPrefetchPresentation, interacted: boolean, yieldToReading: boolean,
    publish: (activity: ReadingPrefetchActivity) => void): void {
    const committed = presentation.committed;
    const chapterIndex = presentation.chapterIndex;
    publish({ chapterIndex,
      chapterOffset: committed?.chapterIndex === chapterIndex ? committed.chapterOffset : presentation.pageStart ?? 0,
      active: presentation.active, playing: presentation.playing, interacted, yieldToReading });
  }

  async confirmPositionForMutation(host: ReadingContentMutationHost): Promise<() => boolean> {
    await host.firstPagePersistence();
    const gateway = host.gateway();
    await gateway.runProgressCommitSerial(async (): Promise<void> => {});
    const position = host.capture(gateway);
    if (position === undefined) throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
    await position.persist();
    const committed = host.committed();
    if (!position.current() || committed?.sourceId !== position.sourceId || committed.bookId !== position.bookId ||
      committed.chapterIndex !== position.chapterIndex || committed.chapterOffset !== position.offset) {
      throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
    }
    return position.current;
  }

  reloadAfterReplacement(host: ReadingReplaceReloadHost): void {
    if (!host.active()) return;
    host.retireSearchPublication();
    if (host.deferDuringSettlement()) return;
    host.invalidateProcessedContent();
    host.reopenMappedPosition();
  }
}

type ReadingCapsuleKind = 'autoPage' | 'tts';

export interface ReadingCapsuleMeasurement {
  readonly kind: ReadingCapsuleKind;
  readonly identity: string;
  readonly width: number;
  readonly height: number;
}

/** Only the measurement from the live stationary capsule may replace its
 * native geometry. A frozen page holds one latest sample until settlement. */
export class ReadingAuxiliaryCapsuleMeasurements {
  private pending: ReadingCapsuleMeasurement | undefined = undefined;

  observe(kind: ReadingCapsuleKind, identity: string, width: number, height: number,
    current: (identity: string, kind: ReadingCapsuleKind) => boolean, frozen: () => boolean,
    committed: () => ReadingCapsuleMeasurement | undefined): ReadingCapsuleMeasurement | undefined {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !current(identity, kind)) return undefined;
    const sample: ReadingCapsuleMeasurement = { kind, identity, width, height };
    if (frozen()) {
      this.pending = sample;
      return undefined;
    }
    return this.admit(sample, current, committed);
  }

  flush(current: (identity: string, kind: ReadingCapsuleKind) => boolean,
    committed: () => ReadingCapsuleMeasurement | undefined): ReadingCapsuleMeasurement | undefined {
    const sample = this.pending;
    this.retirePending();
    if (sample === undefined) return undefined;
    return this.admit(sample, current, committed);
  }

  retirePending(): void { this.pending = undefined; }

  private admit(sample: ReadingCapsuleMeasurement,
    current: (identity: string, kind: ReadingCapsuleKind) => boolean,
    committed: () => ReadingCapsuleMeasurement | undefined): ReadingCapsuleMeasurement | undefined {
    if (!current(sample.identity, sample.kind)) return undefined;
    const before = committed();
    if (before !== undefined && before.kind === sample.kind && before.identity === sample.identity &&
      Math.abs(before.width - sample.width) < 0.01 && Math.abs(before.height - sample.height) < 0.01) return undefined;
    return sample;
  }
}
