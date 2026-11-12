import hilog from '@ohos.hilog';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReaderExitLease } from '../../../app/navigation/ReaderNavigation';
import type { BookshelfCatalogSeeds } from '../../bookshelf/application/BookshelfCatalogOwner';
import type { BookAcquisitionCandidate } from '../application/BookAcquisitionCoordinator';
import type { BookAcquisitionDetailProjection } from '../application/BookAcquisitionProjectionGateway';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { diagnosticCodeOf } from '../../../app/LogPrivacy';
import { LOCAL_SOURCE_ID, type LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { RemoteContentVerdict, RemoteReadingFailureKind } from '../application/RemoteContentAdmission';
import type { RemoteReadingBookSeed, RemoteReadingSession, RemoteChapterCacheRefreshError } from '../application/RemoteReadingFlowGateway';
import { readingSessionForCommittedSource } from './ReadingEntryDto';
import { remoteReadingEntryKind, remoteShelfDetailInput, type ReadingBookDetail } from './ReadingBookDetail';
import type { ReaderDirectoryOperation } from '../application/ReaderDirectoryHost';
import type { ReaderBookIdentity } from './ReaderBookmarkProjection';
import type { ReaderDirectoryScene } from './ReaderDirectoryOperations';
import { ReaderDirectoryBackfill } from '../application/ReaderDirectoryBackfill';
import type { ReadingOfflineOperation } from '../application/ReadingOfflineHost';
import { ReaderBookmarkAnchorRequest } from './ReaderBookmarkAnchorRequest';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readingFailureHint } from './ReadingFailurePresentation';
import { MangaBookPresentation } from '../../manga/presentation/MangaBookPresentation';
import { ReadingEntryHost, type ReadingEntryLease, type ReadingEntryMembership,
  type ReadingEntrySnapshot, type ReadingPreparationContext, type ReadingSharedShelfSeeds, type RemoteReadingEntryInput } from '../application/ReadingEntryHost';

const DOMAIN = 0x5244;

export type ReaderExitRequest = (intent?: 'navigation') => void;

export interface ReadingEntryPorts {
  current: () => boolean;
  projectionVisible: () => boolean;
  membership: () => ReadingEntryMembership;
  cacheDecision: (error: RemoteChapterCacheRefreshError, current: () => boolean) => Promise<boolean>;
  notice: (title: string, message: string) => void;
  refreshShelf: () => void;
}

export interface RemoteDetailOpening {
  shelfBooks: ShelfBook[];
  sourceSwitchPending: boolean;
  candidates: BookAcquisitionCandidate[];
  ports: ReadingEntryPorts;
}

export type ReadingShelfEntryIntent = 'info' | 'resume' | 'committedSource';

export interface ReadingShelfEntryPorts {
  sourceName: () => string;
  local: (book: ShelfBook, resume: boolean) => void;
  remote: (entry: RemoteReadingEntryInput) => void;
}

export interface CommittedReadingSourceOpening {
  sourceName: string;
  ports: ReadingEntryPorts;
}

export interface ReadingDirectoryNavigationPorts {
  openReading: (chapterIndex: number, proof?: ReaderDirectoryTargetProof) => void;
  revealReading: () => void;
  changeChapter: (keepDirectoryUntilReady: boolean, beforePresent?: () => void, afterPresent?: () => void) => void;
  unresolvedBookmark: (book: ReadingBookDetail, message: string) => void;
}

export interface PreparedReaderOpening {
  runtime: () => ReaderRuntimeOwner | undefined;
  current: () => boolean;
  afterOpening: (project: () => void) => void;
}

export interface CachedChapterRecoveryPorts {
  runtime: () => ReaderRuntimeOwner | undefined;
  notice: (message: string, label: string, action: () => void, current: () => boolean) => void;
  feedback: (message: string, current: () => boolean) => void;
}

export interface ReadingShelfPreparationScene {
  runtime?: ReaderRuntimeOwner;
  mounting: number;
  foreground: boolean;
  shelfVisible: boolean;
  settingsAvailable: boolean;
  revision: string;
  shared?: BookshelfCatalogSeeds;
}

interface ReadingShelfPreparationBinding {
  host: ReadingEntryHost;
  context: ReadingPreparationContext;
  shared?: ReadingSharedShelfSeeds;
}

export interface ReadingDirectoryReady {
  owner: ReaderRuntimeOwner;
  sourceId: string;
  bookId: string;
  generation: number;
  navigation: number;
  current: () => boolean;
  postFrame: (action: () => void) => void;
}

export interface ReadingDirectoryRouteContext {
  owner?: ReaderRuntimeOwner;
  route: string;
  retired: boolean;
  mount: number;
  navigation: number;
  foreground: boolean;
}

/** Page/session projection of the original ReadingEntryHost. No durable
 * acquisition, progress, directory or source-switch state is duplicated. */
