import type { ShelfBook } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { BookshelfDetailReturnFocus } from '../../features/bookshelf/presentation/BookshelfViewState';
import type { SharedDownloadOpeningIntent, SharedDownloadReturnState } from '../../features/downloads/presentation/SharedDownloadUiContract';

export type ReaderRoute = 'bookshelf' | 'discover' | 'detail' | 'reading' | 'directory' | 'search' |
  'bookshelfManagement' | 'bookshelfMultiSelect' | 'bookshelfSettings' |
  'rss' | 'rssSubscriptionManagement' | 'rssSourceFeed' | 'rssEntryDetail' |
  'rssSubscriptionEditor' | 'settings' | 'rulesManagement' | 'source' | 'sourceTools' | 'sync' | 'downloads';

export type DirectoryReturnTarget = 'detail' | 'readerControl';
export type RulesManagementReturnTarget = 'settings' | 'reader';
export type SettingsSection = 'home' | 'general';
export type DetailOriginRoute = 'bookshelf' | 'search';
export type DetailReturnRoute = DetailOriginRoute | 'reader';
export type SourceManagementReturnTarget = 'settings' | 'search';
type PreparedReaderDestination = 'reading' | 'directory';
type DownloadReturnTarget = 'bookshelf' | 'settings' | 'reading' | 'detail' | 'directory';

export interface ReaderReturnContext {
  readonly owner: ReaderRuntimeOwner;
  readonly originRoute: 'bookshelf' | 'detail';
  readonly detailParent: DetailOriginRoute;
  readonly fromDownloads: boolean;
  readonly downloadParent?: DownloadReturnContext;
}

export interface ReaderExitLease {
  readonly readerIdentity: string;
  readonly request: (intent?: 'navigation') => void;
}

interface ReaderReturnSnapshot {
  readonly readingOrigin: 'bookshelf' | 'detail';
  readonly detailParent: DetailReturnRoute;
  readonly retainedReader?: ReaderReturnContext;
}

interface DownloadOrigin {
  readonly target: DownloadReturnTarget;
  readonly book?: ShelfBook;
  readonly detailParent: DetailReturnRoute;
  readonly readerReturn?: ReaderReturnContext;
  readonly detailReaderReturn?: ReaderReturnContext;
}

interface DownloadReturnContext {
  readonly owner: ReaderRuntimeOwner;
  readonly origin: DownloadOrigin;
  readonly presentation: SharedDownloadReturnState;
}

export interface DownloadReturnPorts {
  showBookshelf: () => void;
  showSettings: () => void;
  restoreReader: (context: ReaderReturnContext | undefined) => boolean;
  resumeReader: (book: ShelfBook) => void;
  showBook: (book: ShelfBook, parent: DetailReturnRoute, restoreDirectory: boolean) => void;
}

export interface DownloadChapterNavigationPorts {
  openBook: (parent: DetailReturnRoute) => void;
  readingActive: () => boolean;
  restoreDownloads: (intent: SharedDownloadOpeningIntent) => void;
}

interface DetailReturnPorts {
  resumeReader: () => void;
  leaveForSearch: () => void;
  restoreSearch: (snapshot: ReaderNavigationSnapshot) => void;
  showBookshelf: (focus: BookshelfDetailReturnFocus | undefined) => void;
}

interface SourceOrigin {
  readonly target: SourceManagementReturnTarget;
  readonly keyword: string;
}

interface SourceManagementReturn {
  readonly snapshot: ReaderNavigationSnapshot;
  readonly keyword?: string;
}

interface BookInfoExitDestination {
  readonly readerIdentity: string;
  readonly bookIdentity: string;
  readonly context: ReaderReturnContext;
  readonly afterOpen?: () => void;
}

interface DownloadExitDestination {
  readonly readerIdentity: string;
  readonly book: ShelfBook;
  readonly context?: ReaderReturnContext;
  readonly detailKey: string;
}

type ReaderParentExitTarget = 'detailOrigin' | 'bookshelfPreparation';

interface ReaderParentExit {
  readonly readerIdentity: string;
  readonly target: ReaderParentExitTarget;
}

interface ReaderExitDecision {
  readonly target: ReaderExitTarget;
  readonly bookInfo?: BookInfoExitDestination;
  readonly downloadDetailKey?: string;
}

