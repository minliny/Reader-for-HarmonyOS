export const READER_CHAPTER_LOADING_DELAY_MS = 180;

export type ReaderChapterLoadSource = 'cache' | 'local' | 'coldRemote';

export interface ReaderChapterPresentationLease {
  readonly lifecycleToken: number;
  readonly selectionToken: number;
  readonly source: ReaderChapterLoadSource;
  readonly startedAtMs: number;
}

interface ReaderPendingChapterPresentation<Frame> {
  lease: ReaderChapterPresentationLease;
  origin: Frame | undefined;
  bodyReadyAtMs: number | undefined;
}

/** The incoming chapter cannot replace the committed frame until its complete
 * first viewport is ready. The caller retains ownership of native rendering. */
export class ReaderChapterPresentationGate<Frame> {
  private pending: ReaderPendingChapterPresentation<Frame> | undefined = undefined;

  begin(lifecycleToken: number, selectionToken: number, source: ReaderChapterLoadSource,
    origin: Frame | undefined, startedAtMs: number): ReaderChapterPresentationLease {
    const previous = this.pending;
    const lease: ReaderChapterPresentationLease = { lifecycleToken, selectionToken, source, startedAtMs };
    this.pending = { lease, origin: origin ?? (previous?.lease.lifecycleToken === lifecycleToken ? previous.origin : undefined),
      bodyReadyAtMs: undefined };
    return lease;
  }

  current(lifecycleToken: number, selectionToken: number): ReaderChapterPresentationLease | undefined {
    const lease = this.pending?.lease;
    return lease?.lifecycleToken === lifecycleToken && lease.selectionToken === selectionToken ? lease : undefined;
  }

  owns(lease: ReaderChapterPresentationLease): boolean {
    return this.pending?.lease === lease;
  }

  visibleOrigin(lease: ReaderChapterPresentationLease): Frame | undefined {
    const pending = this.pending;
    return pending?.lease === lease ? pending.origin : undefined;
  }

  markBodyReady(lease: ReaderChapterPresentationLease, nowMs: number): boolean {
    const pending = this.pending;
    if (pending === undefined || pending.lease !== lease || !Number.isFinite(nowMs)) return false;
    if (pending.bodyReadyAtMs === undefined) pending.bodyReadyAtMs = Math.max(lease.startedAtMs, nowMs);
    return true;
  }

  shouldShowLoading(lease: ReaderChapterPresentationLease, nowMs: number): boolean {
    const pending = this.pending;
    if (pending === undefined || pending.lease !== lease || lease.source !== 'coldRemote' || !Number.isFinite(nowMs)) return false;
    const threshold = lease.startedAtMs + READER_CHAPTER_LOADING_DELAY_MS;
    return nowMs >= threshold && (pending.bodyReadyAtMs === undefined || pending.bodyReadyAtMs >= threshold);
  }

  complete(lease: ReaderChapterPresentationLease, present?: () => void): boolean {
    if (!this.owns(lease)) return false;
    present?.();
    if (this.owns(lease)) this.clear();
    return true;
  }

  cancel(lease: ReaderChapterPresentationLease): boolean {
    if (!this.owns(lease)) return false;
    this.clear();
    return true;
  }

  clear(): void { this.pending = undefined; }
}
