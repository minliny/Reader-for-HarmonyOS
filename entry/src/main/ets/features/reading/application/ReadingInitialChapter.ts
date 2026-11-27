import type { ReadingInitialEntryGateway } from './ReadingSessionFlowGateway';
import type { LocalReadingProgressState, LocalReadingToc, LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReadingEntrySnapshot as PreparedReadingEntry } from './ReadingEntryPreparation';
import type { ReadingEntrySnapshot } from './ReadingEntrySnapshot';
import type { ReadingParagraphBoundaryMode } from './ReadingParagraphProjection';
import type { RemoteReadingSession, RemoteReadingTocEntry } from './RemoteReadingFlowGateway';
import type { RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import { RemoteReadingGatewayError } from './RemoteReadingContract.ts';
import { RemoteReadingSourceError } from './RemoteContentAdmission.ts';

export type InitialReadingSnapshot = ReadingEntrySnapshot | PreparedReadingEntry;

export interface InitialReadingSelection {
  chapterIndex: number | undefined;
  bookmark: ReaderBookmarkAnchorRequest | undefined;
}

export interface InitialReadingOpenRequest {
  chapterIndex: number;
  lifecycleToken: number;
  selectionToken: number;
  offset: number | undefined;
  positionContext: RemoteReadingPositionContext | undefined;
  layoutReady: Promise<void[]>;
  unreadCandidates?: number[];
}

/** All owner mutations and live component reads stay at these explicit entry points. */
export interface ReadingInitialChapterHost {
  selectionToken(): number;
  isSelectionActive(lifecycleToken: number, selectionToken: number): boolean;
  hasFailed(): boolean;
  ensureSession(lifecycleToken: number, selectionToken: number, discardPreparedSession?: boolean): Promise<void>;
  startTrace(lifecycleToken: number): void;
  trace(phase: string, lifecycleToken: number): void;
  loadAppearance(lifecycleToken: number): Promise<void>;
  loadSettings(lifecycleToken: number): Promise<void>;
  activeGateway(): ReadingInitialEntryGateway;
  bookId(): string;
  isLocal(): boolean;
  sourceSwitchRequested(): boolean;
  hasPendingSourceSwitch(): boolean;
  remoteSession(): RemoteReadingSession | undefined;
  paragraphBoundaryMode(): ReadingParagraphBoundaryMode;
  preparedEntry(): PreparedReadingEntry | undefined;
  discardPreparedEntry(): void;
  retirePreparedSession(): void;
  waitForContentIdle(): Promise<void>;
  clearChapterWindow(): void;
  loadToc(isCurrent: () => boolean): Promise<LocalReadingToc>;
  admitFullToc(entries: LocalReadingTocEntry[]): void;
  admitSnapshotToc(snapshot: InitialReadingSnapshot): boolean;
  configureChapterWindow(): void;
  readableToc(): LocalReadingTocEntry[];
  selection(): InitialReadingSelection;
  positionContext(bookmark: ReaderBookmarkAnchorRequest): RemoteReadingPositionContext | undefined;
  requireKnownChapter(chapterIndex: number | undefined): number;
  restoreProgress(progress: LocalReadingProgressState | undefined, consumedBookmark: ReaderBookmarkAnchorRequest | undefined): void;
  openInitialChapter(request: InitialReadingOpenRequest): Promise<void>;
  fail(error: Error, lifecycleToken: number): void;
}

export async function loadInitialReading(lifecycleToken: number, host: ReadingInitialChapterHost): Promise<void> {
  const selectionToken = host.selectionToken();
  host.startTrace(lifecycleToken);
  // Only final page admission waits for typography. Acquisition can start in parallel.
  const layoutReady = Promise.all([host.loadAppearance(lifecycleToken), host.loadSettings(lifecycleToken)])
    .then((loaded: void[]): void[] => {
      host.trace('layout-ready', lifecycleToken);
      return loaded;
    });
  void layoutReady.catch((): void => {});
  try {
    await host.ensureSession(lifecycleToken, selectionToken);
    if (!host.isSelectionActive(lifecycleToken, selectionToken) || host.hasFailed()) return;
    await loadInitialChapter(lifecycleToken, layoutReady, host);
  } catch (error) {
    if (host.isSelectionActive(lifecycleToken, selectionToken)) host.fail(error as Error, lifecycleToken);
  }
}

export async function restartPreparedReadingEntry(
  lifecycleToken: number,
  selectionToken: number,
  layoutReady: Promise<void[]>,
  host: ReadingInitialChapterHost,
): Promise<void> {
  host.retirePreparedSession();
  await host.ensureSession(lifecycleToken, selectionToken, true);
  if (host.isSelectionActive(lifecycleToken, selectionToken)) {
    await loadInitialChapter(lifecycleToken, layoutReady, host);
  }
}

async function loadInitialChapter(lifecycleToken: number, layoutReady: Promise<void[]>,
  host: ReadingInitialChapterHost, contentRetryCount: number = 0): Promise<void> {
  // Preserve the original rejection for openChapter and observe it while Core reads.
  void layoutReady.catch((): void => {});
  const selectionToken = host.selectionToken();
  const isCurrent = (): boolean => host.isSelectionActive(lifecycleToken, selectionToken);
  const contentCurrent = host.activeGateway().captureEntryContentValidity?.() ?? ((): boolean => true);
  try {
    const previous = host.preparedEntry();
    if (previous !== undefined && !previous.isCurrent()) {
      await restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady, host);
      return;
    }
    let prepared = host.preparedEntry()?.isCurrent() === true ? host.preparedEntry() : undefined;
    if ((prepared === undefined || prepared.catalogPending === true) &&
      host.activeGateway().loadEntrySnapshot !== undefined &&
      await tryInitialEntrySnapshot(lifecycleToken, selectionToken, layoutReady, host)) return;
    if (!isCurrent()) return;
    if (prepared?.catalogPending === true) {
      // A rejected narrow snapshot cannot be used as a full directory.
      prepared = undefined;
      host.discardPreparedEntry();
    }
    const initialLoad = await Promise.all([
      prepared === undefined ? host.loadToc(isCurrent) : Promise.resolve(prepared.toc),
      (prepared === undefined ? host.activeGateway().loadProgress(host.bookId(), isCurrent) : Promise.resolve(prepared.progress))
        .then((progress: LocalReadingProgressState): LocalReadingProgressState => {
          if (isCurrent()) host.trace('initial-progress', lifecycleToken);
          return progress;
        }),
    ]);
    if (!isCurrent()) return;
    if (prepared !== undefined && !prepared.isCurrent()) {
      await restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady, host);
      return;
    }
    // Process-owned presented progress outranks a prior durable or prepared snapshot.
    const pendingPresentation = host.activeGateway().pendingPresentedProgress?.();
    const progress = pendingPresentation ?? initialLoad[1];
    if (pendingPresentation !== undefined) host.discardPreparedEntry();
    host.admitFullToc(initialLoad[0].entries);
    if (!isCurrent()) return;
    host.configureChapterWindow();
    const selection = host.selection();
    const requested = selection.chapterIndex, bookmark = selection.bookmark;
    const context = bookmark === undefined ? undefined : initialBookmarkContext(bookmark, requested, host);
    const restored = progress.kind === 'restored' ? progress.progress : undefined;
    const target = bookmark?.chapterIndex ?? (requested === undefined ? restored?.chapterIndex : requested);
    const remoteSession = host.remoteSession();
    const tryLeadingEmpty = !host.isLocal() && remoteSession !== undefined &&
      progress.kind === 'missing' && requested === undefined && bookmark === undefined &&
      !host.sourceSwitchRequested() && !host.hasPendingSourceSwitch();
    const unreadCandidates = tryLeadingEmpty && remoteSession !== undefined ?
      readerUnreadDirectoryCandidates(host.readableToc(), remoteSession.entries) : [];
    if (tryLeadingEmpty && unreadCandidates.length === 0) {
      throw new RemoteReadingSourceError('SOURCE_TOC_EMPTY', '目录没有可阅读的章节');
    }
    const chapterIndex = host.requireKnownChapter(tryLeadingEmpty ? unreadCandidates[0] : target);
    // Explicit directory and bookmark selection never borrow the old resume offset.
    host.restoreProgress(bookmark !== undefined || requested !== undefined ? undefined : progress, bookmark);
    await host.openInitialChapter({ chapterIndex, lifecycleToken, selectionToken, offset: bookmark?.chapterOffset,
      positionContext: context, layoutReady, unreadCandidates: unreadCandidates.slice(1) });
  } catch (error) {
    if (!isCurrent()) return;
    if (!contentCurrent() && contentRetryCount < 2 &&
      !(error instanceof RemoteReadingGatewayError && (error.code === 'storageFailure' || error.code === 'identityMismatch'))) {
      if (host.selection().bookmark?.directoryTargetProof !== undefined) {
        // Reopening the same selection would also replay its old proof.
        // Keep the original position and surface the current selection error.
        const failure = error instanceof RemoteReadingGatewayError && error.code === 'positionContextStale' ?
          error : new RemoteReadingGatewayError('positionContextStale', 'READING_DIRECTORY_TARGET_STALE');
        host.fail(failure, lifecycleToken);
        return;
      }
      await host.waitForContentIdle();
      if (!isCurrent()) return;
      host.discardPreparedEntry();
      host.clearChapterWindow();
      await loadInitialChapter(lifecycleToken, layoutReady, host, contentRetryCount + 1);
      return;
    }
    host.fail(error as Error, lifecycleToken);
  }
}