export interface AcceptedReaderExitPorts {
  claimSystemFileExit: () => boolean;
  deliverSystemFile: () => void;
  openDownloads: (intent: SharedDownloadOpeningIntent) => void;
  showReaderDetail: () => void;
  afterReaderDetail: (owner: ReaderRuntimeOwner, action: () => void) => void;
  openRules: () => void;
  returnFromDetail: () => void;
  returnFromBookshelfPreparation: () => void;
  returnToReadingOrigin: () => void;
}

/** Return state survives ordinary route generations. Feature owners still
 * control admission, session handoff and the download view's retained data. */
export class ReaderReturnNavigation {
  private readingOriginRoute: 'bookshelf' | 'detail' = 'detail';
  private detailReturnRoute: DetailReturnRoute = 'bookshelf';
  private detailReaderReturn: ReaderReturnContext | undefined;
  private bookshelfDetailFocus: BookshelfDetailReturnFocus | undefined;
  private readingFromDownloads: boolean = false;
  private readerParentExit: ReaderParentExit | undefined;
  private rulesExitReader: string | undefined;
  private source: SourceOrigin = { target: 'settings', keyword: '' };
  private download: DownloadOrigin = { target: 'settings', detailParent: 'bookshelf' };
  private bookInfoAfterReaderExit: BookInfoExitDestination | undefined;
  private downloadsAfterReaderExit: DownloadExitDestination | undefined;

  snapshot(): ReaderReturnSnapshot {
    return { readingOrigin: this.readingOriginRoute, detailParent: this.detailReturnRoute,
      retainedReader: this.detailReaderReturn };
  }

  rememberBookshelfReaderOrigin(): void {
    this.readingOriginRoute = 'bookshelf';
  }

  beginDetailEntry(retainedParent: DetailReturnRoute | undefined): void {
    this.readingFromDownloads = false;
    if (retainedParent !== 'reader') this.detailReaderReturn = undefined;
    if (retainedParent === undefined || retainedParent === 'search') this.bookshelfDetailFocus = undefined;
  }

  completeDetailEntry(origin: ReaderRoute, retainedParent: DetailReturnRoute | undefined,
    resumeImmediately: boolean): 'bookshelf' | 'detail' {
    const entry = resumeImmediately ? this.readingOriginRoute : 'detail';
    this.readingOriginRoute = entry;
    this.detailReturnRoute = retainedParent ?? (origin === 'search' ? 'search' : 'bookshelf');
    return entry;
  }

  leaveDetailJourney(): void {
    this.readingFromDownloads = false;
    this.detailReaderReturn = undefined;
    this.bookshelfDetailFocus = undefined;
  }

  rememberBookshelfDetailFocus(focus: BookshelfDetailReturnFocus): void {
    this.bookshelfDetailFocus = focus;
  }

  takeBookshelfDetailFocus(): BookshelfDetailReturnFocus | undefined {
    const focus = this.bookshelfDetailFocus;
    this.bookshelfDetailFocus = undefined;
    return focus;
  }

  private showReaderBookInfo(context: ReaderReturnContext, showDetail: () => void): void {
    this.readingOriginRoute = 'detail';
    showDetail();
    this.detailReaderReturn = context;
    this.detailReturnRoute = 'reader';
  }

  restoreReaderBehindDetail(restore: (context: ReaderReturnContext | undefined) => boolean): void {
    if (this.detailReturnRoute === 'reader' && restore(this.detailReaderReturn)) this.detailReaderReturn = undefined;
  }

  detailReturnTarget(owner: ReaderRuntimeOwner | undefined): DetailReturnRoute {
    if (this.detailReturnRoute === 'reader' && owner !== undefined && this.detailReaderReturn?.owner === owner) return 'reader';
    return this.detailReturnRoute === 'search' ? 'search' : 'bookshelf';
  }

  setSourceOrigin(target: SourceManagementReturnTarget = 'settings', keyword: string = ''): void {
    this.source = { target, keyword };
  }

  sourceOrigin(): SourceOrigin { return this.source; }

  takeSourceOrigin(): SourceOrigin {
    const origin = this.source;
    this.setSourceOrigin();
    return origin;
  }

  rememberDownloadOrigin(route: ReaderRoute, currentBook: () => ShelfBook | undefined): void {
    const target = route === 'bookshelf' || route === 'detail' || route === 'directory' ? route : 'settings';
    this.download = { target, book: target === 'detail' || target === 'directory' ? currentBook() : undefined,
      detailParent: this.detailReturnRoute,
      detailReaderReturn: this.detailReturnRoute === 'reader' ? this.detailReaderReturn : undefined };
  }