@Observed
export class ReadingEntryPresentation {
  book: ReadingBookDetail | undefined;
  toc: LocalReadingTocEntry[] = [];
  inBookshelf: boolean = true;
  loadingMessage: string = '';
  catalogBusy: boolean = false;
  contentKind: 'text' | 'manga' = 'text';
  session: RemoteReadingSession | undefined;
  seed: RemoteReadingBookSeed | undefined;
  verdict: RemoteContentVerdict = 'readable';
  sessionGeneration: number = 0;
  scopeId: number = -1;
  sessionActive: boolean = false;
  readyGeneration: number = 0;
  directoryCurrentChapterIndex: number = -1;
  directoryChapterTitle: string = '';
  directoryPresentationGeneration: number = 0;
  directoryOperation: ReaderDirectoryOperation | undefined;
  offlineOperation: ReadingOfflineOperation | undefined;
  offlineOperationActive: boolean = false;
  host: ReadingEntryHost | undefined;
  private presentedScopeId: number = -1;
  private pendingRemoteDirectory: (() => void) | undefined;
  private pendingLocalDirectory: (() => void) | undefined;
  requestedChapterIndex: number | undefined;
  requestedMangaOfflineChapterId: string | undefined;
  mangaChapterRequestGeneration: number = 0;
  requestedMangaDirectoryTargetProof: ReaderDirectoryTargetProof | undefined;
  requestedBookmarkAnchor: ReaderBookmarkAnchorRequest | undefined;
  private mangaChapterStartRequestGeneration: number = -1;
  private mangaCommittedRequestGeneration: number = -1;
  private bookmarkAnchorRequestId: number = 0;
  private published: ReadingEntrySnapshot | undefined;
  private cacheRefreshConsent: RemoteChapterCacheRefreshError | undefined;
  recoveryNotice: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  recoveryActionLabel: string = '';
  private recoveryAction: (() => void) | undefined;
  private recoveryCurrent: (() => boolean) | undefined;
  private recoveryRevision: number = 0;
  private readonly directoryBackfill: ReaderDirectoryBackfill = new ReaderDirectoryBackfill();

  private exitRequest: ReaderExitRequest | undefined;
  private exitRequestCurrent: (() => boolean) | undefined;
  private acceptedExitIdentity: string = '';

  beginReaderPresentation(): void {
    this.readyGeneration += 1;
  }

  readerPresentationIdentity(): string {
    return JSON.stringify([this.book?.sourceId, this.book?.bookId, this.readyGeneration]);
  }

  private matchesReady(sourceId: string, bookId: string, generation: number): boolean {
    return this.sessionActive && this.readyGeneration === generation &&
      this.book?.sourceId === sourceId && this.book?.bookId === bookId;
  }

  acceptReaderPageReady(owner: ReaderRuntimeOwner, sourceId: string, bookId: string, generation: number,
    chapterIndex: number): boolean {
    if (!this.matchesReady(sourceId, bookId, generation)) return false;
    this.protectReadingChapter(owner, chapterIndex);
    return true;
  }

  armLocalDirectoryBackfill(ready: ReadingDirectoryReady): void {
    const format = this.book?.kind?.trim().toLowerCase() ?? '';
    const current = (): boolean => ready.current() && this.matchesReady(ready.sourceId, ready.bookId, ready.generation);
    if (ready.sourceId !== LOCAL_SOURCE_ID || !['epub', 'txt', 'local', 'mobi', 'azw', 'azw3', 'kf8'].includes(format) || !current()) return;
    this.directoryBackfill.arm({ key: JSON.stringify([ready.sourceId, ready.bookId, ready.generation, ready.navigation]),
      bookId: ready.bookId, format, runtime: ready.owner, current, postFrame: ready.postFrame });
  }

  startReading(owner: ReaderRuntimeOwner | undefined): void {
    this.sessionActive = true;
    owner?.setDownloadReadingProtection?.(this.book?.sourceId, this.book?.bookId);
  }

  beginReading(owner: ReaderRuntimeOwner, chapterIndex: number | undefined,
    proof?: ReaderDirectoryTargetProof, mangaOfflineChapterId?: string): void {
    this.clearExitRequest();
    this.resetChapterRequest();
    this.requestedChapterIndex = chapterIndex;
    this.requestedMangaOfflineChapterId = this.contentKind === 'manga' && chapterIndex !== undefined ? mangaOfflineChapterId : undefined;
    this.requestedMangaDirectoryTargetProof = this.contentKind === 'manga' ? proof : undefined;
    this.requestedBookmarkAnchor = undefined;
    this.resetDirectoryPosition();
    this.startReading(owner);
  }

  endReading(owner?: ReaderRuntimeOwner): void {
    this.sessionActive = false;
    this.directoryBackfill.retire();
    this.releaseReaderExit(owner);
  }

  finishReading(owner?: ReaderRuntimeOwner): void {
    this.endReading(owner);
    this.resetChapterRequest();
    this.requestedBookmarkAnchor = undefined;
    this.resetDirectoryPosition();
  }

  leaveDetail(owner: ReaderRuntimeOwner | undefined): void {
    const book = this.book, session = this.session;
    this.finishReading(owner);
    this.toc = [];
    this.book = undefined;
    // Keep only the exact remote catalog as optional input for re-admission.
    this.session = book !== undefined && book.sourceId !== LOCAL_SOURCE_ID && session !== undefined &&
      session.identity.sourceId === book.sourceId && session.identity.bookId === book.bookId ? session : undefined;
  }

  resumeRestoredSource(owner: ReaderRuntimeOwner | undefined, identitiesChanged: boolean): void {
    if (identitiesChanged) {
      this.resetChapterRequest();
      this.requestedBookmarkAnchor = undefined;
      this.clearExitRequest();
    }
    this.startReading(owner);
  }

  acceptReaderExit(owner: ReaderRuntimeOwner, readerIdentity: string): boolean {
    if (!this.sessionActive || readerIdentity !== this.readerPresentationIdentity() ||
      readerIdentity === this.acceptedExitIdentity) return false;
    // Shelf return motion can retain the session until its cover settles.
    this.acceptedExitIdentity = readerIdentity;
    const book = this.book;
    if (this.contentKind === 'manga' && book !== undefined) owner.finishMangaOfflineProbe?.(book.sourceId, book.bookId);
    this.releaseReaderExit(owner);
    return true;
  }

  private releaseReaderExit(owner: ReaderRuntimeOwner | undefined): void {
    owner?.setDownloadReadingProtection?.();
    this.clearExitRequest();
  }

  private protectReadingChapter(owner: ReaderRuntimeOwner | undefined, chapterIndex: number): void {
    if (this.sessionActive) owner?.setDownloadReadingProtection?.(this.book?.sourceId, this.book?.bookId, chapterIndex);
  }