async function tryInitialEntrySnapshot(lifecycleToken: number, selectionToken: number,
  layoutReady: Promise<void[]>, host: ReadingInitialChapterHost): Promise<boolean> {
  const gateway = host.activeGateway();
  if (gateway.loadEntrySnapshot === undefined || gateway.hasPendingSourceSwitch()) return false;
  const isCurrent = (): boolean => host.isSelectionActive(lifecycleToken, selectionToken);
  const selection = host.selection();
  const requested = selection.chapterIndex, bookmark = selection.bookmark;
  let pending = gateway.pendingPresentedProgress?.();
  const pendingPosition = pending?.kind === 'restored' ? pending.progress : undefined;
  let context: RemoteReadingPositionContext | undefined;
  if (bookmark !== undefined) {
    context = initialBookmarkContext(bookmark, requested, host);
  } else if (requested === undefined && pendingPosition?.bodyVersion !== undefined && pendingPosition.processingVersion !== undefined) {
    context = { bodyVersion: pendingPosition.bodyVersion, processingVersion: pendingPosition.processingVersion,
      anchors: [{ id: 'presented', offset: pendingPosition.chapterOffset }] };
  }
  const target = bookmark?.chapterIndex ?? requested ?? pendingPosition?.chapterIndex;
  const prepared = host.preparedEntry();
  // Latest in-memory progress and explicit navigation outrank a shelf resume.
  const usePrepared = prepared?.catalogPending === true && prepared.isCurrent() &&
    bookmark === undefined && requested === undefined && pending === undefined;
  host.trace(usePrepared ? 'entry-prepared' : 'entry-core-read', lifecycleToken);
  if (!usePrepared) host.discardPreparedEntry();
  let snapshot: InitialReadingSnapshot | undefined = usePrepared ? prepared : await gateway
    .loadEntrySnapshot(target, isCurrent, context, host.paragraphBoundaryMode()).catch((error: Error) => {
      if (error instanceof RemoteReadingGatewayError && error.code === 'cacheDerivedCorrupt') return undefined;
      throw error;
    });
  if (!isCurrent()) return true;
  if (snapshot === undefined && requested === undefined && bookmark === undefined &&
    !host.sourceSwitchRequested() && !gateway.hasPendingSourceSwitch() &&
    pending?.kind === 'restored' && pending.presentationPending === true && pendingPosition?.bodyVersion !== undefined &&
    pendingPosition.processingVersion !== undefined && gateway.awaitPresentedProgressPersistence !== undefined) {
    // Settle the original write, then ask Core to prove the durable body without a new target.
    if (JSON.stringify(gateway.pendingPresentedProgress?.()) !== JSON.stringify(pending)) return false;
    const confirmed = await gateway.awaitPresentedProgressPersistence() ?? pendingPosition;
    if (!isCurrent()) return true;
    if (gateway.pendingPresentedProgress?.() !== undefined || confirmed.chapterIndex !== pendingPosition.chapterIndex ||
      confirmed.chapterOffset !== pendingPosition.chapterOffset || confirmed.bodyVersion !== pendingPosition.bodyVersion ||
      confirmed.processingVersion !== pendingPosition.processingVersion) return false;
    snapshot = await gateway.loadEntrySnapshot(undefined, isCurrent, undefined, host.paragraphBoundaryMode());
    if (!isCurrent()) return true;
    if (snapshot?.resumeOnly !== true || snapshot.progress.kind !== 'restored' ||
      snapshot.chapter.chapterIndex !== confirmed.chapterIndex) return false;
    const restored = snapshot.progress.progress, migration = snapshot.chapter.positionMigration;
    const samePosition = restored.bodyVersion === confirmed.bodyVersion && restored.processingVersion === confirmed.processingVersion &&
      restored.chapterOffset === confirmed.chapterOffset;
    const correctedPosition = migration?.status === 'committed' && migration.previousBodyVersion === confirmed.bodyVersion &&
      migration.previousProcessingVersion === confirmed.processingVersion && migration.progress?.chapterIndex === confirmed.chapterIndex &&
      migration.progress.bodyVersion === restored.bodyVersion && migration.progress.processingVersion === restored.processingVersion &&
      migration.progress.chapterOffset === restored.chapterOffset;
    if (!samePosition && !correctedPosition) return false;
    pending = undefined;
    context = undefined;
  }
  if (snapshot === undefined || !snapshot.isCurrent()) return false;
  // Detect intent changes while the snapshot was being read.
  if (JSON.stringify(gateway.pendingPresentedProgress?.()) !== JSON.stringify(pending)) return false;
  if (!host.admitSnapshotToc(snapshot)) return false;
  host.configureChapterWindow();
  host.restoreProgress(bookmark !== undefined || requested !== undefined ? undefined : pending ?? snapshot.progress,
    bookmark);
  host.trace('entry-snapshot', lifecycleToken);
  await host.openInitialChapter({ chapterIndex: snapshot.chapter.chapterIndex, lifecycleToken, selectionToken,
    offset: bookmark?.chapterOffset ?? (snapshot.chapter.documentRange === undefined ? undefined : snapshot.requestedScalar),
    positionContext: context, layoutReady });
  return true;
}