  requestDownloadsAfterExit(book: ShelfBook, context: ReaderReturnContext | undefined, lease: ReaderExitLease, detailKey: string): void {
    const pending = this.downloadsAfterReaderExit;
    if (pending?.readerIdentity === lease.readerIdentity && pending.detailKey === detailKey) return;
    this.downloadsAfterReaderExit = { readerIdentity: lease.readerIdentity, book, context, detailKey };
    lease.request('navigation');
  }

  private downloadReaderDetailParent(): DetailOriginRoute {
    const origin = this.download;
    if (origin.target === 'reading' && origin.readerReturn !== undefined) return origin.readerReturn.detailParent;
    if (origin.target !== 'reading' && origin.target !== 'detail' && origin.target !== 'directory') return 'bookshelf';
    return origin.detailParent === 'reader' ? origin.detailReaderReturn?.detailParent ?? 'bookshelf' : origin.detailParent;
  }

  openReadingFromDownloads(open: (parent: DetailReturnRoute) => boolean): boolean {
    const previous = this.readingOriginRoute;
    const parent = this.downloadReaderDetailParent();
    this.readingOriginRoute = 'detail';
    let admitted = false;
    try {
      admitted = open(parent);
      if (admitted) this.readingFromDownloads = true;
      return admitted;
    } finally {
      if (!admitted) this.readingOriginRoute = previous;
    }
  }

  returnFromDownloads(ports: DownloadReturnPorts): void {
    const origin = this.download;
    this.readingFromDownloads = false;
    if (origin.target === 'bookshelf') {
      ports.showBookshelf();
      return;
    }
    if (origin.target === 'settings' || origin.book === undefined) {
      ports.showSettings();
      return;
    }
    if (origin.target === 'reading') {
      const context = origin.readerReturn;
      this.download = { ...origin, readerReturn: undefined };
      if (!ports.restoreReader(context)) this.readingOriginRoute = 'detail';
      ports.resumeReader(origin.book);
      // Admission can replace the parent and the download return origin.
      ports.restoreReader(context);
      return;
    }
    this.detailReaderReturn = origin.detailReaderReturn;
    ports.showBook(origin.book, origin.detailParent, origin.target === 'directory');
  }

  captureReaderReturn(owner: ReaderRuntimeOwner, captureDownloadView: () => SharedDownloadReturnState): ReaderReturnContext {
    if (this.detailReturnRoute === 'reader' && this.detailReaderReturn?.owner === owner) return this.detailReaderReturn;
    return { owner, originRoute: this.readingOriginRoute,
      detailParent: this.detailReturnRoute === 'reader' ? this.detailReaderReturn?.detailParent ?? 'bookshelf' : this.detailReturnRoute,
      fromDownloads: this.readingFromDownloads,
      downloadParent: this.readingFromDownloads ? { owner, origin: this.download, presentation: captureDownloadView() } : undefined };
  }

  restoreReaderReturn(context: ReaderReturnContext, restoreDownloadView: (state: SharedDownloadReturnState) => void): void {
    this.readingOriginRoute = context.originRoute;
    this.detailReturnRoute = context.detailParent;
    this.readingFromDownloads = context.fromDownloads;
    if (context.fromDownloads && context.downloadParent?.owner === context.owner) {
      this.download = context.downloadParent.origin;
      restoreDownloadView(context.downloadParent.presentation);
    }
  }

  reopenPreservingReaderReturn(capture: () => ReaderReturnContext | undefined,
    open: (parent: DetailReturnRoute) => void, restore: (context: ReaderReturnContext | undefined) => boolean): void {
    const parent = this.detailReturnRoute;
    const context = capture();
    open(parent);
    restore(context);
  }

  requestBookInfoAfterExit(lease: ReaderExitLease, bookIdentity: string, context: ReaderReturnContext,
    afterOpen?: () => void): void {
    const readerIdentity = lease.readerIdentity;
    const pending = this.bookInfoAfterReaderExit;
    if (pending?.readerIdentity === readerIdentity && pending.context.owner === context.owner) return;
    this.bookInfoAfterReaderExit = { readerIdentity, bookIdentity, context, afterOpen };
    lease.request('navigation');
  }

  requestParentAfterExit(lease: ReaderExitLease, target: ReaderParentExitTarget): void {
    const pending = this.readerParentExit;
    if (pending?.readerIdentity === lease.readerIdentity && pending.target === target) return;
    this.readerParentExit = { readerIdentity: lease.readerIdentity, target };
    lease.request();
  }