  attachExitRequest(request: ReaderExitRequest, current: () => boolean): (() => void) | undefined {
    if (!current()) return undefined;
    this.exitRequest = request;
    this.exitRequestCurrent = current;
    return (): void => {
      if (this.exitRequestCurrent === current) this.clearExitRequest();
    };
  }

  attachSurfaceExitRequest(request: ReaderExitRequest, identity: string,
    surfaceCurrent: () => boolean, mangaGeneration?: number): (() => void) | undefined {
    return this.attachExitRequest(request, (): boolean => this.sessionActive && identity === this.readerPresentationIdentity() &&
      identity !== this.acceptedExitIdentity &&
      mangaGeneration === (this.contentKind === 'manga' ? this.mangaChapterRequestGeneration : undefined) && surfaceCurrent());
  }

  currentExitRequest(): ReaderExitRequest | undefined {
    return this.exitRequestCurrent?.() === false ? undefined : this.exitRequest;
  }

  currentExitLease(): ReaderExitLease | undefined {
    const readerIdentity = this.readerPresentationIdentity();
    if (!this.sessionActive || readerIdentity === this.acceptedExitIdentity) return undefined;
    const request = this.currentExitRequest();
    return request === undefined ? undefined : { readerIdentity, request };
  }

  clearExitRequest(): void {
    this.exitRequest = undefined;
    this.exitRequestCurrent = undefined;
  }

  prepareDirectory(fromReader: boolean): boolean {
    if (this.book === undefined || fromReader !== this.sessionActive || (fromReader && this.toc.length === 0)) return false;
    if (fromReader) {
      if (this.contentKind === 'manga') this.refreshMangaPosition();
    } else {
      this.clearExitRequest();
      this.resetChapterRequest();
      this.requestedBookmarkAnchor = undefined;
    }
    this.directoryPresentationGeneration += 1;
    return true;
  }

  setDirectoryPosition(chapterIndex: number, chapterTitle: string): void {
    this.directoryCurrentChapterIndex = chapterIndex;
    this.directoryChapterTitle = chapterTitle;
  }

  resetDirectoryPosition(): void {
    this.setDirectoryPosition(-1, '');
  }

  isKnownChapter(chapterIndex?: number): boolean {
    if (this.book?.sourceId !== LOCAL_SOURCE_ID && this.session !== undefined) {
      return this.session.entries.some(entry => entry.navigable !== false && entry.url.trim().length > 0 &&
        (chapterIndex === undefined || entry.index === chapterIndex));
    }
    return this.toc.some(entry => entry.navigable !== false && (chapterIndex === undefined || entry.index === chapterIndex));
  }

  publishOfflineOperation(operation: ReadingOfflineOperation | undefined, busy: boolean): void {
    this.offlineOperation = operation;
    this.offlineOperationActive = busy;
  }

  bookmarkIdentity(): ReaderBookIdentity | undefined {
    const book = this.book;
    if (book === undefined || book.title.trim().length === 0) return undefined;
    // The persisted bookmark key is shared by the detail and reading directories.
    return { libraryBookId: `${book.sourceId}\u0000${book.bookId}`, sourceId: book.sourceId,
      bookId: book.bookId, bookName: book.title, bookAuthor: book.author };
  }

  directoryScene(context: ReadingDirectoryRouteContext): ReaderDirectoryScene {
    const route = context.route;
    return { owner: context.owner, retired: context.retired, mount: context.mount, navigation: context.navigation,
      foreground: context.foreground, directoryVisible: route === 'directory',
      acceptsProjection: route === 'detail' || route === 'reading' || route === 'directory',
      presentation: this.directoryPresentationGeneration, sessionGeneration: this.sessionGeneration,
      reading: this.sessionActive, offlineBusy: this.offlineOperationActive, book: this.book, session: this.session };
  }

  replaceOwnedDirectoryEntries(entries: LocalReadingTocEntry[], resolveHost: () => ReadingEntryHost | undefined): void {
    this.toc = entries;
    resolveHost()?.replaceDirectory(this.scopeId, entries);
  }

  private resetChapterRequest(): void {
    this.requestedChapterIndex = undefined;
    this.requestedMangaOfflineChapterId = undefined;
    this.mangaChapterStartRequestGeneration = -1;
    this.requestedMangaDirectoryTargetProof = undefined;
  }

  mangaStartsAtChapterBeginning(): boolean {
    return this.mangaChapterStartRequestGeneration >= 0 &&
      this.mangaChapterStartRequestGeneration === this.mangaChapterRequestGeneration;
  }

  private revealCommittedChapter(chapterIndex: number, proof?: ReaderDirectoryTargetProof): boolean {
    const canReveal = proof === undefined && chapterIndex === this.directoryCurrentChapterIndex &&
      (this.contentKind !== 'manga' || (this.mangaCommittedRequestGeneration === this.mangaChapterRequestGeneration &&
        (this.requestedChapterIndex === undefined || this.requestedChapterIndex === chapterIndex)));
    if (canReveal) {
      this.requestedBookmarkAnchor = undefined;
      this.requestedMangaDirectoryTargetProof = undefined;
    }
    return canReveal;
  }

  private requestDirectoryChapter(chapterIndex: number, proof?: ReaderDirectoryTargetProof): void {
    if (this.contentKind === 'manga') this.mangaChapterRequestGeneration += 1;
    this.requestedChapterIndex = chapterIndex;
    this.requestedMangaOfflineChapterId = undefined;
    this.requestedMangaDirectoryTargetProof = this.contentKind === 'manga' ? proof : undefined;
    this.requestedBookmarkAnchor = undefined;
  }

