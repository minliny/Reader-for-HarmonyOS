import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import hilog from '@ohos.hilog';
import { ReaderCoreGateway, type ShelfBook } from '../../app/ReaderCoreGateway';
import { BookAcquisitionProjectionGateway, type BookAcquisitionDetailProjection } from '../../app/BookAcquisitionProjectionGateway';
import type { BookAcquisitionCandidate } from '../../app/BookAcquisitionCoordinator';
import { errorMessageOf } from '../../app/ErrorMessage';
import { BookshelfFlowGateway } from '../bookshelf/BookshelfFlowGateway';
import { SourceGateway } from '../source/SourceGateway';
import { LocalReadingFlowGateway, LOCAL_SOURCE_ID, type LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { RemoteReadingFlowGateway, RemoteChapterCacheRefreshError, type RemoteReadingBookSeed, type RemoteReadingSession } from './RemoteReadingFlowGateway';
import { remoteReadingFailureKindOf, verdictForFailureKind, type RemoteContentVerdict } from './RemoteContentAdmission';
import { sameRemoteSessionEvidence, copyRemoteReadingSession, preparedRemoteChapterMatches,
  preparedRemoteChapterPositionMatches, withPreparedRemoteChapter } from './RemoteReadingEvidence';
import { captureRemotePositionContext, type RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import { ReadingOfflineGateway } from './ReadingOfflineGateway';
import { ReaderDirectoryHost } from './ReaderDirectoryHost';
import { ReadingPrefetchHost } from './ReadingPrefetchHost';
import type { ReadingBookDetail } from './ReadingBookDetail';
import type { ReadingEntrySeed } from './ReadingEntryPreparation';
import { MangaAdmissionGateway } from '../manga/MangaAdmissionGateway';
import { MangaBookPresentation } from '../manga/MangaBookPresentation';

export interface ReadingEntrySnapshot {
  scopeId: number;
  sessionGeneration: number;
  book?: ReadingBookDetail;
  seed?: RemoteReadingBookSeed;
  toc: LocalReadingTocEntry[];
  session?: RemoteReadingSession;
  inBookshelf: boolean;
  loadingMessage: string;
  verdict: RemoteContentVerdict;
  candidateAdmissionActive: boolean;
  candidateAdmissionFailed: boolean;
  backgroundError?: string;
}
export interface ReadingEntryMembership {
  generation: number | string;
  blocked: boolean;
  value: boolean;
}
/** Page/reader facts and effects only. None of these callbacks selects a
 * candidate, validates a body or executes an acquisition/projection. */
export interface ReadingEntryLease {
  isCurrent: () => boolean;
  projectionAllowed: () => boolean;
  currentDirectory: () => LocalReadingTocEntry[];
  offlineGeneration: () => number;
  membership: () => ReadingEntryMembership;
  changed: (snapshot: ReadingEntrySnapshot) => void;
  cacheDecision: (error: RemoteChapterCacheRefreshError, current: () => boolean) => Promise<boolean>;
  notice: (title: string, message: string) => void;
  refreshShelf: () => void;
  diagnostic: (stage: string, message: string) => void;
}
export interface RemoteReadingEntryInput {
  seed: RemoteReadingBookSeed;
  sourceName: string;
  shelfSnapshot?: ShelfBook;
  /** Current Core shelf projection can establish presence, never absence. */
  shelfBooks?: ShelfBook[];
  fromSearch?: boolean;
  sourceSwitchPending?: boolean;
  resumeImmediately?: boolean;
  fallbackSeeds?: RemoteReadingBookSeed[];
  fallbackSourceNames?: string[];
  candidates?: BookAcquisitionCandidate[];
  validatedSession?: RemoteReadingSession;
  retainedSession?: RemoteReadingSession;
  retainAdmissionThroughProbe?: boolean;
}
export interface ReadingPreparationContext {
  isCurrent: () => boolean;
  foreground: () => boolean;
  shelfVisible: () => boolean;
  readingActive: () => boolean;
  settingsAvailable: () => boolean;
  revision: () => string | undefined;
  diagnostic: (message: string) => void;
}
export interface ReadingSharedShelfSeeds {
  runtime: ReaderRuntimeOwner;
  revision: string;
  seeds: Promise<ReadingEntrySeed[] | undefined>;
}
interface DetailProjectionIntent { scopeId: number; sessionGeneration: number; lease: ReadingEntryLease; }

/** One finite entry owner for catalog/body admission and optional freshness.
 * Core/coordinator retain canonical storage/acquisition; the mounted reader
 * and page retain navigation, physical lifecycle, native dialogs and layout. */
export class ReadingEntryHost {
  private static shared: ReadingEntryHost | undefined;
  private readonly runtime: ReaderRuntimeOwner;
  private lease: ReadingEntryLease | undefined;
  private state: ReadingEntrySnapshot = { scopeId: 0, sessionGeneration: 0, toc: [], inBookshelf: false,
    loadingMessage: '', verdict: 'verifying', candidateAdmissionActive: false, candidateAdmissionFailed: false };
  private probeGeneration: number = 0;
  private readableRevision: number = -1;
  private projectionActive: DetailProjectionIntent | undefined;
  private projectionPending: DetailProjectionIntent | undefined;
  private preparationGeneration: number = 0;
  private membershipGeneration: number | string = 0;
  private mangaDisplayRefreshTask: Promise<void> | undefined;
  private mangaDisplayRefreshSession: RemoteReadingSession | undefined;
  private mangaDisplayRefreshedSession: RemoteReadingSession | undefined;
  /** Last detail admission input is retained only for an explicit, in-place
   * directory retry. It is cleared when the owner retires and is never used
   * as a background refresh trigger. */
  private lastRemoteInput: RemoteReadingEntryInput | undefined;
  private lastLocalSelection: ShelfBook | undefined;

  constructor(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) { this.runtime = runtime; }
  static forRuntime(runtime: ReaderRuntimeOwner = ReaderRuntimeOwner.current()): ReadingEntryHost {
    if (!ReaderRuntimeOwner.isCurrent(runtime)) throw new Error('READING_ENTRY_OWNER_RETIRED');
    if (ReadingEntryHost.shared?.owns(runtime) !== true) {
      ReadingEntryHost.shared?.retire(); ReadingEntryHost.shared = new ReadingEntryHost(runtime);
    }
    return ReadingEntryHost.shared;
  }
  owns(runtime: ReaderRuntimeOwner): boolean { return this.runtime === runtime; }
  snapshot(): ReadingEntrySnapshot { return { ...this.state }; }
  retire(): void {
    this.lease = undefined; this.state = { ...this.state, scopeId: this.state.scopeId + 1,
      candidateAdmissionActive: false }; this.probeGeneration += 1; this.preparationGeneration += 1;
    this.projectionPending = undefined;
    this.mangaDisplayRefreshTask = undefined; this.mangaDisplayRefreshSession = undefined; this.mangaDisplayRefreshedSession = undefined;
    this.lastRemoteInput = undefined;
    this.lastLocalSelection = undefined;
  }

  async openLocal(selection: ShelfBook, lease: ReadingEntryLease, resumeImmediately: boolean = false): Promise<void> {
    if (selection.sourceId !== LOCAL_SOURCE_ID) throw new Error('LOCAL_DETAIL_SOURCE_MISMATCH');
    this.lastLocalSelection = { ...selection };
    this.lastRemoteInput = undefined;
    const scope = this.begin(lease, { sourceId: selection.sourceId, sourceName: '本地书籍', bookId: selection.bookId,
      title: selection.title, author: selection.author, kind: selection.kind, coverUrl: selection.coverUrl,
      intro: selection.intro, lastChapter: selection.lastChapter, contentKind: selection.contentKind }, true, '正在读取本地目录…');
    if (resumeImmediately) return;
    const current = this.current(scope, lease);
    try {
      const toc = await new LocalReadingFlowGateway(this.runtime).loadToc(selection.bookId);
      if (!current()) return;
      this.state = { ...this.state, toc: toc.entries, loadingMessage: '' }; this.publish(scope, lease);
      await this.projectDirectory(scope);
    } catch (error) {
      if (!current()) return;
      this.state = { ...this.state, toc: [], loadingMessage: errorMessageOf(error) }; this.publish(scope, lease);
      this.diagnostic(lease, 'local-detail', error);
    }
  }

  async openRemote(input: RemoteReadingEntryInput, lease: ReadingEntryLease): Promise<void> {
    this.lastRemoteInput = { ...input,
      seed: { ...input.seed },
      fallbackSeeds: input.fallbackSeeds?.map((seed): RemoteReadingBookSeed => ({ ...seed })),
      fallbackSourceNames: input.fallbackSourceNames?.slice(),
      candidates: input.candidates?.map((candidate): BookAcquisitionCandidate => ({ ...candidate, seed: { ...candidate.seed } })) };
    this.lastLocalSelection = undefined;
    const seed: RemoteReadingBookSeed = { ...input.seed, contentKind: input.shelfSnapshot?.contentKind ??
      input.validatedSession?.contentKind ?? input.seed.contentKind };
    if (seed.contentKind === 'audio') {
      if (this.runtimeCurrent() && lease.isCurrent()) lease.notice('暂不支持此类阅读', '当前版本未接入此类阅读器，书籍和已下载内容仍保留。');
      return;
    }
    const retained = input.shelfSnapshot !== undefined && this.sameBook(input.retainedSession, seed) ? input.retainedSession : undefined;
    const scope = this.begin(lease, this.detail(seed, input.sourceName), input.shelfSnapshot !== undefined,
      input.shelfSnapshot === undefined ? '正在获取在线目录…' : '正在读取本地目录…', seed, retained);
    const current = this.current(scope, lease);
    if (input.resumeImmediately) {
      if (input.shelfSnapshot !== undefined) this.runtime.noteReadingPreparationIntent(seed.sourceId, seed.bookId);
      if (this.sameBook(input.validatedSession, seed) &&
        this.runtime.bookAcquisitions().hasCurrentCatalogProjection(input.validatedSession!)) {
        this.install(input.validatedSession); this.state = { ...this.state, toc: this.catalog(input.validatedSession!) };
        this.publish(scope, lease);
      }
      return;
    }
    const admissionStartedAt = Date.now();
    let admissionMeasured = false;
    ReadingPrefetchHost.forRuntime(this.runtime).noteCatalogRefresh(seed, input.shelfSnapshot?.lastCheckAt);
    const seeds: RemoteReadingBookSeed[] = [seed, ...(input.fallbackSeeds ?? [])];
    const names: string[] = [input.sourceName, ...(input.fallbackSourceNames ?? [])];
    const candidates = seeds.map((candidate): BookAcquisitionCandidate => input.candidates?.find(row =>
      row.seed.sourceId === candidate.sourceId && row.seed.bookId === candidate.bookId) ??
      { seed: candidate, catalogReady: false, failed: false });
    let shelf = input.shelfSnapshot, group = false;
    const coordinator = this.runtime.bookAcquisitions();
    try {
      // A filtered shelf cannot prove absence. This actual exact read precedes
      // candidate fallback; it never gates publication of the selected DTO.
      if (input.fromSearch && shelf === undefined) {
        const membership = lease.membership();
        shelf = await new ReaderCoreGateway(this.runtime).loadShelfBook(seed.sourceId, seed.bookId);
        if (!current()) return;
        this.reconcileMembership(shelf !== undefined, membership, scope, lease);
      }
      if (!current()) return;
      const membership = lease.membership();
      group = shelf === undefined && input.fromSearch === true && input.sourceSwitchPending !== true &&
        !membership.blocked && !membership.value;
      this.state = { ...this.state, candidateAdmissionActive: group || input.retainAdmissionThroughProbe === true };
      this.publish(scope, lease);
      const choiceGeneration = lease.membership().generation;
      const admissionCurrent = (): boolean => current() && (!group || choiceGeneration === lease.membership().generation);
      const supplied = input.validatedSession?.contentKind !== 'manga' && this.sameBook(input.validatedSession, seed) &&
        coordinator.hasCurrentCatalogProjection(input.validatedSession!) && preparedRemoteChapterMatches(
        input.validatedSession?.preparedChapter, input.validatedSession!, undefined, coordinator.readingProjectionRevision());
      const admission = supplied ? { session: input.validatedSession!, backgroundRefresh: undefined } : group ?
        await coordinator.acquireCandidateGroup(candidates, { isCurrent: admissionCurrent, requireReadable: true,
          onCatalog: (session): void => { if (admissionCurrent()) this.admitCatalog(session, seeds, names, scope, lease); } }) :
        await coordinator.acquireBookWithBackgroundRefresh(seed, { isCurrent: current });
      if (!admissionCurrent()) return;
      const session = admission.session;
      const index = seeds.findIndex(candidate => this.sameBook(session, candidate));
      if (index < 0 || (!group && index !== 0)) throw new Error('REMOTE_DETAIL_ADMISSION_IDENTITY_MISMATCH');
      this.admissionDiagnostic(scope, lease, session.identity, admissionStartedAt, session.acquisitionMode);
      admissionMeasured = true;
      const sourceName = names[index]?.trim() || session.identity.sourceId;
      const suppliedShelf = shelf?.sourceId === session.identity.sourceId && shelf.bookId === session.identity.bookId ? shelf :
        input.shelfBooks?.find(book => book.sourceId === session.identity.sourceId && book.bookId === session.identity.bookId);
      this.install(session);
      this.state = { ...this.state, seed: seeds[index], book: this.sessionDetail(session, sourceName),
        toc: this.catalog(session), inBookshelf: suppliedShelf !== undefined, loadingMessage: '' };
      this.publish(scope, lease);
      const probe = this.probe(scope);
      if (suppliedShelf === undefined) void this.readMembership(session, scope, lease);
      if (sourceName === session.identity.sourceId) void this.resolveSourceName(session, scope, lease);
      void this.projectDirectory(scope);
      if (admission.backgroundRefresh !== undefined) void this.refreshInBackground(seeds[index], sourceName,
        session, scope, lease, admission.backgroundRefresh);
      if (input.retainAdmissionThroughProbe) {
        const index = await probe;
        if (current() && index === undefined) this.state = { ...this.state, candidateAdmissionFailed: true };
      }
    } catch (error) {
      if (!current()) return;
      if (error instanceof RemoteChapterCacheRefreshError) { await this.refreshCachedChapter(error, scope, lease, current); return; }
      if (!admissionMeasured) this.admissionDiagnostic(scope, lease, seed, admissionStartedAt);
      const catalogAvailable = group && this.state.session !== undefined && this.state.toc.length > 0;
      if (!catalogAvailable) { this.install(undefined); this.state = { ...this.state, book: this.detail(seed, input.sourceName), toc: [] }; }
      this.state = { ...this.state, loadingMessage: errorMessageOf(error), verdict: verdictForFailureKind(remoteReadingFailureKindOf(error)),
        candidateAdmissionFailed: group || input.retainAdmissionThroughProbe === true };
      this.publish(scope, lease); this.diagnostic(lease, 'remote-detail', error);
    } finally {
      if (current()) { this.state = { ...this.state, candidateAdmissionActive: false }; this.publish(scope, lease); }
    }
  }

  /** Re-run the current detail catalog admission in place. The page keeps its
   * route and identity; this only replaces the failed/empty catalog state and
   * publishes through the existing lease generation checks. */
  async retryCatalog(): Promise<void> {
    const lease = this.lease;
    if (lease === undefined) return;
    if (this.lastLocalSelection !== undefined) {
      await this.openLocal({ ...this.lastLocalSelection }, lease, false);
      return;
    }
    const input = this.lastRemoteInput;
    if (input === undefined) return;
    await this.openRemote({ ...input, resumeImmediately: false, validatedSession: undefined, retainedSession: undefined,
      candidates: input.candidates?.map((candidate): BookAcquisitionCandidate => ({ ...candidate, failed: false })) }, lease);
  }

  /** A real reader/source-switch admission replaces only this presentation
   * lease. It does not run a detail acquisition or reconstruct the reader. */
  bindReader(book: ReadingBookDetail, session: RemoteReadingSession | undefined, toc: LocalReadingTocEntry[],
    inBookshelf: boolean, lease: ReadingEntryLease): void {
    if (session !== undefined && !this.sameBook(session, book)) throw new Error('READING_ENTRY_SESSION_IDENTITY_MISMATCH');
    this.begin(lease, book, inBookshelf, '', undefined, session, toc);
  }
  acceptSession(session: RemoteReadingSession | undefined, readableRevision?: number,
    projection?: BookAcquisitionDetailProjection): void {
    const lease = this.lease, scope = this.state.scopeId;
    if (lease === undefined || !this.current(scope, lease)()) return;
    if (session !== undefined && this.state.book !== undefined && !this.sameBook(session, this.state.book)) return;
    this.install(session, readableRevision, projection); this.publish(scope, lease);
  }

  /** Existing reader session-ready event owns catalog/book projection here;
   * the page only publishes its physical chapter/ready milestones. */
  readerSessionReady(session: RemoteReadingSession, refreshDirectoryDisplay: boolean = false): boolean {
    const lease = this.lease, scope = this.state.scopeId, book = this.state.book;
    if (lease === undefined || book === undefined || !this.current(scope, lease)() || !this.sameBook(session, book)) return false;
    const previous = this.state.toc;
    this.install(session);
    const toc = session.contentKind === 'manga' ? this.mangaDirectoryProjection(session, previous) : this.catalog(session);
    this.state = { ...this.state, book: this.sessionDetail(session, book.sourceName), toc, loadingMessage: '' };
    this.publish(scope, lease);
    if (session.contentKind === 'manga') void this.refreshMangaDirectoryDisplay(refreshDirectoryDisplay, false);
    return true;
  }

  /** One directory-only request for this owner. Prepared-pixel reuse and
   * explicit directory opening join the same task; page turns do not call it. */
  refreshMangaDirectoryDisplay(forceRead: boolean = false, allowCatalogNetwork: boolean = true): Promise<void> {
    const lease = this.lease, scope = this.state.scopeId, session = this.state.session;
    if (lease === undefined || session?.contentKind !== 'manga' || !this.current(scope, lease)()) return Promise.resolve();
    if (this.mangaDisplayRefreshSession === session && this.mangaDisplayRefreshTask !== undefined) return this.mangaDisplayRefreshTask;
    if (!forceRead && this.mangaDisplayRefreshedSession === session) return Promise.resolve();
    const generation = this.state.sessionGeneration;
    const current = (): boolean => this.current(scope, lease)() && generation === this.state.sessionGeneration && this.state.session === session;
    const allowNetwork = allowCatalogNetwork && session.acquisitionMode !== 'offline' &&
      this.runtime.mangaOfflineProbeFor?.(session.identity.sourceId, session.identity.bookId) !== true;
    this.mangaDisplayRefreshSession = session;
    const task: Promise<void> = new RemoteReadingFlowGateway(this.runtime).refreshMangaDirectoryDisplaySession(session, current, allowNetwork)
      .then((refreshed: RemoteReadingSession): void => {
        if (!current()) return;
        const previous = lease.currentDirectory();
        this.install(refreshed);
        const toc = this.mangaDirectoryProjection(refreshed, previous);
        this.state = { ...this.state, toc };
        this.mangaDisplayRefreshedSession = this.state.session;
        this.publish(scope, lease);
      }).catch((error: Error): void => {
        if (current()) {
          this.mangaDisplayRefreshedSession = session;
          this.diagnostic(lease, 'manga-directory-display', error);
        }
      }).finally((): void => {
        if (this.mangaDisplayRefreshTask === task) {
          this.mangaDisplayRefreshTask = undefined; this.mangaDisplayRefreshSession = undefined;
        }
      });
    this.mangaDisplayRefreshTask = task;
    return task;
  }
  /** Captured by the real reader-ready boundary; a later invocation cannot
   * borrow a replacement reader/session. No native work before invocation. */
  deferredDirectoryProjection(): (() => void) | undefined {
    const lease = this.lease, scope = this.state.scopeId, generation = this.state.sessionGeneration;
    if (lease === undefined || !this.current(scope, lease)()) return undefined;
    return (): void => { if (this.current(scope, lease)() && generation === this.state.sessionGeneration) void this.projectDirectory(scope); };
  }

  async probe(scope: number, preferredChapterIndex?: number, positionContext?: RemoteReadingPositionContext): Promise<number | undefined> {
    const lease = this.lease, session = this.state.session;
    if (lease === undefined || session === undefined) return undefined;
    const current = this.current(scope, lease);
    if (!current()) return undefined;
    positionContext = captureRemotePositionContext(positionContext);
    const generation = ++this.probeGeneration, coordinator = this.runtime.bookAcquisitions();
    const revision = coordinator.readingProjectionRevision();
    const ownerCurrent = (): boolean => current() && generation === this.probeGeneration && (this.state.session?.contentKind ?? 'text') === (session.contentKind ?? 'text') &&
      sameRemoteSessionEvidence(this.state.session, session);
    const probeCurrent = (): boolean => ownerCurrent() && revision === coordinator.readingProjectionRevision();
    if (session.contentKind === 'manga') {
      this.setVerdict('verifying', scope, lease);
      // First-image admission proves this exact leading chapter. Manga resume
      // is owned by MangaSessionGate, never a novel chapter/offset probe.
      const entry = session.entries.find(row => row.navigable !== false && row.url.trim().length > 0);
      if (entry === undefined || (preferredChapterIndex !== undefined && preferredChapterIndex !== entry.index)) {
        this.setVerdict('contentUnavailable', scope, lease); return undefined;
      }
      try {
        await new MangaAdmissionGateway(this.runtime).verify(session, probeCurrent);
        if (!probeCurrent()) return undefined;
        this.readableRevision = revision; this.setVerdict('readable', scope, lease);
        return entry.index;
      } catch (error) {
        if (probeCurrent()) this.setVerdict(verdictForFailureKind(remoteReadingFailureKindOf(error)), scope, lease);
        return undefined;
      }
    }
    const prepared = this.state.session?.preparedChapter;
    if (preparedRemoteChapterMatches(prepared, session, preferredChapterIndex, revision) &&
      preparedRemoteChapterPositionMatches(prepared, positionContext)) {
      this.setVerdict('readable', scope, lease); return prepared?.chapter.chapterIndex;
    }
    this.setVerdict('verifying', scope, lease);
    const entries = session.entries.filter(entry => entry.navigable !== false && entry.url.trim().length > 0);
    let start = 0, limit = Math.min(3, entries.length);
    if (preferredChapterIndex !== undefined) {
      start = entries.findIndex(entry => entry.index === preferredChapterIndex);
      if (start < 0) { this.setVerdict('contentUnavailable', scope, lease); return undefined; }
      limit = start + 1;
    }
    for (let attempt = start; attempt < limit; attempt += 1) {
      try {
        const chapter = await new RemoteReadingFlowGateway(this.runtime).loadChapter(session, entries[attempt].index, probeCurrent, false, positionContext);
        if (!probeCurrent()) return undefined;
        this.install(withPreparedRemoteChapter(this.state.session ?? session, chapter, revision, positionContext));
        this.setVerdict('readable', scope, lease); return entries[attempt].index;
      } catch (error) {
        if (!probeCurrent()) return undefined;
        if (error instanceof RemoteChapterCacheRefreshError) return this.refreshCachedChapter(error, scope, lease, ownerCurrent);
        const kind = remoteReadingFailureKindOf(error);
        if (preferredChapterIndex === undefined && kind === 'SOURCE_CONTENT_EMPTY' && attempt + 1 < limit) continue;
        this.setVerdict(verdictForFailureKind(kind), scope, lease); return undefined;
      }
    }
    if (probeCurrent()) this.setVerdict('contentUnavailable', scope, lease);
    return undefined;
  }

  /** Native first-frame TOC is a displayed DTO. Updating it neither starts
   * another acquisition nor changes the persistent reader's scope/session. */
  replaceDirectory(scope: number, entries: LocalReadingTocEntry[]): void {
    const lease = this.lease;
    if (lease === undefined || !this.current(scope, lease)()) return;
    const seen = new Set<number>();
    for (const entry of entries) {
      if (!Number.isSafeInteger(entry.index) || entry.index < 0 || seen.has(entry.index)) return;
      seen.add(entry.index);
    }
    this.state = { ...this.state, toc: entries }; this.publish(scope, lease);
  }

  async recoverCachedChapter(scope: number, error: RemoteChapterCacheRefreshError,
    admitted: () => boolean): Promise<number | undefined> {
    const lease = this.lease;
    if (lease === undefined) return undefined;
    return this.refreshCachedChapter(error, scope, lease, (): boolean => this.current(scope, lease)() && admitted());
  }

  async projectDirectory(scope: number): Promise<void> {
    const lease = this.lease, book = this.state.book, session = this.state.session;
    if (lease === undefined || book === undefined) return;
    if (book.sourceId !== LOCAL_SOURCE_ID && session === undefined) return;
    const generation = this.state.sessionGeneration, offline = lease.offlineGeneration();
    const current = (): boolean => this.current(scope, lease)() && generation === this.state.sessionGeneration &&
      offline === lease.offlineGeneration() && (session === undefined || sameRemoteSessionEvidence(this.state.session, session));
    if (!current()) return;
    try {
      let entries = session === undefined ? await new LocalReadingFlowGateway(this.runtime).loadDownloadProjection(
        book.bookId, lease.currentDirectory(), current) :
        await new ReadingOfflineGateway(this.runtime).loadDirectoryProjection(session, current);
      if (!current()) return;
      // Offline facts must not overwrite a newer bookmark mutation. Markers
      // are subsequently read by the existing shared Directory owner/mutex.
      const latest = lease.currentDirectory();
      entries = entries.map(entry => ({ ...entry,
        bookmarks: latest.find(prior => prior.index === entry.index)?.bookmarks }));
      this.state = { ...this.state, toc: entries }; this.publish(scope, lease);
    } catch (error) { if (current()) this.diagnostic(lease, 'directory-download', error); }
    if (!current()) return;
    const directory = ReaderDirectoryHost.forRuntime(this.runtime, (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime));
    if (directory === undefined) return;
    await directory.load({ book, current, currentEntries: lease.currentDirectory,
      emitEntries: (entries): void => { if (current()) { this.state = { ...this.state, toc: entries }; this.publish(scope, lease); } },
      failed: (error): void => { if (current()) this.diagnostic(lease, 'directory-bookmarks', error); } });
  }

  /** Actual semantic detail projection queue; old intent finally never
   * releases or reacquires a new owner's operation. */
  async refreshProjection(): Promise<void> {
    const lease = this.lease;
    if (lease === undefined) return;
    const intent: DetailProjectionIntent = { scopeId: this.state.scopeId, sessionGeneration: this.state.sessionGeneration, lease };
    if (!this.projectionCurrent(intent)) return;
    if (this.projectionActive !== undefined) { this.projectionPending = intent; return; }
    this.projectionActive = intent;
    const current = (): boolean => this.projectionCurrent(intent);
    const book = this.state.book!;
    try {
      const revision = this.runtime.bookAcquisitions().readingProjectionRevision();
      const row = await new BookAcquisitionProjectionGateway(this.runtime).load(book.sourceId, book.bookId, current);
      if (!current() || row?.acquisition === undefined) return;
      if (revision !== this.runtime.bookAcquisitions().readingProjectionRevision()) { this.projectionPending ??= intent; return; }
      const facts = row.acquisition, previous = this.state.session;
      if (facts.stale === true) {
        if (previous !== undefined && preparedRemoteChapterMatches(previous.preparedChapter, previous, undefined, revision) &&
          (previous.acquisitionMode === 'offline' || previous.sourceVersion !== facts.sourceVersion)) return;
        const snapshot = await new ReaderCoreGateway(this.runtime).loadShelfBook(book.sourceId, book.bookId);
        if (!current()) return;
        await this.openRemote({ seed: { sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
          title: book.title, author: book.author, intro: book.intro, coverUrl: book.coverUrl, kind: book.kind, lastChapter: book.lastChapter, contentKind: book.contentKind },
          sourceName: book.sourceName, shelfSnapshot: snapshot, retainAdmissionThroughProbe: true }, lease);
        return;
      }
      // Cached metadata cannot change the content type admitted by this owner.
      const contentKind = book.contentKind;
      const detail: ReadingBookDetail = { ...book, title: row.name ?? book.title, author: row.author ?? book.author,
        intro: row.intro ?? book.intro, coverUrl: row.coverUrl ?? book.coverUrl, kind: row.kind ?? book.kind,
        lastChapter: row.latestChapterTitle ?? book.lastChapter, contentKind,
        mangaPosition: contentKind === 'manga' ? MangaBookPresentation.get(book.sourceId, book.bookId) : undefined };
      const metadataChanged = detail.title !== book.title || detail.author !== book.author || detail.intro !== book.intro ||
        detail.coverUrl !== book.coverUrl || detail.kind !== book.kind || detail.lastChapter !== book.lastChapter ||
        detail.mangaPosition !== book.mangaPosition;
      // Shelf-only acquisition events do not replace the displayed metadata,
      // session or directory when their admitted evidence is unchanged.
      this.state = { ...this.state, book: metadataChanged ? detail : book };
      const wasReadable = this.state.verdict === 'readable';
      if (previous !== undefined && previous.catalogVersion !== undefined && previous.contextVersion !== undefined &&
        facts.catalogVersion === previous.catalogVersion && facts.contextVersion === previous.contextVersion && facts.sourceVersion === previous.sourceVersion) {
        const merged = metadataChanged ? copyRemoteReadingSession(previous) : previous;
        if (metadataChanged) { merged.book = this.remoteDetail(detail); merged.contentKind = detail.contentKind ?? previous.contentKind; }
        this.install(merged, wasReadable && facts.schemaVersion === 2 && facts.verificationCurrent === true ? revision : undefined, row);
        this.publish(intent.scopeId, lease);
        if (wasReadable && this.state.verdict === 'verifying') await this.probe(intent.scopeId);
        return;
      }
      if (typeof facts.catalogAt !== 'number') { this.publish(intent.scopeId, lease); return; }
      const session = await new RemoteReadingFlowGateway(this.runtime).openCachedCatalogSession({ sourceId: book.sourceId,
        bookId: book.bookId, detailUrl: book.bookId, title: detail.title, author: detail.author, sourceVersion: facts.sourceVersion, contentKind: detail.contentKind }, current, true);
      if (!current()) return;
      if (revision !== this.runtime.bookAcquisitions().readingProjectionRevision()) { this.projectionPending ??= intent; return; }
      const merged = copyRemoteReadingSession(session); merged.book = this.remoteDetail(detail);
      this.install(merged, wasReadable ? revision : undefined, row);
      this.state = { ...this.state, toc: this.catalog(merged), loadingMessage: '' }; this.publish(intent.scopeId, lease);
      void this.projectDirectory(intent.scopeId);
      if (this.state.verdict !== 'readable') await this.probe(intent.scopeId);
    } catch (error) { if (current()) this.backgroundFailure(intent.scopeId, lease, 'detail-projection', error); }
    finally {
      if (this.projectionActive === intent) {
        this.projectionActive = undefined; const pending = this.projectionPending; this.projectionPending = undefined;
        if (pending !== undefined && this.projectionCurrent(pending)) void this.refreshProjection();
      }
    }
  }

  preparePersisted(context: ReadingPreparationContext, shared?: ReadingSharedShelfSeeds): void {
    if (!this.runtimeCurrent() || !context.isCurrent()) return;
    this.runtime.setReadingPreparationContext(context.foreground(), !context.readingActive() && context.shelfVisible());
    const revision = context.revision(), generation = this.preparationGeneration;
    if (revision === undefined || revision.length === 0) return;
    const allowed = (): boolean => this.runtimeCurrent() && generation === this.preparationGeneration && context.isCurrent() &&
      context.shelfVisible() && !context.readingActive() && context.foreground() && context.settingsAvailable() && revision === context.revision();
    if (!allowed()) return;
    void this.runtime.readingEntryPreparations().preparePersistedShelf(revision, async (current): Promise<ReadingEntrySeed[] | undefined> => {
      if (shared !== undefined && shared.runtime === this.runtime && shared.revision === revision) {
        const seeds = await shared.seeds; if (!current()) return undefined; if (seeds !== undefined) return seeds;
      }
      const shelf = await new BookshelfFlowGateway(this.runtime, { readingState: 'all', sourceKind: 'all' }, true).loadAll(current);
      if (!current() || (shelf !== undefined && shelf.projectionRevision !== revision)) return undefined;
      return shelf?.books.filter(book => book.contentKind === undefined || book.contentKind === 'text').map(book =>
        ({ sourceId: book.sourceId, bookId: book.bookId, ...(book.contentKind === undefined ? {} : { contentKind: book.contentKind }) }));
    }, allowed).catch(error => { if (allowed()) { try { context.diagnostic(errorMessageOf(error)); } catch (_) {} } });
  }
  preparationVisibilityChanged(context: ReadingPreparationContext, shared?: ReadingSharedShelfSeeds): void {
    if (!this.runtimeCurrent() || !context.isCurrent()) return;
    this.runtime.setReadingPreparationContext(context.foreground(), !context.readingActive() && context.shelfVisible());
    this.runtime.readingEntryPreparations().setPaused(!context.shelfVisible() || !context.foreground());
    this.preparePersisted(context, shared);
  }
  prepareVisible(books: ShelfBook[], context: ReadingPreparationContext, shared?: ReadingSharedShelfSeeds): void {
    if (!this.runtimeCurrent() || !context.isCurrent() || !context.shelfVisible() || context.readingActive() || !context.foreground()) return;
    const entries: ReadingEntrySeed[] = books.filter(book => book.contentKind === undefined || book.contentKind === 'text').map(book => book.sourceId === LOCAL_SOURCE_ID ?
      { sourceId: book.sourceId, bookId: book.bookId, bookKind: book.kind, contentKind: book.contentKind } :
      { sourceId: book.sourceId, bookId: book.bookId, bookKind: book.kind, contentKind: book.contentKind, remoteBookSeed: {
        sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId, title: book.title, author: book.author,
        coverUrl: book.coverUrl, intro: book.intro, lastChapter: book.lastChapter, contentKind: book.contentKind } });
    this.runtime.readingEntryPreparations().setVisibleBooks(entries); this.runtime.readingEntryPreparations().setPaused(false);
    this.preparePersisted(context, shared);
    void this.runtime.getAppearanceStore().load().catch((): void => {});
  }

  private begin(lease: ReadingEntryLease, book: ReadingBookDetail, inBookshelf: boolean, loadingMessage: string,
    seed?: RemoteReadingBookSeed, session?: RemoteReadingSession, toc: LocalReadingTocEntry[] = []): number {
    if (!this.runtimeCurrent() || !lease.isCurrent()) throw new Error('READING_ENTRY_OWNER_RETIRED');
    const scope = this.state.scopeId + 1; this.lease = lease; this.probeGeneration += 1; this.projectionPending = undefined;
    this.membershipGeneration = lease.membership().generation;
    this.mangaDisplayRefreshTask = undefined; this.mangaDisplayRefreshSession = undefined; this.mangaDisplayRefreshedSession = undefined;
    this.state = { scopeId: scope, sessionGeneration: this.state.sessionGeneration, book, seed, toc, inBookshelf,
      loadingMessage, verdict: book.sourceId === LOCAL_SOURCE_ID ? 'readable' : 'verifying', candidateAdmissionActive: false, candidateAdmissionFailed: false };
    this.readableRevision = -1; this.install(session); this.runtime.bookAcquisitions().setPreparationVisible(false);
    this.publish(scope, lease); return scope;
  }
  private install(session: RemoteReadingSession | undefined, readableRevision?: number, projection?: BookAcquisitionDetailProjection): void {
    const previous = this.state.session, same = sameRemoteSessionEvidence(previous, session) && (previous?.contentKind ?? 'text') === (session?.contentKind ?? 'text');
    if (!same) { this.state = { ...this.state, sessionGeneration: this.state.sessionGeneration + 1 }; this.probeGeneration += 1; }
    if (session === undefined) { this.state = { ...this.state, session: undefined }; this.readableRevision = -1; return; }
    const revision = this.runtime.bookAcquisitions().readingProjectionRevision();
    const prepared = session.contentKind === 'manga' ? undefined : session.preparedChapter ?? (same ? previous?.preparedChapter : undefined);
    const valid = preparedRemoteChapterMatches(prepared, session, undefined, revision);
    let installed = session;
    if (prepared !== session.preparedChapter || (!valid && session.preparedChapter !== undefined)) {
      installed = copyRemoteReadingSession(session); installed.preparedChapter = valid ? prepared : undefined;
    }
    this.state = { ...this.state, session: installed };
    const facts = projection?.acquisition;
    const confirmed = session.contentKind !== 'manga' && readableRevision === revision && facts?.schemaVersion === 2 && facts.verificationCurrent === true && facts.stale !== true &&
      projection?.origin === session.identity.sourceId && projection.bookUrl === session.identity.bookId &&
      session.sourceVersion !== undefined && session.catalogVersion !== undefined && session.contextVersion !== undefined &&
      facts.sourceVersion === session.sourceVersion && facts.catalogVersion === session.catalogVersion && facts.contextVersion === session.contextVersion &&
      session.requiresContextRefresh !== true;
    if (valid || confirmed) { this.readableRevision = revision; this.state = { ...this.state, verdict: 'readable' }; }
    else if (!same || previous?.preparedChapter !== undefined || (this.readableRevision >= 0 && this.readableRevision !== revision)) {
      this.state = { ...this.state, verdict: 'verifying' };
    }
  }
  private async refreshCachedChapter(error: RemoteChapterCacheRefreshError, scope: number, lease: ReadingEntryLease,
    isCurrent: () => boolean): Promise<number | undefined> {
    if (!isCurrent()) return undefined;
    this.setVerdict('contentUnavailable', scope, lease);
    if (error.refreshPreserved) { this.notice(lease, '正文未更新', error.message); return undefined; }
    const sessionGeneration = this.state.sessionGeneration;
    const current = (): boolean => isCurrent() && this.current(scope, lease)() && sessionGeneration === this.state.sessionGeneration;
    let accepted = false;
    try { accepted = await lease.cacheDecision(error, current); } catch (_) { return undefined; }
    if (!accepted || !current()) return undefined;
    this.setVerdict('verifying', scope, lease);
    try {
      const coordinator = this.runtime.bookAcquisitions(), revision = coordinator.readingProjectionRevision();
      const chapter = await new RemoteReadingFlowGateway(this.runtime).loadChapter(error.session, error.chapterIndex,
        (): boolean => current() && coordinator.readingProjectionRevision() <= revision + 2, true, error.positionContext);
      if (!current()) return undefined;
      const completed = coordinator.readingProjectionRevision();
      if (completed !== revision + 2) throw new Error('正文配置已变化，请重新读取本章');
      this.install(withPreparedRemoteChapter(error.session, chapter, completed));
      this.state = { ...this.state, verdict: 'readable', loadingMessage: '' }; this.publish(scope, lease); return chapter.chapterIndex;
    } catch (failure) {
      if (current()) { this.setVerdict(verdictForFailureKind(remoteReadingFailureKindOf(failure)), scope, lease);
        this.notice(lease, '正文未更新', errorMessageOf(failure)); }
      return undefined;
    }
  }
  private admitCatalog(session: RemoteReadingSession, seeds: RemoteReadingBookSeed[], names: string[], scope: number, lease: ReadingEntryLease): void {
    const index = seeds.findIndex(seed => this.sameBook(session, seed)); if (index < 0) return;
    this.install(session); this.state = { ...this.state, seed: seeds[index], book: this.sessionDetail(session, names[index] || session.identity.sourceId),
      toc: this.catalog(session), loadingMessage: '', verdict: 'verifying' }; this.publish(scope, lease);
  }
  private async refreshInBackground(seed: RemoteReadingBookSeed, name: string, cached: RemoteReadingSession,
    scope: number, lease: ReadingEntryLease, refresh?: Promise<RemoteReadingSession>): Promise<void> {
    let displayed = cached;
    const current = (): boolean => this.current(scope, lease)() && lease.projectionAllowed() && !lease.membership().blocked &&
      sameRemoteSessionEvidence(this.state.session, displayed);
    try {
      const refreshed = await (refresh ?? this.runtime.bookAcquisitions().acquireBook(seed, { forceRefresh: true, isCurrent: current }));
      if (!current() || !this.sameBook(refreshed, cached.identity)) return;
      const changed = !sameRemoteSessionEvidence(this.state.session, refreshed); this.install(refreshed); displayed = refreshed;
      this.state = { ...this.state, book: this.sessionDetail(refreshed, name.trim() || refreshed.identity.sourceId),
        toc: this.catalog(refreshed), loadingMessage: '', backgroundError: undefined }; this.publish(scope, lease);
      if (changed || this.state.verdict !== 'readable') void this.probe(scope);
      void this.projectDirectory(scope);
      if (name.trim().length === 0 || name === refreshed.identity.sourceId) void this.resolveSourceName(refreshed, scope, lease);
      if (this.state.inBookshelf) { try { lease.refreshShelf(); } catch (_) {} }
    } catch (error) { if (current()) this.backgroundFailure(scope, lease, 'detail-refresh', error); }
  }
  private async readMembership(session: RemoteReadingSession, scope: number, lease: ReadingEntryLease): Promise<void> {
    const member = lease.membership();
    try {
      const book = await new ReaderCoreGateway(this.runtime).loadShelfBook(session.identity.sourceId, session.identity.bookId);
      if (this.current(scope, lease)() && sameRemoteSessionEvidence(this.state.session, session)) this.reconcileMembership(book !== undefined, member, scope, lease);
    } catch (error) { if (this.current(scope, lease)()) this.diagnostic(lease, 'detail-membership', error); }
  }
  private reconcileMembership(value: boolean, captured: ReadingEntryMembership, scope: number, lease: ReadingEntryLease): void {
    const current = lease.membership();
    if (!this.current(scope, lease)() || current.blocked || captured.generation !== current.generation || captured.value !== current.value) return;
    this.state = { ...this.state, inBookshelf: value }; this.publish(scope, lease);
  }
  private async resolveSourceName(session: RemoteReadingSession, scope: number, lease: ReadingEntryLease): Promise<void> {
    try {
      const sources = await new SourceGateway(this.runtime).loadSources(session.identity.sourceId);
      if (!this.current(scope, lease)() || !this.sameBook(this.state.session, session.identity) || this.state.book === undefined) return;
      const source = sources.find(source => source.sourceId === session.identity.sourceId);
      if (source !== undefined) { this.state = { ...this.state, book: { ...this.state.book, sourceName: source.name } }; this.publish(scope, lease); }
    } catch (_) { /* An optional name cannot gate readiness or invent source absence. */ }
  }
  private projectionCurrent(intent: DetailProjectionIntent): boolean {
    return this.current(intent.scopeId, intent.lease)() && intent.sessionGeneration === this.state.sessionGeneration &&
      intent.lease.projectionAllowed() && this.state.book !== undefined && this.state.book.sourceId !== LOCAL_SOURCE_ID &&
      !intent.lease.membership().blocked &&
      !this.state.candidateAdmissionActive && !this.state.candidateAdmissionFailed;
  }
  private current(scope: number, lease: ReadingEntryLease): () => boolean {
    return (): boolean => this.runtimeCurrent() && this.lease === lease && scope === this.state.scopeId && lease.isCurrent();
  }
  private runtimeCurrent(): boolean { return ReaderRuntimeOwner.isCurrent(this.runtime); }
  private publish(scope: number, lease: ReadingEntryLease): void {
    if (!this.current(scope, lease)()) return;
    const membership = lease.membership();
    // A later explicit shelf mutation owns its newer presence even when this
    // entry's independent body/name/catalog work is still publishing.
    if (membership.generation !== this.membershipGeneration) {
      this.state = { ...this.state, inBookshelf: membership.value };
    }
    try { lease.changed(this.snapshot()); } catch (_) {}
  }
  private setVerdict(verdict: RemoteContentVerdict, scope: number, lease: ReadingEntryLease): void {
    if (!this.current(scope, lease)()) return; this.state = { ...this.state, verdict }; this.publish(scope, lease);
  }
  private backgroundFailure(scope: number, lease: ReadingEntryLease, stage: string, error: unknown): void {
    this.state = { ...this.state, backgroundError: errorMessageOf(error) }; this.publish(scope, lease); this.diagnostic(lease, stage, error);
  }
  private diagnostic(lease: ReadingEntryLease, stage: string, error: unknown): void { try { lease.diagnostic(stage, errorMessageOf(error)); } catch (_) {} }
  private admissionDiagnostic(scope: number, lease: ReadingEntryLease,
    identity: { sourceId: string; bookId: string }, startedAt: number, mode?: string): void {
    if (!this.current(scope, lease)()) return;
    try {
      if (mode === undefined) {
        hilog.warn(0x5244, 'Reader',
          'PERF search-detail-admission-failed source=%{private}s book=%{private}s durationMs=%{public}d scope=%{public}d',
          identity.sourceId, identity.bookId, Date.now() - startedAt, scope);
      } else {
        hilog.info(0x5244, 'Reader',
          'PERF search-detail-admission source=%{private}s book=%{private}s mode=%{private}s durationMs=%{public}d scope=%{public}d',
          identity.sourceId, identity.bookId, mode, Date.now() - startedAt, scope);
      }
    } catch (_) { /* Diagnostics cannot change acquired catalog/body facts. */ }
  }
  private notice(lease: ReadingEntryLease, title: string, message: string): void { try { lease.notice(title, message); } catch (_) {} }
  private sameBook(session: RemoteReadingSession | undefined, book: { sourceId: string; bookId: string }): boolean {
    return session?.identity.sourceId === book.sourceId && session.identity.bookId === book.bookId;
  }
  private catalog(session: RemoteReadingSession): LocalReadingTocEntry[] {
    return session.entries.map(entry => ({ index: entry.index, title: entry.title, level: entry.level,
      displayTitle: entry.displayTitle, isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle,
      navigable: entry.navigable !== false && entry.url.trim().length > 0, downloadState: 'unknown' }));
  }
  private mangaDirectoryProjection(session: RemoteReadingSession, previous: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
    const byIndex: Map<number, LocalReadingTocEntry> = new Map();
    for (const row of previous) byIndex.set(row.index, row);
    return this.catalog(session).map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
      const retained = byIndex.get(entry.index);
      return { ...entry, downloadState: retained?.title === entry.title ? retained.downloadState : 'unknown',
        bookmarks: retained?.title === entry.title ? retained.bookmarks : undefined };
    });
  }
  private detail(seed: RemoteReadingBookSeed, name: string): ReadingBookDetail {
    return { sourceId: seed.sourceId, sourceName: name.trim() || seed.sourceId, bookId: seed.bookId, title: seed.title,
      author: seed.author, authorIdentity: seed.authorIdentity, sourceVersion: seed.sourceVersion,
      kind: seed.kind, coverUrl: seed.coverUrl, intro: seed.intro, lastChapter: seed.lastChapter,
      contentKind: seed.contentKind, mangaPosition: seed.contentKind === 'manga' ? MangaBookPresentation.get(seed.sourceId, seed.bookId) : undefined };
  }
  private sessionDetail(session: RemoteReadingSession, name: string): ReadingBookDetail {
    return { sourceId: session.identity.sourceId, sourceName: name, bookId: session.identity.bookId, ...this.remoteDetail(session.book), contentKind: session.contentKind,
      authorIdentity: session.book.authorIdentity, sourceVersion: session.sourceVersion,
      mangaPosition: session.contentKind === 'manga' ? MangaBookPresentation.get(session.identity.sourceId, session.identity.bookId) : undefined };
  }
  private remoteDetail(book: { title: string; author: string; intro?: string; coverUrl?: string; kind?: string; lastChapter?: string }):
    { title: string; author: string; intro?: string; coverUrl?: string; kind?: string; lastChapter?: string } {
    return { title: book.title, author: book.author, intro: book.intro, coverUrl: book.coverUrl, kind: book.kind, lastChapter: book.lastChapter };
  }
}