  awaitingBookshelfPreparationExit(): boolean {
    return this.readerParentExit?.target === 'bookshelfPreparation';
  }

  requestRulesAfterExit(lease: ReaderExitLease): void {
    if (this.rulesExitReader === lease.readerIdentity) return;
    this.rulesExitReader = lease.readerIdentity;
    lease.request();
  }

  cancelReaderExit(): void {
    this.bookInfoAfterReaderExit = undefined;
    this.downloadsAfterReaderExit = undefined;
    this.rulesExitReader = undefined;
    this.readerParentExit = undefined;
  }

  private consumeSystemFileExit(): void {
    this.cancelReaderExit();
    this.readingFromDownloads = false;
  }

  dispatchAcceptedReaderExit(readerIdentity: string, bookIdentity: string | undefined, owner: ReaderRuntimeOwner,
    ports: AcceptedReaderExitPorts): void {
    if (ports.claimSystemFileExit()) {
      this.consumeSystemFileExit();
      ports.deliverSystemFile();
      return;
    }
    const decision = this.takeReaderExit(readerIdentity, bookIdentity, owner);
    switch (decision.target) {
      case 'requestedDownloads': ports.openDownloads({ kind: 'readerRequest', detailKey: decision.downloadDetailKey ?? '' }); return;
      case 'returnToDownloads': ports.openDownloads({ kind: 'resume' }); return;
      case 'bookInfo': {
        const bookInfo = decision.bookInfo;
        if (bookInfo === undefined) break;
        this.showReaderBookInfo(bookInfo.context, ports.showReaderDetail);
        if (bookInfo.afterOpen !== undefined) ports.afterReaderDetail(bookInfo.context.owner, bookInfo.afterOpen);
        return;
      }
      case 'rules': ports.openRules(); return;
      case 'detailOrigin': ports.returnFromDetail(); return;
      case 'bookshelfPreparation': ports.returnFromBookshelfPreparation(); return;
      case 'readingOrigin': break;
    }
    ports.returnToReadingOrigin();
  }

  private takeReaderExit(readerIdentity: string, bookIdentity: string | undefined, owner: ReaderRuntimeOwner | undefined): ReaderExitDecision {
    const downloads = this.downloadsAfterReaderExit;
    const parentExit = this.readerParentExit;
    const requestedParent = parentExit?.readerIdentity === readerIdentity ? parentExit.target : undefined;
    const pendingBookInfo = this.bookInfoAfterReaderExit;
    const bookInfo = pendingBookInfo?.readerIdentity === readerIdentity ? pendingBookInfo : undefined;
    const requestedDownloads = downloads !== undefined && downloads.readerIdentity === readerIdentity &&
      (downloads.context === undefined || downloads.context.owner === owner);
    const target = readerExitTarget({
      requestedDownloads,
      fromDownloads: this.readingFromDownloads,
      requestedBookInfo: bookInfo !== undefined,
      admittedBookInfo: bookInfo !== undefined && bookInfo.bookIdentity === bookIdentity && bookInfo.context.owner === owner,
      requestedRules: this.rulesExitReader === readerIdentity,
      requestedDetailOrigin: requestedParent === 'detailOrigin',
      requestedBookshelfPreparation: requestedParent === 'bookshelfPreparation',
    });
    this.cancelReaderExit();
    // An exit request can be cancelled while saving. Only an accepted exit
    // replaces the destination of Back in the downloads scene.
    if (target === 'requestedDownloads' && downloads !== undefined) {
      this.download = { ...this.download, target: 'reading', book: downloads.book, readerReturn: downloads.context };
    }
    if (target === 'returnToDownloads') this.readingFromDownloads = false;
    return { target, bookInfo: target === 'bookInfo' ? bookInfo : undefined,
      downloadDetailKey: target === 'requestedDownloads' ? downloads?.detailKey : undefined };
  }

  retire(): void {
    this.download = { ...this.download, readerReturn: undefined, detailReaderReturn: undefined };
    this.detailReaderReturn = undefined;
    this.bookshelfDetailFocus = undefined;
    this.cancelReaderExit();
  }
}

export type TemporaryBackScope = 'bookshelf' | 'settings' | 'source' | 'sourceTools' | 'downloads' | 'directory';