  private requestBookmarkAnchor(chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope,
    proof?: ReaderDirectoryTargetProof): void {
    this.bookmarkAnchorRequestId += 1;
    this.requestedBookmarkAnchor =
      new ReaderBookmarkAnchorRequest(this.bookmarkAnchorRequestId, chapterIndex, chapterOffset, positionScope, proof);
  }

  selectDirectoryChapter(chapterIndex: number, proof: ReaderDirectoryTargetProof | undefined,
    navigation: ReadingDirectoryNavigationPorts): void {
    if (!this.isKnownChapter(chapterIndex)) return;
    if (!this.sessionActive) {
      navigation.openReading(chapterIndex, proof);
      return;
    }
    if (this.revealCommittedChapter(chapterIndex, proof)) {
      navigation.revealReading();
      return;
    }
    navigation.changeChapter(this.contentKind === 'manga', (): void => this.requestDirectoryChapter(chapterIndex, proof));
  }

  selectDirectoryBookmark(chapterIndex: number, chapterOffset: number, positionScope: RemoteReadingPositionScope | undefined,
    proof: ReaderDirectoryTargetProof | undefined, navigation: ReadingDirectoryNavigationPorts): void {
    if (!this.isKnownChapter(chapterIndex)) return;
    const book = this.book;
    if (book !== undefined && book.sourceId !== LOCAL_SOURCE_ID &&
      ((chapterOffset > 0 && positionScope === undefined) || (positionScope !== undefined &&
        (positionScope.sourceId !== book.sourceId || positionScope.bookId !== book.bookId ||
          positionScope.chapterIndex !== chapterIndex)))) {
      navigation.unresolvedBookmark(book, '该书签的位置暂时无法恢复，原摘录和备注仍保留，请从目录打开章节。');
      return;
    }
    if (!this.sessionActive) {
      navigation.openReading(chapterIndex);
      if (!this.sessionActive) return;
      this.resetChapterRequest();
    } else if (chapterIndex === this.directoryCurrentChapterIndex) {
      navigation.revealReading();
    } else {
      navigation.changeChapter(this.contentKind === 'manga', undefined, (): void => this.resetChapterRequest());
    }
    // The exact anchor owns chapter acquisition. A competing chapter-start
    // request can race its watcher and lose the requested position.
    this.requestBookmarkAnchor(chapterIndex, chapterOffset, positionScope, proof);
  }

  selectDirectoryTarget(chapterIndex: number, chapterOffsetScalar: number, positionScope: RemoteReadingPositionScope | undefined,
    proof: ReaderDirectoryTargetProof | undefined, navigation: ReadingDirectoryNavigationPorts): void {
    const book = this.book;
    if (book === undefined || !Number.isSafeInteger(chapterOffsetScalar) || chapterOffsetScalar < 0) return;
    if (positionScope !== undefined && (positionScope.sourceId !== book.sourceId ||
      positionScope.bookId !== book.bookId || positionScope.chapterIndex !== chapterIndex)) return;
    if (proof !== undefined && (proof.sourceId !== book.sourceId || proof.bookId !== book.bookId)) return;
    if (positionScope === undefined && proof === undefined) return;
    if (this.contentKind === 'manga') {
      // Core revalidates the exact manga directory proof. Text offsets never
      // become image positions.
      if (chapterOffsetScalar !== 0 || positionScope !== undefined || proof === undefined || proof.chapterIndex !== chapterIndex) return;
      this.selectDirectoryChapter(chapterIndex, proof, navigation);
      return;
    }
    this.selectDirectoryBookmark(chapterIndex, chapterOffsetScalar, positionScope, proof, navigation);
  }

  requestMangaChapterBeginning(chapterIndex: number): void {
    this.requestedChapterIndex = chapterIndex;
    this.requestedMangaOfflineChapterId = undefined;
    this.mangaChapterRequestGeneration += 1;
    this.mangaChapterStartRequestGeneration = this.mangaChapterRequestGeneration;
    this.requestedMangaDirectoryTargetProof = undefined;
    this.requestedBookmarkAnchor = undefined;
  }

  requestMangaPreviewBeginning(session: RemoteReadingSession, chapterIndex: number): boolean {
    if (!this.sessionActive || this.contentKind !== 'manga' ||
      this.book?.sourceId !== session.identity.sourceId || this.book?.bookId !== session.identity.bookId) return false;
    this.requestMangaChapterBeginning(chapterIndex);
    return true;
  }

  adoptCommittedSource(owner: ReaderRuntimeOwner, book: ShelfBook, session: RemoteReadingSession | undefined,
    chapterIndex: number | undefined, prepare: () => CommittedReadingSourceOpening): boolean {
    if (session === undefined || session.identity.sourceId !== book.sourceId || session.identity.bookId !== book.bookId)
      return false;
    const opening = prepare();
    this.clearExitRequest();
    this.beginReaderPresentation();
    this.book = this.detailForShelf(book, opening.sourceName);
    this.seed = undefined;
    this.session = undefined;
    this.toc = [];
    this.inBookshelf = true;
    this.contentKind = session.contentKind === 'manga' ? 'manga' : 'text';
    this.resetDirectoryPosition();
    this.resetChapterRequest();
    this.requestedBookmarkAnchor = undefined;
    this.requestedChapterIndex = chapterIndex;
    if (this.contentKind === 'manga' && chapterIndex !== undefined) this.requestMangaChapterBeginning(chapterIndex);
    this.startReading(owner);

    const committed = readingSessionForCommittedSource(session, book);
    this.acceptReaderSession(owner, committed, false, (): void => this.bindReader(owner, opening.ports));
    return true;
  }