function initialBookmarkContext(bookmark: ReaderBookmarkAnchorRequest, requested: number | undefined,
  host: ReadingInitialChapterHost): RemoteReadingPositionContext | undefined {
  if (!Number.isSafeInteger(bookmark.chapterOffset) || bookmark.chapterOffset < 0 ||
    (requested !== undefined && requested !== bookmark.chapterIndex)) throw new Error('READING_POSITION_SCOPE_MISMATCH');
  if (!host.isLocal() && bookmark.chapterOffset > 0 && bookmark.positionScope === undefined) {
    throw new Error('READING_POSITION_SCOPE_UNAVAILABLE');
  }
  return host.positionContext(bookmark);
}

/** Remote unread entry tries at most three readable chapters, in session order. */
export function readerUnreadDirectoryCandidates(
  readableEntries: LocalReadingTocEntry[],
  remoteEntries: RemoteReadingTocEntry[],
): number[] {
  const navigable = new Set<number>(readableEntries.map((entry: LocalReadingTocEntry): number => entry.index));
  const candidates: number[] = [];
  for (const entry of remoteEntries) {
    if (!navigable.has(entry.index) || entry.url.trim().length === 0) continue;
    candidates.push(entry.index);
    if (candidates.length === 3) break;
  }
  return candidates;
}