interface TemporaryBackLease {
  readonly scope: TemporaryBackScope;
  readonly generation: number;
  readonly owner: ReaderRuntimeOwner;
  readonly identity: string;
  readonly handler: () => boolean;
}

export interface ReaderNavigationSnapshot {
  readonly route: ReaderRoute;
  readonly generation: number;
  readonly directoryReturnTarget: DirectoryReturnTarget;
  readonly settingsSection: SettingsSection;
}

export type ReaderBackTarget = 'bookshelf' | 'leaveSelection' | 'bookshelfSettingsOrigin' | 'generalSettingsHome' |
  'settings' | 'searchMode' | 'sourceManagement' | 'sourceOrigin' | 'downloadsOrigin' | 'rulesOrigin' |
  'directoryOrigin' | 'readerExit' | 'detailExit' | 'rss' | 'rssFeed' | 'rssEntry' | 'rssSubscriptionList';

export interface ReaderBackPorts {
  nativeSurface?: () => boolean;
  mangaSelection?: () => void;
  bookRemoval?: () => void;
  jsonImport?: () => void;
  sourceSwitch?: () => void;
  bookshelfImport?: () => void;
  bookshelfGroup: () => boolean;
  temporaryOwner: () => ReaderRuntimeOwner | undefined;
  onTemporaryFailure: (error: Error) => void;
  shelfPreparation?: () => void;
  destination: (target: ReaderBackTarget) => void;
}

/** Resolves a route-level Back after the foreground surface has declined it. */
export function readerBackTarget(route: ReaderRoute, section: SettingsSection): ReaderBackTarget | undefined {
  switch (route) {
    case 'bookshelf': return undefined;
    case 'discover':
    case 'bookshelfManagement':
    case 'rss': return 'bookshelf';
    case 'bookshelfMultiSelect': return 'leaveSelection';
    case 'bookshelfSettings': return 'bookshelfSettingsOrigin';
    case 'settings': return section === 'general' ? 'generalSettingsHome' : 'bookshelf';
    case 'sync': return 'settings';
    case 'search': return 'searchMode';
    case 'sourceTools': return 'sourceManagement';
    case 'source': return 'sourceOrigin';
    case 'downloads': return 'downloadsOrigin';
    case 'rulesManagement': return 'rulesOrigin';
    case 'directory': return 'directoryOrigin';
    case 'reading': return 'readerExit';
    case 'detail': return 'detailExit';
    case 'rssSubscriptionManagement': return 'rss';
    case 'rssSourceFeed': return 'rssFeed';
    case 'rssEntryDetail': return 'rssEntry';
    case 'rssSubscriptionEditor': return 'rssSubscriptionList';
  }
}

export interface ReaderExitNavigation {
  readonly requestedDownloads: boolean;
  readonly fromDownloads: boolean;
  readonly requestedBookInfo: boolean;
  readonly admittedBookInfo: boolean;
  readonly requestedRules: boolean;
  readonly requestedDetailOrigin: boolean;
  readonly requestedBookshelfPreparation: boolean;
}

export type ReaderExitTarget = 'requestedDownloads' | 'returnToDownloads' | 'bookInfo' |
  'rules' | ReaderParentExitTarget | 'readingOrigin';

export function readerExitTarget(exit: ReaderExitNavigation): ReaderExitTarget {
  if (exit.requestedBookshelfPreparation) return 'bookshelfPreparation';
  if (exit.requestedDownloads) return 'requestedDownloads';
  if (exit.fromDownloads && !exit.requestedBookInfo && !exit.requestedRules) return 'returnToDownloads';
  if (exit.admittedBookInfo) return 'bookInfo';
  if (exit.requestedRules) return 'rules';
  if (exit.requestedDetailOrigin) return 'detailOrigin';
  return 'readingOrigin';
}

export function retainedReaderRoute(route: ReaderRoute, directoryTarget: DirectoryReturnTarget): 'reading' | 'directory' | undefined {
  if (route === 'reading') return 'reading';
  return route === 'directory' && directoryTarget === 'readerControl' ? 'directory' : undefined;
}

/** Owns destination and presentation generation. The caller still decides
 * when a feature transition is admissible and when to retire its overlays. */