  commitDirectoryChapter(owner: ReaderRuntimeOwner, chapterIndex: number, chapterTitle: string,
    onChapterChanged: () => void): void {
    if (!this.sessionActive) return;
    const mangaBeforeCatalog = this.contentKind === 'manga' && this.toc.length === 0 &&
      Number.isSafeInteger(chapterIndex) && chapterIndex >= 0;
    const mangaHistoricalResume = this.contentKind === 'manga' && this.requestedChapterIndex === undefined &&
      this.session?.entries.some(entry => entry.index === chapterIndex && entry.resumeOnly === true) === true;
    if (!mangaBeforeCatalog && !mangaHistoricalResume && !this.isKnownChapter(chapterIndex)) return;
    this.publishCommittedChapter(owner, chapterIndex, chapterTitle, onChapterChanged);
  }

  commitMangaAdjacentChapter(owner: ReaderRuntimeOwner, chapterIndex: number, chapterTitle: string,
    onChapterChanged: () => void): void {
    if (!this.sessionActive || this.contentKind !== 'manga' || !this.isKnownChapter(chapterIndex)) return;
    this.requestedChapterIndex = chapterIndex;
    this.requestedMangaOfflineChapterId = undefined;
    this.requestedMangaDirectoryTargetProof = undefined;
    this.mangaChapterStartRequestGeneration = -1;
    this.publishCommittedChapter(owner, chapterIndex, chapterTitle, onChapterChanged);
  }

  private publishCommittedChapter(owner: ReaderRuntimeOwner, chapterIndex: number, chapterTitle: string,
    onChapterChanged: () => void): void {
    if (chapterIndex !== this.directoryCurrentChapterIndex) onChapterChanged();
    this.setDirectoryPosition(chapterIndex, chapterTitle);
    this.protectReadingChapter(owner, chapterIndex);
    if (this.contentKind === 'manga') this.mangaCommittedRequestGeneration = this.mangaChapterRequestGeneration;
  }

  detailForShelf(book: ShelfBook, sourceName: string): ReadingBookDetail {
    return {
      sourceId: book.sourceId,
      sourceName,
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      kind: book.kind,
      contentKind: book.contentKind,
      mangaPosition: book.contentKind === 'manga' ? MangaBookPresentation.get(book.sourceId, book.bookId) : undefined,
      coverUrl: book.coverUrl,
      intro: book.intro,
      lastChapter: book.lastChapter,
    };
  }

  currentHost(owner: ReaderRuntimeOwner): ReadingEntryHost {
    const host = ReadingEntryHost.forRuntime(owner);
    this.host = host;
    return host;
  }

  admitShelfResume(owner: ReaderRuntimeOwner, book: ShelfBook,
    notice: (title: string, message: string) => void): boolean {
    if (book.contentKind === 'audio') {
      notice('暂不支持此类阅读', '书籍和已下载内容仍保留。');
      return false;
    }
    owner.selectMangaOfflineProbe?.(book.sourceId, book.bookId, book.contentKind === 'manga');
    return true;
  }

  openShelfEntry(owner: ReaderRuntimeOwner, book: ShelfBook, intent: ReadingShelfEntryIntent,
    ports: ReadingShelfEntryPorts): void {
    if (book.sourceId === LOCAL_SOURCE_ID) {
      ports.local(book, intent !== 'info');
      return;
    }
    ports.remote(remoteShelfDetailInput(book, ports.sourceName(), intent === 'info' ? undefined : true));
  }

  enterLocalDetail(owner: ReaderRuntimeOwner, book: ShelfBook, resume: boolean, prepare: () => ReadingEntryPorts): boolean {
    if (book.sourceId !== LOCAL_SOURCE_ID) return false;
    this.contentKind = 'text';
    const ports = prepare();
    const host = this.currentHost(owner);
    void host.openLocal(book, this.lease(host, ports), resume);
    return true;
  }

  enterRemoteDetail(owner: ReaderRuntimeOwner, request: RemoteReadingEntryInput,
    open: (projectKind: () => void, fallbackSeeds: RemoteReadingBookSeed[]) => RemoteDetailOpening,
    notice: (title: string, message: string) => void): boolean {
    const kind = remoteReadingEntryKind(request.seed, request.shelfSnapshot, request.validatedSession);
    if (kind === 'audio') {
      notice('暂不支持此类阅读', '当前版本未接入此类阅读器，书籍和已下载内容仍保留。');
      return false;
    }
    const retainedSession = this.session;
    const fallbackSeeds = request.fallbackSeeds ?? [];
    // Navigation retires the previous presentation before publishing the
    // new route. Project the new kind between those steps.
    const opening = open((): void => { this.contentKind = kind === 'manga' ? 'manga' : 'text'; }, fallbackSeeds);
    const host = this.currentHost(owner);
    void host.openRemote({
      seed: request.seed, sourceName: request.sourceName, shelfSnapshot: request.shelfSnapshot,
      shelfBooks: opening.shelfBooks, fromSearch: request.fromSearch, sourceSwitchPending: opening.sourceSwitchPending,
      resumeImmediately: request.resumeImmediately === true, fallbackSeeds,
      fallbackSourceNames: request.fallbackSourceNames ?? [], candidates: opening.candidates,
      validatedSession: request.validatedSession, retainedSession, retainAdmissionThroughProbe: request.retainAdmissionThroughProbe === true,
      displayCoverUrl: request.displayCoverUrl,
    }, this.lease(host, opening.ports));
    return true;
  }

  bindReader(owner: ReaderRuntimeOwner, ports: ReadingEntryPorts): void {
    const host = this.currentHost(owner);
    const book = this.book;
    if (book === undefined) return;
    const session = this.session?.identity.sourceId === book.sourceId &&
      this.session?.identity.bookId === book.bookId ? this.session : undefined;
    host.bindReader(book, session, this.toc, this.inBookshelf, this.lease(host, ports));
  }

  async refreshDetailAcquisition(owner: ReaderRuntimeOwner, ports: ReadingEntryPorts): Promise<void> {
    if (this.sessionActive || this.book === undefined || this.book.sourceId === LOCAL_SOURCE_ID) return;
    const host = this.currentHost(owner);
    if (host.snapshot().scopeId !== this.scopeId) this.bindReader(owner, ports);
    await host.refreshProjection();
  }

  projectDetailDirectoryPosition(owner: ReaderRuntimeOwner | undefined, books: ShelfBook[] | undefined,
    visible: () => boolean): void {
    const book = this.book;
    if (book === undefined) return;
    if (book.contentKind === 'manga') {
      this.setDirectoryPosition(book.mangaPosition?.chapterIndex ?? -1, book.mangaPosition?.chapterTitle ?? '');
      return;
    }
    const sourceId = book.sourceId;
    const bookId = book.bookId;
    const opening = this.directoryPresentationGeneration;
    const current = (): boolean => visible() && !this.sessionActive && this.directoryPresentationGeneration === opening &&
      this.book?.sourceId === sourceId && this.book?.bookId === bookId &&
      this.book.contentKind !== 'manga';
    const publishChapter = (index: number): void => {
      const entry = this.toc.find((chapter: LocalReadingTocEntry): boolean => chapter.index === index);
      this.setDirectoryPosition(index, entry?.title ?? '');
    };
    const saved = books?.find((item: ShelfBook): boolean => item.sourceId === sourceId && item.bookId === bookId);
    const index = saved?.readingPosition?.chapterIndex ?? saved?.currentChapterIndex;
    publishChapter(index !== undefined && Number.isSafeInteger(index) && index >= 0 ? index : -1);
    if (owner === undefined || !current()) return;
    void this.currentHost(owner).loadDirectoryChapterIndex(sourceId, bookId, current)
      .then((restored: number | undefined): void => {
        if (current() && restored !== undefined) publishChapter(restored);
      }).catch((): void => { /* Keep the exact shelf projection when the display read is unavailable. */ });
  }

  retryDirectoryCatalog(owner: ReaderRuntimeOwner): void {
    if (this.sessionActive || this.book === undefined || this.catalogBusy) return;
    const host = this.currentHost(owner);
    if (host.snapshot().scopeId === this.scopeId) void host.retryCatalog();
  }

  retire(retireShelfPreparation: boolean = true): void {
    this.directoryBackfill.retire();
    this.clearRecoveryNotice();
    const host = this.host;
    if (host !== undefined && host.snapshot().scopeId === this.scopeId) host.retire(retireShelfPreparation);
    this.scopeId = -1;
    this.presentedScopeId = -1;
    this.published = undefined;
    this.pendingRemoteDirectory = undefined;
    this.pendingLocalDirectory = undefined;
  }

  prepareShelf(read: () => ReadingShelfPreparationScene, visibleBooks?: ShelfBook[]): void {
    const binding = this.shelfPreparation(read);
    if (binding === undefined) return;
    if (visibleBooks === undefined) binding.host.preparePersisted(binding.context, binding.shared);
    else binding.host.prepareVisible(visibleBooks, binding.context, binding.shared);
  }

  shelfPreparationVisibilityChanged(read: () => ReadingShelfPreparationScene): void {
    const binding = this.shelfPreparation(read);
    if (binding !== undefined) binding.host.preparationVisibilityChanged(binding.context, binding.shared);
  }

  private shelfPreparation(read: () => ReadingShelfPreparationScene): ReadingShelfPreparationBinding | undefined {
    const scene = read(), runtime = scene.runtime;
    if (runtime === undefined) return undefined;
    const shared = scene.shared;
    const context: ReadingPreparationContext = {
      isCurrent: (): boolean => {
        const latest = read();
        return latest.runtime === runtime && latest.mounting === scene.mounting;
      },
      foreground: (): boolean => read().foreground,
      shelfVisible: (): boolean => read().shelfVisible,
      readingActive: (): boolean => this.sessionActive,
      settingsAvailable: (): boolean => read().settingsAvailable,
      revision: (): string => read().revision,
      diagnostic: (message: string): void => hilog.warn(DOMAIN, 'Reader', 'Persistent shelf preparation: %{private}s', message),
    };
    return { host: ReadingEntryHost.forRuntime(runtime), context,
      shared: shared?.owner === runtime ? { runtime, revision: shared.revision, seeds: shared.seeds } : undefined };
  }

  acceptReaderSession(owner: ReaderRuntimeOwner, session: RemoteReadingSession, refreshDirectoryDisplay: boolean,
    bind: () => void, refreshNearEnd?: (chapterIndex: number) => void): void {
    const book = this.book;
    if (book?.sourceId !== session.identity.sourceId || book?.bookId !== session.identity.bookId) return;
    const host = this.currentHost(owner);
    if (host.snapshot().scopeId !== this.scopeId) bind();
    if (refreshDirectoryDisplay) {
      // Quick-open may carry an ArkUI-copied DTO; refresh the admitted session.
      void host.refreshMangaDirectoryDisplay(true, false);
      return;
    }
    if (!host.readerSessionReady(session, refreshDirectoryDisplay)) return;
    if (this.directoryCurrentChapterIndex >= 0) refreshNearEnd?.(this.directoryCurrentChapterIndex);
    const projectDirectory = host.deferredDirectoryProjection();
    if (this.presentedScopeId === this.scopeId) {
      this.pendingRemoteDirectory = undefined;
      projectDirectory?.();
    } else this.pendingRemoteDirectory = projectDirectory;
  }

  installSession(owner: ReaderRuntimeOwner | undefined, session: RemoteReadingSession | undefined, bind: () => void,
    readableProjectionRevision?: number, readableProjection?: BookAcquisitionDetailProjection): void {
    const book = this.book;
    if (book === undefined) {
      // A retained route DTO stays optional input for a later admission.
      this.session = session;
      return;
    }
    if (owner === undefined) return;
    const host = this.currentHost(owner);
    const admitted = host.snapshot();
    if (admitted.scopeId !== this.scopeId || admitted.book?.sourceId !== book.sourceId ||
      admitted.book?.bookId !== book.bookId) bind();
    host.acceptSession(session, readableProjectionRevision, readableProjection);
  }