export class ReaderNavigation {
  readonly returns: ReaderReturnNavigation = new ReaderReturnNavigation();
  private current: ReaderNavigationSnapshot = {
    route: 'bookshelf', generation: 0, directoryReturnTarget: 'detail', settingsSection: 'home',
  };
  private bookshelfSettingsReturn: 'bookshelf' | 'settings' = 'bookshelf';
  private rulesManagementReturn: RulesManagementReturnTarget = 'settings';
  private returnedBookshelfFocus: BookshelfDetailReturnFocus | undefined;
  private temporaryBackLease: TemporaryBackLease | undefined;
  private preparedReaderDestination: PreparedReaderDestination = 'reading';

  prepareReaderDestination(route: PreparedReaderDestination): void {
    this.preparedReaderDestination = route;
  }

  readerDestinationWhenReady(): PreparedReaderDestination {
    return this.preparedReaderDestination;
  }

  setTemporaryBack(scope: TemporaryBackScope, generation: number, owner: ReaderRuntimeOwner,
    handler: (() => boolean) | undefined, identity: string): void {
    if (identity.length === 0 || scope !== this.current.route || generation !== this.current.generation) return;
    if (handler === undefined) {
      const lease = this.temporaryBackLease;
      if (lease?.scope === scope && lease.generation === generation && lease.owner === owner &&
        lease.identity === identity) this.temporaryBackLease = undefined;
      return;
    }
    this.temporaryBackLease = { scope, generation, owner, identity, handler };
  }

  consumeTemporaryBack(isCurrentOwner: (owner: ReaderRuntimeOwner) => boolean,
    onFailure: (error: Error) => void): boolean {
    const lease = this.temporaryBackLease;
    if (lease === undefined) return false;
    if (!isCurrentOwner(lease.owner)) {
      this.temporaryBackLease = undefined;
      return false;
    }
    try {
      return lease.handler();
    } catch (error) {
      // Keep Back inside the foreground page if closing its surface failed.
      onFailure(error as Error);
      return true;
    }
  }

  retire(): void {
    this.temporaryBackLease = undefined;
    this.returnedBookshelfFocus = undefined;
    this.returns.retire();
  }

  snapshot(): ReaderNavigationSnapshot {
    return this.current;
  }

  backTarget(): ReaderBackTarget | undefined {
    return readerBackTarget(this.current.route, this.current.settingsSection);
  }

  dispatchBack(ports: ReaderBackPorts): boolean {
    if (ports.nativeSurface?.() === true) return true;
    const modal = ports.mangaSelection ?? ports.bookRemoval ?? ports.jsonImport ?? ports.sourceSwitch;
    if (modal !== undefined) { modal(); return true; }
    if (this.current.route === 'bookshelf') {
      if (ports.bookshelfImport !== undefined) { ports.bookshelfImport(); return true; }
      if (ports.bookshelfGroup()) return true;
    }
    if (this.consumeTemporaryBack((owner: ReaderRuntimeOwner): boolean => owner === ports.temporaryOwner(),
      ports.onTemporaryFailure)) return true;
    if (this.current.route === 'bookshelf') {
      if (this.returns.awaitingBookshelfPreparationExit()) return true;
      if (ports.shelfPreparation !== undefined) {
        ports.shelfPreparation();
        return true;
      }
    }
    const target = this.backTarget();
    if (target === undefined) return false;
    ports.destination(target);
    return true;
  }

  show(route: ReaderRoute): ReaderNavigationSnapshot {
    if (route !== this.current.route) {
      this.temporaryBackLease = undefined;
      if (this.current.route === 'bookshelf') this.returnedBookshelfFocus = undefined;
      this.current = { route, generation: this.current.generation,
        directoryReturnTarget: this.current.directoryReturnTarget, settingsSection: this.current.settingsSection };
    }
    return this.current;
  }

  advance(): ReaderNavigationSnapshot {
    this.temporaryBackLease = undefined;
    this.returnedBookshelfFocus = undefined;
    this.returns.cancelReaderExit();
    this.current = { route: this.current.route, generation: this.current.generation + 1,
      directoryReturnTarget: this.current.directoryReturnTarget, settingsSection: this.current.settingsSection };
    return this.current;
  }

  openDirectory(target: DirectoryReturnTarget, prepare: () => boolean): ReaderNavigationSnapshot | undefined {
    const origin = target === 'readerControl' ? 'reading' : 'detail';
    const opening = this.current;
    if (opening.route !== origin || !prepare() || this.current !== opening) return undefined;
    this.preparedReaderDestination = target === 'readerControl' ? 'directory' : 'reading';
    this.temporaryBackLease = undefined;
    this.current = { route: 'directory', generation: this.current.generation, directoryReturnTarget: target,
      settingsSection: this.current.settingsSection };
    return this.current;
  }