  projectReaderFailure(sourceId: string, bookId: string, message: string, kind?: RemoteReadingFailureKind): void {
    if (!this.sessionActive || this.book?.sourceId !== sourceId || this.book?.bookId !== bookId) return;
    this.loadingMessage = message;
    this.catalogBusy = false;
    hilog.warn(DOMAIN, 'Reader', 'Reading error retained in reader: %{private}s %{private}s',
      kind ?? 'RENDER_FAILED', message);
  }

  projectAdmissionFailure(message: string, detailVisible: boolean): string {
    const detail = message.trim().length > 0 ? message : '阅读会话未能继续，请稍后重试。';
    if (!detailVisible) return detail;
    const admitted = this.host?.snapshot();
    if (admitted !== undefined && admitted.scopeId === this.scopeId &&
      admitted.book?.sourceId === this.book?.sourceId && admitted.book?.bookId === this.book?.bookId) {
      this.loadingMessage = detail;
      this.catalogBusy = false;
    }
    return detail;
  }

  async chooseCachedChapterRefresh(error: RemoteChapterCacheRefreshError, current: () => boolean,
    ports: CachedChapterRecoveryPorts): Promise<boolean> {
    if (!current()) return false;
    if (this.cacheRefreshConsent === error) return true;
    ports.notice('本章缓存需要重新验证，请刷新本章。', '刷新本章', (): void => {
      this.cacheRefreshConsent = error;
      const work = this.recoverCachedChapter(ports.runtime(), error, current);
      this.clearRecoveryConsent();
      void work.catch((failure: Error): void => {
        if (!current()) return;
        ports.feedback(readingFailureHint(diagnosticCodeOf(errorMessageOf(failure))), current);
        // The one-shot action retires before dispatch. A failed attempt
        // exposes the same exact decision again.
        void this.chooseCachedChapterRefresh(error, current, ports);
      });
    }, current);
    return false;
  }

  showRecoveryNotice(message: string, label: string, action: (() => void) | undefined, current: () => boolean): void {
    if (!current()) return;
    this.recoveryCurrent = current;
    this.recoveryAction = action;
    this.recoveryActionLabel = label;
    this.recoveryNotice = { message, visible: true, canRetry: action !== undefined, generation: ++this.recoveryRevision };
  }

  recoveryNoticeVisible(): boolean {
    return this.recoveryNotice.visible && this.recoveryCurrent?.() === true;
  }

  retryRecoveryNotice(generation: number): void {
    if (generation !== this.recoveryNotice.generation || !this.recoveryNoticeVisible()) return;
    const action = this.recoveryAction;
    this.clearRecoveryNotice();
    action?.();
  }

  private clearRecoveryNotice(): void {
    this.recoveryAction = undefined;
    this.recoveryCurrent = undefined;
    this.clearRecoveryConsent();
    this.recoveryNotice = { message: '', visible: false, canRetry: false, generation: this.recoveryRevision };
    this.recoveryActionLabel = '';
  }

  private clearRecoveryConsent(): void { this.cacheRefreshConsent = undefined; }

  private async recoverCachedChapter(owner: ReaderRuntimeOwner | undefined, error: RemoteChapterCacheRefreshError,
    current: () => boolean): Promise<number | undefined> {
    if (!current() || owner === undefined) return undefined;
    const host = this.currentHost(owner);
    if (host.snapshot().scopeId !== this.scopeId) return undefined;
    return host.recoverCachedChapter(this.scopeId, error, current);
  }

  refreshMangaPosition(): void {
    const book = this.book;
    if (book?.contentKind !== 'manga') return;
    const position = MangaBookPresentation.get(book.sourceId, book.bookId);
    if (book.mangaPosition === position) return;
    this.book = { sourceId: book.sourceId, sourceName: book.sourceName, bookId: book.bookId,
      title: book.title, author: book.author, kind: book.kind, contentKind: book.contentKind,
      mangaPosition: position, coverUrl: book.coverUrl, displayCoverUrl: book.displayCoverUrl,
      intro: book.intro, lastChapter: book.lastChapter };
  }

  presentPreparedPage(chapterIndex: number, matchRequestedChapter: boolean, show: () => PreparedReaderOpening): void {
    const book = this.book;
    if (!this.sessionActive || book === undefined) return;
    const requested = this.requestedBookmarkAnchor?.chapterIndex ?? this.requestedChapterIndex;
    if (matchRequestedChapter && requested !== chapterIndex) return;
    if (book.sourceId !== LOCAL_SOURCE_ID) this.verdict = 'readable';
    const opening = show();
    const identity = this.readerPresentationIdentity();
    this.projectDirectoryAfterFirstPage((): ReadingEntryHost | undefined => {
      const owner = opening.runtime();
      return owner === undefined ? undefined : this.currentHost(owner);
    }, (): boolean => this.sessionActive && identity === this.readerPresentationIdentity() && opening.current(),
      opening.afterOpening);
  }

  private projectDirectoryAfterFirstPage(resolveHost: () => ReadingEntryHost | undefined, current: () => boolean,
    afterOpening: (project: () => void) => void): void {
    const scope = this.scopeId;
    const firstPresentation = this.presentedScopeId !== scope;
    this.presentedScopeId = scope;
    const remote = this.pendingRemoteDirectory;
    const local = this.pendingLocalDirectory;
    this.pendingRemoteDirectory = undefined;
    this.pendingLocalDirectory = undefined;
    const fallback = firstPresentation && remote === undefined && local === undefined &&
      this.toc.some((entry: LocalReadingTocEntry): boolean => entry.bookmarks === undefined) ?
      resolveHost()?.deferredDirectoryProjection() : undefined;
    if (remote === undefined && local === undefined && fallback === undefined) return;
    afterOpening((): void => {
      if (this.scopeId !== scope || !current()) return;
      remote?.();
      local?.();
      fallback?.();
    });
  }