  closeDirectory(reading: boolean, requestReaderExit: () => void): ReaderNavigationSnapshot | undefined {
    if (this.current.route !== 'directory') return undefined;
    if (reading && this.current.directoryReturnTarget !== 'readerControl') {
      requestReaderExit();
      return undefined;
    }
    this.preparedReaderDestination = 'reading';
    return this.show(reading ? 'reading' : 'detail');
  }

  backFromDetail(exit: ReaderExitLease | undefined, returnToParent: () => void): void {
    if (this.current.route !== 'detail') return;
    if (exit !== undefined) {
      // A reader may still be preparing behind the detail. Its own exit
      // settles the session before leaving the journey.
      this.returns.requestParentAfterExit(exit, 'detailOrigin');
    } else {
      returnToParent();
    }
  }

  returnFromDetail(owner: ReaderRuntimeOwner | undefined, ports: DetailReturnPorts): void {
    const opening = this.current;
    if (opening.route !== 'detail') return;
    switch (this.returns.detailReturnTarget(owner)) {
      case 'reader':
        ports.resumeReader();
        return;
      case 'search':
        this.returns.leaveDetailJourney();
        if (!this.advanceOpening(opening, ports.leaveForSearch)) return;
        this.prepareReaderDestination('reading');
        ports.restoreSearch(this.show('search'));
        return;
      case 'bookshelf':
        ports.showBookshelf(this.returns.takeBookshelfDetailFocus());
        return;
    }
  }

  isSearchDetailJourney(): boolean {
    const route = this.current.route;
    return (route === 'detail' || route === 'reading' || route === 'directory') &&
      this.returns.snapshot().detailParent === 'search';
  }

  admitDetailFrom(origin: DetailOriginRoute, open: () => void): boolean {
    const opening = this.current;
    if (opening.route !== origin) return false;
    open();
    return this.current.route === 'detail' && this.current.generation === opening.generation + 1;
  }

  openBookshelfDetail(focus: BookshelfDetailReturnFocus | undefined, open: () => void): void {
    if (this.admitDetailFrom('bookshelf', open) && focus !== undefined)
      this.returns.rememberBookshelfDetailFocus(focus);
  }

  returnToBookshelf(focus: BookshelfDetailReturnFocus | undefined, advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    this.returns.leaveDetailJourney();
    if (!this.advanceOpening(opening, advance)) return undefined;
    this.prepareReaderDestination('reading');
    this.returns.setSourceOrigin();
    this.returnedBookshelfFocus = focus;
    return this.show('bookshelf');
  }

  showReadingOrigin(): ReaderNavigationSnapshot {
    this.prepareReaderDestination('reading');
    return this.show(this.returns.snapshot().readingOrigin);
  }

  openBookshelfMultiSelect(advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== 'bookshelf' || !this.advanceOpening(opening, advance)) return undefined;
    return this.show('bookshelfMultiSelect');
  }

  finishBookshelfMultiSelect(advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== 'bookshelfMultiSelect' || !this.advanceOpening(opening, advance)) return undefined;
    return this.show('bookshelf');
  }

  openLibrarySearch(advance: () => void, admit: () => boolean): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== 'bookshelf' || !this.advanceOpening(opening, advance)) return undefined;
    const prepared = this.current;
    if (!admit() || this.current !== prepared) return undefined;
    return this.show('search');
  }

  takeReturnedBookshelfFocus(generation: number): BookshelfDetailReturnFocus | undefined {
    if (this.current.route !== 'bookshelf' || generation !== this.current.generation) return undefined;
    const focus = this.returnedBookshelfFocus;
    this.returnedBookshelfFocus = undefined;
    return focus;
  }

  openDownloadChapter(ports: DownloadChapterNavigationPorts): void {
    const opening = this.current;
    if (opening.route !== 'downloads' || ports.readingActive()) return;
    const admitted = this.returns.openReadingFromDownloads((parent: DetailReturnRoute): boolean => {
      ports.openBook(parent);
      return this.current.generation !== opening.generation && this.current.route === 'reading' && ports.readingActive();
    });
    // If admission opened a detail but never started its reader, restore the
    // original downloads view. A refusal before navigation leaves it intact.
    if (!admitted && this.current.generation !== opening.generation &&
      this.current.route === 'detail' && !ports.readingActive()) ports.restoreDownloads({ kind: 'resume' });
  }

  openDownloads(intent: SharedDownloadOpeningIntent, currentBook: () => ShelfBook | undefined,
    advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    const origin = opening.route;
    if (intent.kind === 'fresh' && origin !== 'bookshelf' && origin !== 'settings' &&
      origin !== 'detail' && origin !== 'directory') return undefined;
    const book = intent.kind === 'fresh' && (origin === 'detail' || origin === 'directory') ? currentBook() : undefined;
    if (!this.advanceOpening(opening, advance)) return undefined;
    if (intent.kind === 'fresh') this.returns.rememberDownloadOrigin(origin, (): ShelfBook | undefined => book);
    return this.show('downloads');
  }

  returnFromDownloads(ports: DownloadReturnPorts): void {
    if (this.current.route === 'downloads') this.returns.returnFromDownloads(ports);
  }

  openSourceManagement(target: SourceManagementReturnTarget, keyword: string,
    advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== target || !this.advanceOpening(opening, advance)) return undefined;
    this.returns.setSourceOrigin(target, keyword);
    return this.show('source');
  }

  openSourceTools(advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== 'source' || !this.advanceOpening(opening, advance)) return undefined;
    return this.show('sourceTools');
  }

  backFromSourceTools(advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    if (opening.route !== 'sourceTools' || !this.advanceOpening(opening, advance)) return undefined;
    return this.show('source');
  }

  sourceImportSearchAction(current: () => boolean, submit: () => void): (() => void) | undefined {
    const opening = this.current;
    const origin = this.returns.sourceOrigin();
    if (opening.route !== 'source' || origin.target !== 'search' || origin.keyword.length === 0) return undefined;
    let submitted = false;
    return (): void => {
      if (submitted || this.current !== opening || this.returns.sourceOrigin() !== origin || !current()) return;
      submitted = true;
      submit();
    };
  }

  closeSourceManagement(autoSearch: boolean, advance: () => void): SourceManagementReturn | undefined {
    const opening = this.current;
    if (opening.route !== 'source') return undefined;
    const origin = this.returns.sourceOrigin();
    if (!this.advanceOpening(opening, advance) || this.returns.sourceOrigin() !== origin) return undefined;
    this.returns.takeSourceOrigin();
    const snapshot = this.show(origin.target);
    return origin.target === 'search' && autoSearch && origin.keyword.length > 0 ?
      { snapshot, keyword: origin.keyword } : { snapshot };
  }

  setSettingsSection(section: SettingsSection): ReaderNavigationSnapshot {
    if (section !== this.current.settingsSection) {
      this.current = { route: this.current.route, generation: this.current.generation,
        directoryReturnTarget: this.current.directoryReturnTarget, settingsSection: section };
    }
    return this.current;
  }

  openSettingsHome(): ReaderNavigationSnapshot {
    this.setSettingsSection('home');
    return this.show('settings');
  }

  selectSettingsSection(section: SettingsSection, back: () => void): ReaderNavigationSnapshot | undefined {
    if (this.current.route !== 'settings' || section === this.current.settingsSection) return undefined;
    if (section === 'home') {
      back();
      return undefined;
    }
    return this.setSettingsSection(section);
  }

  openBookshelfSettings(advance: () => void): ReaderNavigationSnapshot | undefined {
    const opening = this.current;
    const origin = opening.route;
    if (origin !== 'settings' && origin !== 'bookshelf') return undefined;
    if (!this.advanceOpening(opening, advance)) return undefined;
    this.bookshelfSettingsReturn = origin;
    return this.show('bookshelfSettings');
  }

  backFromBookshelfSettings(showSettings: () => void, showBookshelf: () => void): void {
    if (this.current.route !== 'bookshelfSettings') return;
    if (this.bookshelfSettingsReturn === 'settings') showSettings();
    else showBookshelf();
  }

  setRulesManagementOrigin(target: RulesManagementReturnTarget): void {
    this.rulesManagementReturn = target;
  }

  takeRulesManagementOrigin(): RulesManagementReturnTarget {
    const target = this.rulesManagementReturn;
    this.rulesManagementReturn = 'settings';
    return target;
  }

  private advanceOpening(opening: ReaderNavigationSnapshot, advance: () => void): boolean {
    if (this.current !== opening) return false;
    advance();
    return this.current.route === opening.route && this.current.generation === opening.generation + 1;
  }
}