  applyDirectoryProjection(entries: LocalReadingTocEntry[], owner: ReaderRuntimeOwner | undefined): void {
    const projected = new Map<number, LocalReadingTocEntry>();
    for (const entry of entries) {
      if (!Number.isSafeInteger(entry.index) || entry.index < 0 || entry.title.trim().length === 0 ||
        projected.has(entry.index)) {
        return;
      }
      projected.set(entry.index, entry);
    }
    const book = this.book;
    if (book !== undefined && this.toc.length === 0 && entries.length > 0) {
      this.toc = entries;
      this.loadingMessage = '';
      this.catalogBusy = false;
      const host = owner === undefined ? undefined : this.currentHost(owner);
      host?.replaceDirectory(this.scopeId, entries);
      const projectDirectory = host?.deferredDirectoryProjection();
      // A persisted entry publishes its catalog after the first visible page.
      // That reader-ready boundary has already passed; do not wait for another
      // page or an explicit directory open to resolve canonical bookmarks.
      if (this.presentedScopeId === this.scopeId) projectDirectory?.();
      else if (book.sourceId === LOCAL_SOURCE_ID) this.pendingLocalDirectory = projectDirectory;
      else this.pendingRemoteDirectory = projectDirectory;
      return;
    }
    if (entries.length !== this.toc.length) return;
    const next: LocalReadingTocEntry[] = [];
    for (const entry of this.toc) {
      const titleProjection = projected.get(entry.index);
      if (titleProjection === undefined) {
        return;
      }
      next.push({
        index: entry.index,
        title: titleProjection.title,
        level: entry.level,
        navigable: entry.navigable,
        downloadState: entry.downloadState,
        bookmarks: entry.bookmarks,
      });
    }
    this.toc = next;
    if (owner !== undefined) this.currentHost(owner).replaceDirectory(this.scopeId, next);
  }

  private lease(host: ReadingEntryHost, ports: ReadingEntryPorts): ReadingEntryLease {
    const current = ports.current;
    return { isCurrent: current,
      projectionAllowed: (): boolean => {
        const book = host.snapshot().book, shown = this.book;
        return current() && this.host === host && ports.projectionVisible() && book !== undefined && shown !== undefined &&
          book.sourceId === shown.sourceId && book.bookId === shown.bookId;
      },
      currentDirectory: (): LocalReadingTocEntry[] => this.toc,
      offlineGeneration: (): number => this.offlineOperation?.generation ?? 0,
      membership: ports.membership,
      changed: (snapshot: ReadingEntrySnapshot): void => { if (current()) this.publish(snapshot); },
      cacheDecision: (error: RemoteChapterCacheRefreshError, guard: () => boolean): Promise<boolean> =>
        ports.cacheDecision(error, (): boolean => current() && guard()),
      notice: (title: string, message: string): void => { if (current()) ports.notice(title, message); },
      refreshShelf: (): void => { if (current()) ports.refreshShelf(); },
      diagnostic: (stage: string, message: string): void => {
        if (current()) hilog.warn(DOMAIN, 'Reader', 'Reading entry %{public}s: %{private}s', stage, message);
      },
    };
  }

  private publish(snapshot: ReadingEntrySnapshot): void {
    const previous = this.published;
    const changedScope = previous?.scopeId !== snapshot.scopeId;
    this.published = snapshot;
    this.scopeId = snapshot.scopeId;
    if (changedScope || previous?.book !== snapshot.book) this.book = snapshot.book;
    this.contentKind = (snapshot.session?.contentKind ?? snapshot.book?.contentKind ?? snapshot.seed?.contentKind) === 'manga' ? 'manga' : 'text';
    if (changedScope || previous?.session !== snapshot.session) this.session = snapshot.session;
    this.sessionGeneration = snapshot.sessionGeneration;
    if (changedScope || previous?.seed !== snapshot.seed || previous?.book !== snapshot.book ||
      previous?.session?.sourceVersion !== snapshot.session?.sourceVersion) {
      this.seed = snapshot.seed ?? (snapshot.book !== undefined && snapshot.book.sourceId !== LOCAL_SOURCE_ID ?
        { sourceId: snapshot.book.sourceId, bookId: snapshot.book.bookId, detailUrl: snapshot.book.bookId,
          title: snapshot.book.title, author: snapshot.book.author, kind: snapshot.book.kind, coverUrl: snapshot.book.coverUrl,
          intro: snapshot.book.intro, lastChapter: snapshot.book.lastChapter, sourceVersion: snapshot.session?.sourceVersion } : undefined);
    }
    if (changedScope || previous?.toc !== snapshot.toc) this.toc = snapshot.toc;
    this.inBookshelf = snapshot.inBookshelf;
    this.loadingMessage = snapshot.loadingMessage;
    this.catalogBusy = snapshot.catalogLoading === true;
    this.verdict = snapshot.verdict;
  }
}

export function remoteContentVerdictLabel(verdict: RemoteContentVerdict): string {
  switch (verdict) {
    case 'verifying':
      return '正在验证正文…';
    case 'readable':
      return '';
    case 'authRequired':
      return '该源需要登录或验证';
    case 'paywalled':
      return '该章节需要付费';
    case 'networkFailed':
      return '网络请求失败';
    case 'parseFailed':
      return '书源解析失败';
    case 'contentUnavailable':
    default:
      return '正文暂不可读';
  }
}
